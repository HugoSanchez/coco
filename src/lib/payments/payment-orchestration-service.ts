/**
 * Payment Orchestration Service
 *
 * This service handles the complete payment flow for consultation bookings, including:
 * - Validating practitioner Stripe account setup
 * - Creating Stripe checkout sessions
 * - Tracking payment sessions in our database
 * - Coordinating between Stripe API and our database
 *
 * The service ensures that all payment-related operations are properly tracked
 * and that practitioners are ready to receive payments before creating checkout sessions.
 */

import { stripeService } from './stripe-service'
import {
	createPaymentSession,
	getPaymentSessionsForBooking,
	updatePaymentSessionStatus,
	updatePaymentSession,
	getPaymentSessionsForInvoice
} from '@/lib/db/payment-sessions'
import { getStripeAccountForPayments } from '@/lib/db/stripe-accounts'
import { findInvoiceByLegacyBillId, markInvoiceRefunded } from '@/lib/db/invoices'
import { createCreditNoteForInvoice, createCreditNoteForRefund } from '@/lib/invoicing/invoice-orchestration'
import { getBillsForBooking, updateBillStatus, markBillAsRefunded } from '@/lib/db/bills'
import { getProfileById } from '@/lib/db/profiles'
import { getBookingById } from '@/lib/db/bookings'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'

export class PaymentOrchestrationService {
	/**
	 * Creates a consultation checkout session with full business logic
	 *
	 * This is the main entry point for initiating payments. It handles:
	 * 1. Verifying the practitioner has a valid Stripe account
	 * 2. Ensuring the account is onboarded and ready for payments
	 * 3. Creating a Stripe checkout session
	 * 4. Saving a payment session record for tracking
	 *
	 * The function uses a fail-fast approach: if any step fails, the entire
	 * operation fails and returns an error message.
	 *
	 * @param params - Payment checkout parameters
	 * @param params.userId - UUID of the practitioner receiving payment
	 * @param params.bookingId - UUID of the booking being paid for
	 * @param params.clientEmail - Email address of the client making payment
	 * @param params.clientName - Full name of the client
	 * @param params.consultationDate - Date/time of the consultation
	 * @param params.amount - Payment amount in euros (will be converted to cents)
	 * @param params.practitionerName - Name of the practitioner for display
	 * @param params.supabaseClient - Optional Supabase client for database operations
	 *
	 * @returns Promise resolving to operation result with success flag and either checkoutUrl or error
	 */
	async orechestrateConsultationCheckout({
		userId,
		bookingId,
		clientEmail,
		clientName,
		consultationDate,
		amount,
		practitionerName,
		supabaseClient
	}: {
		userId: string
		bookingId: string
		clientEmail: string
		clientName: string
		consultationDate: string
		amount: number
		practitionerName: string
		supabaseClient?: SupabaseClient
	}): Promise<{
		success: boolean
		checkoutUrl?: string
		error?: string
	}> {
		try {
			// Create service role client for database operations that bypass RLS
			// This is needed because payment orchestration runs server-side without user auth
			const serviceClient = createServiceRoleClient()

			// STEP 1: Validate practitioner's Stripe account
			// =============================================
			// We need to ensure the practitioner has a Stripe Connect account
			// that is fully onboarded and enabled for payments.
			const stripeAccount = await getStripeAccountForPayments(userId, serviceClient)

			// Check if account exists and is ready for payments
			// Both onboarding_completed and payments_enabled must be true
			if (!stripeAccount || !stripeAccount.onboarding_completed || !stripeAccount.payments_enabled) {
				const errorMessage = !stripeAccount
					? 'Stripe account not found for practitioner'
					: 'Stripe account not ready for payments'

				return {
					success: false,
					error: errorMessage
				}
			}

			// STEP 1.5: Fetch additional required data from database
			// ======================================================
			// Get practitioner email and booking details for Stripe metadata
			const [practitioner, booking] = await Promise.all([
				getProfileById(userId, serviceClient),
				getBookingById(bookingId, serviceClient)
			])

			if (!practitioner) {
				return {
					success: false,
					error: 'Practitioner profile not found'
				}
			}

			if (!booking) {
				return {
					success: false,
					error: 'Booking not found'
				}
			}

			// STEP 2: Create Stripe checkout session
			// =======================================
			// Reuse existing pending session if still open to allow multi-device clicks
			const existingSessionsPre = await getPaymentSessionsForBooking(bookingId, serviceClient)
			const latestPending = existingSessionsPre.find((s) => s.status === 'pending' && s.stripe_session_id)
			if (latestPending?.stripe_session_id) {
				const retrieved = await stripeService.retrieveCheckoutSession(latestPending.stripe_session_id)
				if (retrieved.success && retrieved.status === 'open' && retrieved.url) {
					return {
						success: true,
						checkoutUrl: retrieved.url
					}
				}
			}
			// Use the Stripe service to create a checkout session. This handles
			// all the Stripe API communication and returns both the session ID
			// and the checkout URL that the client will be redirected to.
			const { sessionId, checkoutUrl } = await stripeService.createConsultationCheckout({
				practitionerStripeAccountId: stripeAccount.stripe_account_id,
				clientEmail,
				clientName,
				consultationDate,
				amount,
				bookingId,
				practitionerName,
				practitionerEmail: practitioner.email,
				practitionerUserId: userId,
				startTime: booking.start_time,
				endTime: booking.end_time
			})

			// STEP 3: Track payment session in our database
			// ==============================================
			try {
				// Check if a payment session already exists for this booking (e.g., from resend)
				const existingSessions = await getPaymentSessionsForBooking(bookingId, serviceClient)

				if (existingSessions.length > 0) {
					// Update existing payment session with new Stripe session ID
					await updatePaymentSession(
						existingSessions[0].id,
						{
							stripe_session_id: sessionId,
							amount: amount,
							status: 'pending',
							stripe_payment_intent_id: null,
							completed_at: null
						},
						serviceClient
					)
				} else {
					// Create new payment session record
					await createPaymentSession(
						{
							booking_id: bookingId,
							stripe_session_id: sessionId,
							amount: amount,
							status: 'pending'
						},
						serviceClient
					)
				}
			} catch (dbError) {
				console.error('[payments][orch] db_track_error', {
					bookingId,
					error: dbError instanceof Error ? dbError.message : String(dbError)
				})
				Sentry.captureException(dbError, {
					tags: {
						component: 'payments-orchestrator',
						stage: 'db_track'
					},
					extra: { bookingId }
				})
				// Non-fatal: continue and return checkoutUrl to avoid blocking client
			}

			// STEP 4: Return success with checkout URL
			// ========================================
			// Everything succeeded, return the checkout URL for the client
			return {
				success: true,
				checkoutUrl
			}
		} catch (error) {
			// STEP 5: Error handling
			// ======================
			Sentry.captureException(error, {
				tags: { component: 'payments-orchestrator' },
				extra: { bookingId, userId }
			})
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		}
	}

	/**
	 * Creates a Stripe checkout for an invoice (monthly or multi-booking)
	 */
	async orchestrateInvoiceCheckout({
		invoiceId,
		supabaseClient
	}: {
		invoiceId: string
		supabaseClient?: SupabaseClient
	}): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> {
		try {
			const serviceClient = createServiceRoleClient()

			// Load invoice
			const { getInvoiceById } = await import('@/lib/db/invoices')
			const { getProfileById } = await import('@/lib/db/profiles')
			const { getStripeAccountForPayments } = await import('@/lib/db/stripe-accounts')

			const invoice = await getInvoiceById(invoiceId, serviceClient)
			if (!invoice) return { success: false, error: 'Invoice not found' }

			// Allowed statuses: if draft, we still allow payment, but prefer issued (numbers assigned)
			// Block if canceled or paid
			if (invoice.status === 'paid' || invoice.status === 'canceled') {
				return { success: false, error: `Invoice not payable (status=${invoice.status})` }
			}

			// Resolve practitioner stripe account
			const stripeAccount = await getStripeAccountForPayments(invoice.user_id, serviceClient)
			if (!stripeAccount || !stripeAccount.onboarding_completed || !stripeAccount.payments_enabled) {
				return { success: false, error: 'Stripe account not ready for payments' }
			}

			// Build line items from linked bills (bills are our invoice items)
			type Line = { name: string; description?: string | null; unitAmountEur: number; quantity: number }
			let lineItems: Line[] = []
			try {
				const { getBillsForInvoice } = await import('@/lib/db/bills')
				const bills = await getBillsForInvoice(invoice.id, serviceClient)
				lineItems = bills.map((b: any) => {
					const iso = Array.isArray(b?.booking) ? b.booking[0]?.start_time : b?.booking?.start_time
					const when = iso ? new Date(iso) : null
					const dateStr = when
						? formatInTimeZone(when, 'Europe/Madrid', "d 'de' MMM yyyy, HH:mm'h'", { locale: es })
						: null
					return {
						name: 'Consulta',
						description: dateStr,
						unitAmountEur: Number(b.amount || 0),
						quantity: 1
					}
				})
			} catch (err) {
				console.error('[orchestrateInvoiceCheckout] Failed to fetch bills, using fallback:', err)
				// Fallback to one consolidated line if retrieval fails
				lineItems = [
					{ name: 'Consulta(s)', unitAmountEur: Number(invoice.total || 0), quantity: 1, description: null }
				]
			}

			// Practitioner profile for metadata
			const practitioner = await getProfileById(invoice.user_id, serviceClient)
			const practitionerName = practitioner?.name || 'Your Practitioner'
			const practitionerEmail = practitioner?.email || ''

			const { sessionId, checkoutUrl } = await stripeService.createInvoiceCheckout({
				practitionerStripeAccountId: stripeAccount.stripe_account_id,
				clientEmail: invoice.client_email_snapshot,
				clientName: invoice.client_name_snapshot,
				practitionerName,
				practitionerEmail,
				practitionerUserId: invoice.user_id,
				invoiceId: invoice.id,
				currency: invoice.currency || 'EUR',
				billingPeriodStart: invoice.billing_period_start,
				billingPeriodEnd: invoice.billing_period_end,
				lineItems
			})

			// Track or update a payment_session for this invoice
			// Strategy: Only update if there's an active (pending) session; otherwise create new
			try {
				const allSessions = await getPaymentSessionsForInvoice(invoice.id, serviceClient)
				const activeSessions = (allSessions || []).filter((s) => s.status === 'pending')

				if (activeSessions.length > 0) {
					// Update the first active pending session (idempotency: multiple clicks reuse same row)
					await updatePaymentSession(
						activeSessions[0].id,
						{
							stripe_session_id: sessionId,
							amount: invoice.total,
							status: 'pending',
							stripe_payment_intent_id: null,
							completed_at: null
						},
						serviceClient
					)
				} else {
					// No active pending sessions - check if this stripe_session_id already exists (duplicate key prevention)
					const { data: duplicateCheck } = await serviceClient
						.from('payment_sessions')
						.select('id, status, invoice_id')
						.eq('stripe_session_id', sessionId)
						.single()

					if (duplicateCheck) {
						// Stripe session ID already exists - update that row instead of creating duplicate
						await updatePaymentSession(
							duplicateCheck.id,
							{
								invoice_id: invoice.id,
								amount: invoice.total,
								status: 'pending',
								stripe_payment_intent_id: null,
								completed_at: null
							},
							serviceClient
						)
					} else {
						// Create brand new payment session row
						await createPaymentSession(
							{
								invoice_id: invoice.id,
								stripe_session_id: sessionId,
								amount: invoice.total,
								status: 'pending'
							},
							serviceClient
						)
					}
				}
			} catch (err) {
				console.error('[orchestrateInvoiceCheckout] Failed to track payment session:', err)
				// Non-fatal: continue even if session tracking fails
			}

			return { success: true, checkoutUrl }
		} catch (error) {
			Sentry.captureException(error, {
				tags: { component: 'payments-orchestrator', method: 'orchestrateInvoiceCheckout' },
				extra: { invoiceId }
			})
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}

	/**
	 * Cancels payment for a booking by invalidating payment sessions and bills
	 *
	 * This function handles the complete cancellation flow for pending payments:
	 * 1. Finds active payment sessions for the booking
	 * 2. Expires Stripe checkout sessions to prevent payment completion
	 * 3. Marks payment sessions as 'cancelled' in our database
	 * 4. Marks associated bills as 'canceled'
	 *
	 * This is used when a pending booking is cancelled to ensure the client
	 * cannot accidentally complete payment for a cancelled appointment.
	 *
	 * @param bookingId - UUID of the booking to cancel payments for
	 * @param supabaseClient - Optional Supabase client for database operations
	 * @returns Promise resolving to operation result with success flag and optional error
	 */
	async cancelPaymentForBooking(
		bookingId: string,
		supabaseClient?: SupabaseClient
	): Promise<{
		success: boolean
		error?: string
	}> {
		try {
			// STEP 1: Get active payment sessions for this booking
			// ===================================================
			// Find all payment sessions that are still 'pending' for this booking
			const paymentSessions = await getPaymentSessionsForBooking(bookingId)
			const activeSessions = paymentSessions.filter((session) => session.status === 'pending')

			// STEP 2: Expire Stripe checkout sessions
			// ========================================
			// For each active payment session, expire the Stripe checkout session
			// to immediately prevent the client from completing payment
			for (const session of activeSessions) {
				if (session.stripe_session_id) {
					const stripeResult = await stripeService.expireCheckoutSession(session.stripe_session_id)

					// Log but don't fail if Stripe expiration fails
					// (session might already be expired or completed)
					if (!stripeResult.success) {
						console.warn(
							`Failed to expire Stripe session ${session.stripe_session_id}: ${stripeResult.error}`
						)
					}
				}

				// STEP 3: Mark payment session as cancelled in our database
				// =========================================================
				try {
					await updatePaymentSessionStatus(session.id, {
						status: 'cancelled'
					})
				} catch (sessionError) {
					console.error(`Failed to cancel payment session ${session.id}:`, sessionError)
					// Continue with other sessions even if one fails
				}
			}

			// STEP 4: Cancel associated bills
			// ===============================
			// Find and cancel all bills associated with this booking
			try {
				const { cancelBillsForBookings } = await import('@/lib/db/bills')
				await cancelBillsForBookings(bookingId, supabaseClient)
			} catch (billError) {
				console.error(`Failed to cancel bills for booking ${bookingId}:`, billError)
				// Don't fail the entire operation if bill cancellation fails
			}

			return {
				success: true
			}
		} catch (error) {
			console.error(`Payment cancellation error for booking ${bookingId}:`, error)
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		}
	}

	/**
	 * Processes a full refund for a booking payment
	 *
	 * This function handles the complete refund flow:
	 * 1. Finds the paid bill for the booking
	 * 2. Gets the payment intent from the payment session (if exists)
	 * 3. Processes the refund with Stripe (if payment was through Stripe)
	 * 4. Updates the bill status to 'refunded'
	 *
	 * Only bills with status 'paid' can be refunded. The function performs
	 * a full refund (entire bill amount) back to the original payment method.
	 * For manually marked payments (no Stripe session), it performs a manual refund.
	 *
	 * @param bookingId - UUID of the booking to refund
	 * @param reason - Optional reason for the refund
	 * @param supabaseClient - Optional Supabase client for database operations
	 * @returns Promise resolving to refund result with success flag and optional error
	 */
	async refundBookingPayment(
		bookingId: string,
		reason?: string,
		supabaseClient?: SupabaseClient
	): Promise<{
		success: boolean
		refundId?: string
		error?: string
	}> {
		try {
			// STEP 1: Find the paid bill for this booking (guard against already refunded)
			// ===========================================
			const bills = await getBillsForBooking(bookingId, supabaseClient)
			const alreadyRefunded = bills.find((b) => b.status === 'refunded')
			if (alreadyRefunded) {
				return {
					success: false,
					error: 'Bill already refunded'
				}
			}
			const paidBill = bills.find((bill) => bill.status === 'paid')

			if (!paidBill) {
				return {
					success: false,
					error: 'No paid bill found for this booking'
				}
			}

			// STEP 2: Check if this was a Stripe payment or manual payment
			// ===========================================================
			const paymentSessions = await getPaymentSessionsForBooking(bookingId)
			const completedSession = paymentSessions.find((session) => session.status === 'completed')

			// STEP 3: Process refund based on payment method
			// ==============================================
			let stripeRefundId: string

			if (completedSession && completedSession.stripe_payment_intent_id) {
				// This was a Stripe payment - process refund through Stripe
				// Resolve practitioner's connected account (if any) for direct charges
				let practitionerStripeAccountId: string | undefined
				try {
					const bookingRow = await getBookingById(bookingId, supabaseClient)
					if (bookingRow) {
						const acc = await getStripeAccountForPayments(bookingRow.user_id, supabaseClient)
						practitionerStripeAccountId = acc?.stripe_account_id
					}
				} catch (_) {}
				const refundResult = await stripeService.processRefund(
					completedSession.stripe_payment_intent_id,
					reason,
					bookingId,
					// Direct charges: refund on the connected account (fallback handled inside service)
					practitionerStripeAccountId
				)

				if (!refundResult.success) {
					return {
						success: false,
						error: `Stripe refund failed: ${refundResult.error}`
					}
				}

				stripeRefundId = refundResult.refundId!
			} else {
				// This was a manual payment - create a manual refund record
				stripeRefundId = `manual_refund_${Date.now()}_${bookingId.slice(0, 8)}`
			}

			// STEP 4: Update bill status to refunded
			// ======================================
			await markBillAsRefunded(paidBill.id, stripeRefundId, reason, supabaseClient)

			// STEP 5: Update related invoice + create rectificativa
			{
				try {
					const invoice = await findInvoiceByLegacyBillId(paidBill.id, supabaseClient)
					if (invoice) {
						await markInvoiceRefunded(invoice.id, new Date(), reason ?? null, supabaseClient)
						// Create a rectificativa: per-booking usually equals full amount; monthly = partial
						try {
							const refundAmount = Number(paidBill.amount || 0)
							await createCreditNoteForRefund(
								{
									invoiceId: invoice.id,
									userId: invoice.user_id,
									amount: refundAmount,
									reason: reason ?? 'Anulación de consulta',
									stripeRefundId
								},
								supabaseClient
							)
						} catch (cnErr) {
							console.warn('[payments][orch] credit note creation failed', cnErr)
						}
					}
				} catch (e) {
					console.warn('[payments][orch] invoice refund dual-write failed', e)
				}
			}

			return {
				success: true,
				refundId: stripeRefundId
			}
		} catch (error) {
			console.error(`Refund error for booking ${bookingId}:`, error)
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		}
	}
}

/**
 * Singleton instance of the Payment Orchestration Service
 *
 * Usage example:
 * ```typescript
 * import { paymentOrchestrationService } from '@/lib/payments/payment-orchestration-service'
 *
 * const result = await paymentOrchestrationService.createConsultationCheckout({
 *   userId: 'practitioner-uuid',
 *   bookingId: 'booking-uuid',
 *   clientEmail: 'client@example.com',
 *   clientName: 'John Doe',
 *   consultationDate: '2024-01-15T10:00:00Z',
 *   amount: 50, // euros
 *   practitionerName: 'Dr. Smith'
 * })
 *
 * if (result.success) {
 *   // Redirect client to result.checkoutUrl
 * } else {
 *   // Handle error: result.error
 * }
 * ```
 */
export const paymentOrchestrationService = new PaymentOrchestrationService()
