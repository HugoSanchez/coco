import { NextRequest, NextResponse } from 'next/server'
import { markPaymentSessionCompleted } from '@/lib/db/payment-sessions'
import { updateBookingStatus } from '@/lib/db/bookings'
import { getBillForBookingAndMarkAsPaid, updateBillReceiptMetadata, markBillReceiptEmailSent } from '@/lib/db/bills'
import { getCalendarEventsForBooking, updateCalendarEventType } from '@/lib/db/calendar-events'
import { updatePendingToConfirmed } from '@/lib/calendar/calendar'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import * as Sentry from '@sentry/nextjs'
import { captureEvent } from '@/lib/posthog/server'
import { sendPaymentReceiptEmail } from '@/lib/emails/email-service'
import { finalizeInvoiceForBillPayment, createCreditNoteForInvoice } from '@/lib/invoicing/invoice-orchestration'
import { getPaymentSessionByPaymentIntentId } from '@/lib/db/payment-sessions'
import { findInvoiceByLegacyBillId } from '@/lib/db/invoices'

/**
 * Stripe webhook handler
 *
 * This function is used to handle Stripe webhooks.
 * It is used to update the payment session status, booking status, and bill status.
 *
 * @param request - The request object
 * @returns The response object
 */

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Support multiple webhook secrets (platform + connected accounts)
const platformWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const connectWebhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
const webhookSecrets = [platformWebhookSecret, connectWebhookSecret].filter(Boolean) as string[]
if (webhookSecrets.length === 0) {
	throw new Error('At least one of STRIPE_WEBHOOK_SECRET or STRIPE_CONNECT_WEBHOOK_SECRET must be set')
}

export async function POST(request: NextRequest) {
	console.log('Stripe payments webhook received!')
	try {
		///////////////////////////////////////////////////////////
		///// 1. Create service role client for bypassing RLS
		///////////////////////////////////////////////////////////
		const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

		///////////////////////////////////////////////////////////
		///// 2. Verify webhook signature
		///////////////////////////////////////////////////////////
		const body = await request.text()
		const sig = request.headers.get('stripe-signature')

		if (!sig) {
			console.error('Missing Stripe signature')
			Sentry.captureMessage('webhooks:stripe-payments missing signature', {
				level: 'warning',
				tags: { component: 'webhook', kind: 'stripe-payments' }
			})
			return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
		}

		// Verify webhook signature against any configured secret
		let event: Stripe.Event | null = null
		let matchedIsConnectSecret: boolean | null = null
		let lastError: any = null
		for (const secret of webhookSecrets) {
			try {
				event = stripe.webhooks.constructEvent(body, sig, secret)
				matchedIsConnectSecret = secret === connectWebhookSecret
				break
			} catch (err: any) {
				lastError = err
				continue
			}
		}
		if (!event) {
			console.error('Webhook signature verification failed for all secrets:', lastError?.message)
			Sentry.captureException(lastError, {
				tags: {
					component: 'webhook',
					kind: 'stripe-payments',
					stage: 'verify_all_secrets'
				}
			})
			return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
		}

		///////////////////////////////////////////////////////////
		///// 3. Handle checkout session completed
		///////////////////////////////////////////////////////////
		if (event.type === 'checkout.session.completed') {
			// 1. Get session object to get metadata
			const session = event.data.object as Stripe.Checkout.Session
			const connectedAccountId = (event as any).account as string | undefined
			// 2. Route by metadata: booking vs invoice
			const invoiceId = session.metadata?.invoice_id as string | undefined
			const bookingId = session.metadata?.booking_id as string | undefined
			if (!bookingId && !invoiceId) return NextResponse.json({ received: true })
			// 3. Update payment session status (booking path)
			if (bookingId) {
				await markPaymentSessionCompleted(session.id, session.payment_intent as string, supabase, {
					bookingId,
					amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : null
				})
			}
			// Booking branch: update booking/bill
			let bill: any = null
			if (bookingId) {
				await updateBookingStatus(bookingId, 'scheduled', supabase)
				bill = await getBillForBookingAndMarkAsPaid(bookingId, supabase)
				console.log('[webhook] bill marked paid', { bookingId, billId: bill?.id })
			}

			///////////////////////////////////////////////////////////
			///// 4. Capture and store Stripe receipt metadata
			///////////////////////////////////////////////////////////
			// Only fetch/store/send receipt details for CONNECT events
			if (matchedIsConnectSecret) {
				try {
					const paymentIntent = await stripe.paymentIntents.retrieve(
						session.payment_intent as string,
						{ expand: ['latest_charge'] },
						connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
					)
					const charge = (paymentIntent as any)?.latest_charge as Stripe.Charge | undefined
					const receiptUrl = charge?.receipt_url as string | undefined
					const chargeId = charge?.id as string | undefined

					if (bookingId && bill && (receiptUrl || chargeId)) {
						await updateBillReceiptMetadata(
							bill.id,
							{
								stripe_charge_id: chargeId ?? null,
								stripe_receipt_url: receiptUrl ?? null
							},
							supabase
						)
						console.log('[webhook] bill receipt stored', {
							billId: bill.id,
							hasReceiptUrl: Boolean(receiptUrl)
						})
					}

					const clientEmail =
						session.customer_email ||
						((session as any).customer_details?.email as string | undefined) ||
						(session.metadata?.client_email as string | undefined)
					if (bookingId && bill && clientEmail && receiptUrl) {
						const amount =
							typeof session.amount_total === 'number'
								? session.amount_total / 100
								: (paymentIntent.amount_received ?? 0) / 100
						const sendResult = await sendPaymentReceiptEmail({
							to: clientEmail,
							clientName: session.metadata?.client_name || 'Paciente',
							amount,
							currency: session.currency?.toUpperCase() || 'EUR',
							practitionerName: session.metadata?.practitioner_name || 'Tu profesional',
							consultationDate: session.metadata?.start_time,
							receiptUrl
						})
						if (sendResult.success) {
							await markBillReceiptEmailSent(bill.id, supabase)
							console.log('[webhook] receipt email sent', { billId: bill.id })
						}
					}
				} catch (receiptError) {
					Sentry.captureException(receiptError, {
						tags: {
							component: 'webhook',
							kind: 'stripe-payments',
							stage: 'receipt'
						},
						extra: { bookingId }
					})
				}
			} else {
				// Platform legacy flows: skip receipt retrieval/email (as requested)
			}

			// 6. Dual-write path: issue & mark invoice as paid (if enabled)
			if (process.env.ENABLE_INVOICES_DUAL_WRITE === 'true' && bookingId) {
				try {
					const paymentIntentId = session.payment_intent as string
					const requestOpts = connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
					const pi: any = await stripe.paymentIntents.retrieve(
						paymentIntentId,
						{ expand: ['latest_charge'] },
						requestOpts
					)
					const charge = pi?.latest_charge as Stripe.Charge | undefined
					const receiptUrl = charge?.receipt_url || null

					if (bill?.id) {
						await finalizeInvoiceForBillPayment(
							{
								legacyBillId: bill.id,
								userId: session.metadata?.practitioner_user_id || 'unknown',
								paidAt: new Date(),
								receiptUrl,
								stripeSessionId: session.id
							},
							supabase as any
						)
						console.log('[webhook] invoice finalized', {
							billId: bill.id,
							hasReceiptUrl: Boolean(receiptUrl)
						})
					}
				} catch (e) {
					Sentry.captureException(e, {
						tags: {
							component: 'webhook',
							kind: 'stripe-payments',
							stage: 'invoice_finalize'
						},
						extra: { bookingId }
					})
				}
			}

			// Invoice branch: issue-if-draft and mark paid
			if (invoiceId) {
				try {
					const { getInvoiceById, issueInvoice } = await import('@/lib/db/invoices')
					const { onPaymentCompletedForInvoice } = await import('@/lib/invoicing/invoice-orchestration')
					const { listInvoiceItems } = await import('@/lib/db/invoice-items')
					const { getBillForBookingAndMarkAsPaid } = await import('@/lib/db/bills')
					const invoice = await getInvoiceById(invoiceId, supabase as any)
					if (invoice) {
						if (invoice.status === 'draft') {
							await issueInvoice(invoice.id, invoice.user_id, new Date(), supabase as any)
						}
						let receiptUrl: string | null = null
						if (matchedIsConnectSecret) {
							try {
								const paymentIntent = await stripe.paymentIntents.retrieve(
									session.payment_intent as string,
									{ expand: ['latest_charge'] },
									connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
								)
								const charge = (paymentIntent as any)?.latest_charge as Stripe.Charge | undefined
								receiptUrl = (charge?.receipt_url as string | undefined) || null
							} catch (_) {}
						}
						await onPaymentCompletedForInvoice(
							invoice.id,
							{ paidAt: new Date(), receiptUrl },
							supabase as any
						)

						// Dual path: mark related legacy bills as paid so dashboards remain consistent
						try {
							const items = await listInvoiceItems(invoice.id, supabase as any)
							const bookingIds = Array.from(
								new Set((items as any[]).map((it: any) => it.booking_id).filter(Boolean))
							) as string[]
							for (const bId of bookingIds) {
								try {
									await getBillForBookingAndMarkAsPaid(bId, supabase as any)
								} catch (_) {}
							}
						} catch (_) {}
					}
				} catch (e) {
					Sentry.captureException(e, {
						tags: { component: 'webhook', kind: 'stripe-payments', stage: 'invoice_flow' },
						extra: { invoiceId }
					})
				}
			}

			// 7. Capture analytics: successful payment
			try {
				await captureEvent({
					userId: session.metadata?.practitioner_user_id || 'unknown',
					event: 'payment_succeeded',
					userEmail: session.metadata?.practitioner_email,
					properties: {
						booking_id: bookingId,
						stripe_session_id: session.id,
						payment_intent_id: session.payment_intent,
						amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : undefined,
						currency: session.currency?.toUpperCase()
					}
				})
			} catch (_) {}

			///////////////////////////////////////////////////////////
			///// 5. Update pending calendar event to confirmed
			///////////////////////////////////////////////////////////
			try {
				// Extract all needed data from session metadata (no database calls needed!)
				const clientName = session.metadata?.client_name
				const clientEmail = session.customer_email
				const practitionerName = session.metadata?.practitioner_name
				const practitionerEmail = session.metadata?.practitioner_email
				const practitionerUserId = session.metadata?.practitioner_user_id
				const startTime = session.metadata?.start_time
				const endTime = session.metadata?.end_time

				// Validate we have all required data
				if (
					!clientName ||
					!clientEmail ||
					!practitionerName ||
					!practitionerEmail ||
					!practitionerUserId ||
					!startTime ||
					!endTime
				) {
					Sentry.captureMessage('webhooks:stripe-payments missing metadata', {
						level: 'warning',
						tags: {
							component: 'webhook',
							kind: 'stripe-payments'
						},
						extra: { bookingId }
					})
					return NextResponse.json({ received: true })
				}

				// Find the existing pending calendar event for this booking
				const existingEvents = await getCalendarEventsForBooking(bookingId, supabase)
				const pendingEvent = existingEvents.find((event) => event.event_type === 'pending')

				if (!pendingEvent) {
					Sentry.captureMessage('webhooks:stripe-payments no_pending_event', {
						level: 'warning',
						tags: {
							component: 'webhook',
							kind: 'stripe-payments'
						},
						extra: { bookingId }
					})
					return NextResponse.json({ received: true })
				}

				// Update the pending event to confirmed with full appointment details
				const calendarResult = await updatePendingToConfirmed(
					{
						googleEventId: pendingEvent.google_event_id,
						userId: practitionerUserId,
						clientEmail,
						practitionerName,
						practitionerEmail,
						bookingId,
						mode: (session.metadata?.mode as any) || undefined,
						locationText: (session.metadata?.location_text as any) || undefined
					},
					supabase
				)

				if (calendarResult.success && calendarResult.googleEventId) {
					// Update the calendar event record in database to confirmed status
					await updateCalendarEventType(pendingEvent.id, 'confirmed', supabase)

					// Update the Google Meet link and status separately if needed
					if (calendarResult.googleMeetLink) {
						const { error: updateError } = await supabase
							.from('calendar_events')
							.update({
								google_meet_link: calendarResult.googleMeetLink,
								event_status: 'updated'
							})
							.eq('id', pendingEvent.id)

						if (updateError) {
							console.error(`Failed to update Meet link for event ${pendingEvent.id}:`, updateError)
							Sentry.captureException(updateError, {
								tags: {
									component: 'webhook',
									kind: 'stripe-payments',
									stage: 'update_meet'
								},
								extra: { bookingId, eventId: pendingEvent.id }
							})
						}
					}

					console.log(
						`Calendar event updated from pending to confirmed for booking ${bookingId}: ${calendarResult.googleEventId}`
					)
				} else {
					console.error(`Failed to update calendar event for booking ${bookingId}:`, calendarResult.error)
					Sentry.captureMessage('webhooks:stripe-payments calendar_update_failed', {
						level: 'warning',
						tags: {
							component: 'webhook',
							kind: 'stripe-payments'
						},
						extra: { bookingId }
					})
				}
			} catch (calendarError) {
				// Don't fail the webhook if calendar update fails
				console.error(`Calendar update error for booking ${bookingId}:`, calendarError)
				Sentry.captureException(calendarError, {
					tags: {
						component: 'webhook',
						kind: 'stripe-payments',
						stage: 'calendar'
					},
					extra: { bookingId }
				})
			}
		}
		///////////////////////////////////////////////////////////
		///// 3b. Handle refunds (idempotent)
		///////////////////////////////////////////////////////////
		// We support both refund.created and charge.refunded for resiliency.
		// The key identifiers available are charge.payment_intent and refund.payment_intent.
		// Strategy:
		//  - Resolve payment_intent_id from the event.
		//  - Find our payment_session by PI (idempotent lookup).
		//  - If dual-write is enabled and an invoice exists (via legacy bill link), create a rectificativa.
		const skip = true
		if (skip) return NextResponse.json({ received: true })
		else if (event.type === 'refund.created' || event.type === 'charge.refunded') {
			try {
				const connectedAccountId = (event as any).account as string | undefined
				let paymentIntentId: string | undefined
				if (event.type === 'refund.created') {
					const refund = event.data.object as Stripe.Refund
					paymentIntentId = (refund.payment_intent as string) || undefined
				} else {
					const charge = event.data.object as Stripe.Charge
					paymentIntentId = (charge.payment_intent as string) || undefined
				}
				if (!paymentIntentId) return NextResponse.json({ received: true })

				// Lookup our payment session by PI to correlate to booking/bill/invoice
				const ps = await getPaymentSessionByPaymentIntentId(paymentIntentId, supabase)
				if (!ps) return NextResponse.json({ received: true })

				// Find legacy bill -> invoice mapping
				if (process.env.ENABLE_INVOICES_DUAL_WRITE === 'true') {
					try {
						const legacyBills = await supabase
							.from('bills')
							.select('id, booking_id')
							.eq('booking_id', ps.booking_id)
							.order('created_at', { ascending: false })
							.limit(1)
						const billId = legacyBills.data?.[0]?.id
						if (!billId) return NextResponse.json({ received: true })
						const invoice = await findInvoiceByLegacyBillId(billId as string, supabase as any)
						if (!invoice) return NextResponse.json({ received: true })

						// Idempotency: if a credit note already exists for this refund id, skip.
						// (We rely on unique stripe_refund_id per credit note in future migration.)
						const reason = 'Anulación de consulta'
						await createCreditNoteForInvoice(
							{ invoiceId: invoice.id, userId: invoice.user_id, reason, stripeRefundId: undefined },
							supabase as any
						)
					} catch (cnErr) {
						Sentry.captureException(cnErr, {
							tags: { component: 'webhook', kind: 'stripe-payments', stage: 'refund_credit_note' }
						})
					}
				}
			} catch (e) {
				Sentry.captureException(e, {
					tags: { component: 'webhook', kind: 'stripe-payments', stage: 'refund_handler' }
				})
			}
		}
		// 8. Return success response
		return NextResponse.json({ received: true })
	} catch (error) {
		console.error('Webhook error:', error)
		Sentry.captureException(error, {
			tags: { component: 'webhook', kind: 'stripe-payments' }
		})
		return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
	}
}
