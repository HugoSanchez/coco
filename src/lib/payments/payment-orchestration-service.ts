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
import { createPaymentSession } from '@/lib/db/payment-sessions'
import { getStripeAccountForPayments } from '@/lib/db/stripe-accounts'
import type { SupabaseClient } from '@supabase/supabase-js'

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
			// STEP 1: Validate practitioner's Stripe account
			// =============================================
			// We need to ensure the practitioner has a Stripe Connect account
			// that is fully onboarded and enabled for payments.
			const stripeAccount = await getStripeAccountForPayments(
				userId,
				supabaseClient
			)

			// Check if account exists and is ready for payments
			// Both onboarding_completed and payments_enabled must be true
			if (
				!stripeAccount ||
				!stripeAccount.onboarding_completed ||
				!stripeAccount.payments_enabled
			) {
				const errorMessage = !stripeAccount
					? 'Stripe account not found for practitioner'
					: 'Stripe account not ready for payments'

				return {
					success: false,
					error: errorMessage
				}
			}

			// STEP 2: Create Stripe checkout session
			// =======================================
			// Use the Stripe service to create a checkout session. This handles
			// all the Stripe API communication and returns both the session ID
			// and the checkout URL that the client will be redirected to.
			const { sessionId, checkoutUrl } =
				await stripeService.createConsultationCheckout({
					practitionerStripeAccountId:
						stripeAccount.stripe_account_id,
					clientEmail,
					clientName,
					consultationDate,
					amount,
					bookingId,
					practitionerName
				})

			// STEP 3: Track payment session in our database
			// ==============================================
			// Create a payment session record in our DB to track this payment attempt.
			await createPaymentSession({
				booking_id: bookingId,
				stripe_session_id: sessionId,
				amount: amount,
				status: 'pending'
			})

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
