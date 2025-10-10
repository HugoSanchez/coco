import { NextRequest, NextResponse } from 'next/server'
import { markPaymentSessionCompleted } from '@/lib/db/payment-sessions'
import { updateBookingStatus } from '@/lib/db/bookings'
import { getBillForBookingAndMarkAsPaid } from '@/lib/db/bills'
import { updatePendingCalendarEventToConfirmed } from '@/lib/calendar/calendar-orchestration'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import * as Sentry from '@sentry/nextjs'
import { captureEvent } from '@/lib/posthog/server'
import { sendReceiptEmail } from '@/lib/emails/email-service'
import { ensureInvoiceForBillOnPayment, finalizeInvoiceOnPayment } from '@/lib/invoicing/invoice-orchestration'

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
	// Stripe payments webhook received
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
			// 1. Get session object and receipt URL (once)
			const session = event.data.object as Stripe.Checkout.Session
			const connectedAccountId = (event as any).account as string | undefined
			const receiptUrl = await getReceiptUrl(session, connectedAccountId)
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
			// Only send receipt for CONNECT events (receiptUrl will be null otherwise)
			if (matchedIsConnectSecret) {
				try {
					// Note: We no longer persist receipt metadata on bills to keep schema lean.
					// Dual-write (if enabled) persists the receipt URL on invoices instead.

					const clientEmail =
						session.customer_email ||
						((session as any).customer_details?.email as string | undefined) ||
						(session.metadata?.client_email as string | undefined)
					if (bookingId && bill && clientEmail && receiptUrl) {
						const amount = typeof session.amount_total === 'number' ? session.amount_total / 100 : undefined
						const sendResult = await sendReceiptEmail({
							mode: 'booking',
							to: clientEmail,
							clientName: session.metadata?.client_name || 'Paciente',
							amount: amount ?? 0,
							currency: session.currency?.toUpperCase() || 'EUR',
							practitionerName: session.metadata?.practitioner_name || 'Tu profesional',
							consultationDate: session.metadata?.start_time,
							receiptUrl
						})
						if (sendResult.success) {
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

			// 6. Per-booking: ensure/create invoice for the paid bill
			if (bookingId && bill?.id) {
				try {
					await ensureInvoiceForBillOnPayment(
						{
							billId: bill.id,
							userId: session.metadata?.practitioner_user_id || 'unknown',
							snapshot: {
								clientId: bill.client_id ?? null,
								clientName: bill.client_name,
								clientEmail: bill.client_email,
								amount: bill.amount,
								currency: bill.currency
							},
							receiptUrl,
							stripeSessionId: session.id
						},
						supabase as any
					)
					console.log('[webhook] per-booking invoice ensured+finalized', {
						billId: bill.id,
						hasReceiptUrl: Boolean(receiptUrl)
					})
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
					await finalizeInvoiceOnPayment(
						invoiceId,
						{ paidAt: new Date(), receiptUrl: receiptUrl || null },
						supabase as any
					)

					// Send monthly receipt email via unified helper
					try {
						const { getInvoiceById } = await import('@/lib/db/invoices')
						const { getProfileById } = await import('@/lib/db/profiles')
						const invoice = await getInvoiceById(invoiceId, supabase as any)
						if (invoice) {
							const practitioner = await getProfileById(invoice.user_id, supabase as any)
							const monthSource =
								invoice.billing_period_start || invoice.issued_at || new Date().toISOString()
							const monthLabel = new Date(monthSource).toLocaleDateString('es-ES', {
								month: 'long',
								year: 'numeric'
							})
							await sendReceiptEmail({
								mode: 'monthly',
								to: invoice.client_email_snapshot,
								clientName: invoice.client_name_snapshot,
								practitionerName: practitioner?.name || undefined,
								amount:
									typeof session.amount_total === 'number'
										? session.amount_total / 100
										: invoice.total,
								currency: session.currency?.toUpperCase() || invoice.currency || 'EUR',
								receiptUrl: (receiptUrl as string) || invoice.stripe_receipt_url || '',
								monthLabel
							})
						}
					} catch (_) {}
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

				await updatePendingCalendarEventToConfirmed({
					bookingId: bookingId as string,
					practitionerUserId,
					clientEmail,
					practitionerName,
					practitionerEmail,
					supabaseClient: supabase
				})
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
		// Refund events are currently handled elsewhere; no-op here
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

// Helper: Fetch receipt URL (CONNECT path only). Returns null for platform events.
async function getReceiptUrl(session: Stripe.Checkout.Session, connectedAccountId?: string): Promise<string | null> {
	try {
		if (!connectedAccountId) return null
		if (!session.payment_intent) return null
		const paymentIntentId = session.payment_intent as string
		const pi = await stripe.paymentIntents.retrieve(
			paymentIntentId,
			{ expand: ['latest_charge'] },
			{ stripeAccount: connectedAccountId }
		)
		const charge = (pi as any)?.latest_charge as Stripe.Charge | undefined
		return (charge?.receipt_url as string | undefined) || null
	} catch (_) {
		return null
	}
}
