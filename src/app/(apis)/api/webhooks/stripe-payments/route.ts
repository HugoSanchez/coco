import { NextRequest, NextResponse } from 'next/server'
import { markPaymentSessionCompleted } from '@/lib/db/payment-sessions'
import { updateBookingStatus, getBookingById } from '@/lib/db/bookings'
import { getBillForBookingAndMarkAsPaid } from '@/lib/db/bills'
import { updatePendingCalendarEventToConfirmed } from '@/lib/calendar/calendar-orchestration'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import * as Sentry from '@sentry/nextjs'
import { captureEvent } from '@/lib/posthog/server'
import { sendReceiptEmail } from '@/lib/emails/email-service'
import { ensureInvoiceForBillOnPayment, finalizeInvoiceOnPayment } from '@/lib/invoicing/invoice-orchestration'
import { getInvoiceById } from '@/lib/db/invoices'
import { getProfileById } from '@/lib/db/profiles'

/**
 * Stripe webhook handler
 *
 * Responsibilities
 *  - Verify webhook signature (supports platform + connect)
 *  - Parse checkout.session.completed events
 *  - For booking payments: mark session, mark bill paid, send receipt (connect), ensure invoice
 *  - For invoice payments: finalize invoice (issue if draft, mark paid, store receipt)
 *  - Capture analytics event
 *  - Promote pending calendar event to confirmed
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
		// STEP 0: Initialize logger (shared Sentry tags)
		const logger = createSentryLogger({ component: 'webhook', kind: 'stripe-payments' })
		///////////////////////////////////////////////////////////
		///// STEP 1: Create service role client (bypass RLS)
		///////////////////////////////////////////////////////////
		const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

		///////////////////////////////////////////////////////////
		///// STEP 2: Verify webhook signature
		///////////////////////////////////////////////////////////
		const body = await request.text()
		const sig = request.headers.get('stripe-signature')

		if (!sig) {
			logger.logWarn('missing_signature', 'webhooks:stripe-payments missing signature')
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
			logger.logError('verify_all_secrets', lastError)
			return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
		}

		///////////////////////////////////////////////////////////
		///// STEP 3: Handle checkout.session.completed
		///////////////////////////////////////////////////////////
		if (event.type === 'checkout.session.completed') {
			// 3.1 Get session object and resolve receipt URL (CONNECT only)
			const session = event.data.object as Stripe.Checkout.Session
			const connectedAccountId = (event as any).account as string | undefined
			const receiptUrl = await getReceiptUrl(session, connectedAccountId)
			// 3.2 Route by metadata: booking vs invoice
			const invoiceId = session.metadata?.invoice_id as string | undefined
			const bookingId = session.metadata?.booking_id as string | undefined
			if (!bookingId && !invoiceId) return NextResponse.json({ received: true })
			// 3.3 Update payment session status (booking path)
			if (bookingId) {
				await markPaymentSessionCompleted(session.id, session.payment_intent as string, supabase, {
					bookingId,
					amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : null
				})
			}
			// 3.4 Booking branch: mark booking and bill as paid
			let bill: any = null
			if (bookingId) {
				await updateBookingStatus(bookingId, 'scheduled', supabase)
				bill = await getBillForBookingAndMarkAsPaid(bookingId, supabase)
				console.log('[webhook] bill marked paid', { bookingId, billId: bill?.id })
			}

			///////////////////////////////////////////////////////////
			///// STEP 4: Send receipt email (CONNECT events only)
			///////////////////////////////////////////////////////////
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
					logger.logError('receipt', receiptError, {
						bookingId,
						stripeSessionId: session.id,
						connectedAccountId,
						practitionerUserId: session.metadata?.practitioner_user_id
					})
				}
			}

			///////////////////////////////////////////////////////////
			///// STEP 5: Ensure/finalize invoice (per-booking path)
			///////////////////////////////////////////////////////////
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
				} catch (e) {
					logger.logError('invoice_finalize', e, {
						bookingId,
						stripeSessionId: session.id,
						connectedAccountId,
						practitionerUserId: session.metadata?.practitioner_user_id
					})
				}
			}

			///////////////////////////////////////////////////////////
			///// STEP 6: Finalize invoice (invoice path)
			///////////////////////////////////////////////////////////
			if (invoiceId) {
				try {
					await finalizeInvoiceOnPayment(
						invoiceId,
						{ paidAt: new Date(), receiptUrl: receiptUrl || null },
						supabase as any
					)

					// Send monthly receipt email via unified helper
					try {
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
					logger.logError('invoice_flow', e, {
						invoiceId,
						stripeSessionId: session.id,
						connectedAccountId,
						practitionerUserId: session.metadata?.practitioner_user_id,
						bookingId
					})
				}
			}

			///////////////////////////////////////////////////////////
			///// STEP 7: Capture analytics (best-effort)
			///////////////////////////////////////////////////////////
			try {
				await captureEvent({
					userId: session.metadata?.practitioner_user_id || 'unknown',
					event: 'payment_succeeded',
					userEmail: session.metadata?.practitioner_email,
					properties: {
						amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : undefined
					}
				})
			} catch (_) {}

			///////////////////////////////////////////////////////////
			///// STEP 8: Promote pending calendar event to confirmed
			///////////////////////////////////////////////////////////
			try {
				// Skip calendar promotion for recurring bookings - they use master recurring events
				// that send invites immediately, not individual pending events
				const booking = await getBookingById(bookingId as string, supabase)
				// Check if booking is part of a recurring series (series_id field exists in DB but may not be in type)
				const isRecurringBooking = booking && 'series_id' in booking && (booking as any).series_id != null
				if (isRecurringBooking) {
					logger.logInfo('skip_recurring_calendar', 'Skipping calendar promotion for recurring booking', {
						bookingId,
						seriesId: (booking as any).series_id
					})
					// Recurring bookings already have invites sent via master recurring event
					// No need to promote pending events that don't exist
				} else {
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
						logger.logWarn('missing_metadata', 'webhooks:stripe-payments missing metadata', {
							bookingId,
							stripeSessionId: session.id,
							connectedAccountId,
							practitionerUserId
						})
						return NextResponse.json({ received: true })
					}

					await updatePendingCalendarEventToConfirmed({
						bookingId: bookingId as string,
						practitionerUserId,
						clientName,
						clientEmail,
						practitionerName,
						practitionerEmail,
						supabaseClient: supabase
					})
				}
			} catch (calendarError) {
				// Don't fail the webhook if calendar update fails
				logger.logError('calendar', calendarError, {
					bookingId,
					stripeSessionId: session.id,
					connectedAccountId,
					practitionerUserId: session.metadata?.practitioner_user_id
				})
			}
		}
		///////////////////////////////////////////////////////////
		///// STEP 9: Success response
		///////////////////////////////////////////////////////////
		return NextResponse.json({ received: true })
	} catch (error) {
		const logger = createSentryLogger({ component: 'webhook', kind: 'stripe-payments' })
		logger.logError('handler', error)
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

// Sentry helper with base tags
function createSentryLogger(baseTags: Record<string, string>) {
	return {
		logError(name: string, error: any, extra?: any) {
			try {
				console.error(`[stripe-webhook:${name}]`, error)
			} catch (_) {}
			Sentry.captureException(error, { tags: { ...baseTags, name, stage: name, step: name }, extra })
		},
		logWarn(name: string, message?: string, extra?: any) {
			const msg = message || name
			try {
				console.warn(`[stripe-webhook:${name}] ${msg}`)
			} catch (_) {}
			Sentry.captureMessage(msg, {
				level: 'warning',
				tags: { ...baseTags, name, stage: name, step: name },
				extra
			})
		},
		logInfo(name: string, message?: string, extra?: any) {
			const msg = message || name
			try {
				console.log(`[stripe-webhook:${name}] ${msg}`)
			} catch (_) {}
			Sentry.captureMessage(msg, { level: 'info', tags: { ...baseTags, name, stage: name, step: name }, extra })
		}
	}
}
