import { createClient } from '@supabase/supabase-js'
import { stripeService } from './stripe-service'

// Use service role client for admin operations
const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export class PaymentOrchestrationService {
	/**
	 * Creates a consultation checkout session with full business logic
	 * Handles database operations, validation, and payment session tracking
	 */
	async createConsultationCheckout({
		userId,
		bookingId,
		clientEmail,
		clientName,
		consultationDate,
		amount,
		practitionerName
	}: {
		userId: string
		bookingId: string
		clientEmail: string
		clientName: string
		consultationDate: string
		amount: number
		practitionerName: string
	}): Promise<{
		success: boolean
		checkoutUrl?: string
		error?: string
	}> {
		try {
			// Get practitioner's Stripe account
			const { data: stripeAccount, error: stripeError } = await supabase
				.from('stripe_accounts')
				.select(
					'stripe_account_id, onboarding_completed, payments_enabled'
				)
				.eq('user_id', userId)
				.single()

			if (stripeError || !stripeAccount) {
				return {
					success: false,
					error: 'Stripe account not found for practitioner'
				}
			}

			if (
				!stripeAccount.onboarding_completed ||
				!stripeAccount.payments_enabled
			) {
				return {
					success: false,
					error: 'Stripe account not ready for payments'
				}
			}

			// Create checkout session using low-level Stripe service
			const checkoutUrl = await stripeService.createConsultationCheckout({
				practitionerStripeAccountId: stripeAccount.stripe_account_id,
				clientEmail,
				clientName,
				consultationDate,
				amount,
				bookingId,
				practitionerName
			})

			// Extract session ID and save payment session
			const sessionIdMatch = checkoutUrl.match(/\/cs_[^?]+/)
			const stripeSessionId = sessionIdMatch
				? sessionIdMatch[0].substring(1)
				: null

			if (stripeSessionId) {
				const { error: insertError } = await supabase
					.from('payment_sessions')
					.insert({
						booking_id: bookingId,
						stripe_session_id: stripeSessionId,
						amount: amount,
						status: 'pending'
					})

				if (insertError) {
					console.error(
						'Failed to save payment session:',
						insertError
					)
					// Continue anyway - don't fail the checkout creation
				} else {
					console.log('✅ Payment session saved:', stripeSessionId)
				}
			}

			return {
				success: true,
				checkoutUrl
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		}
	}
}

// Export singleton instance
export const paymentOrchestrationService = new PaymentOrchestrationService()
