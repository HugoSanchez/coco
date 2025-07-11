import Stripe from 'stripe'

// Initialize Stripe with environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export class StripeService {
	/**
	 * Create a new Stripe Connect account for a practitioner
	 */
	async createConnectAccount(
		email: string,
		country: string = 'ES'
	): Promise<{
		success: boolean
		accountId?: string
		error?: string
	}> {
		try {
			const account = await stripe.accounts.create({
				type: 'express',
				country,
				email,
				capabilities: {
					card_payments: { requested: true },
					transfers: { requested: true }
				}
			})

			return {
				success: true,
				accountId: account.id
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		}
	}

	/**
	 * Create an onboarding link for a Stripe Connect account
	 */
	async createOnboardingLink(
		accountId: string,
		returnUrl: string,
		refreshUrl: string
	): Promise<{
		success: boolean
		url?: string
		error?: string
	}> {
		try {
			const accountLink = await stripe.accountLinks.create({
				account: accountId,
				return_url: returnUrl,
				refresh_url: refreshUrl,
				type: 'account_onboarding'
			})

			return {
				success: true,
				url: accountLink.url
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		}
	}

	/**
	 * Create checkout session for consultation payment
	 */
	async createConsultationCheckout({
		practitionerStripeAccountId,
		clientEmail,
		clientName,
		consultationDate,
		amount,
		bookingId,
		practitionerName,
		practitionerEmail,
		practitionerUserId,
		startTime,
		endTime
	}: {
		practitionerStripeAccountId: string
		clientEmail: string
		clientName: string
		consultationDate: string
		amount: number
		bookingId: string
		practitionerName: string
		practitionerEmail: string
		practitionerUserId: string
		startTime: string
		endTime: string
	}): Promise<{
		sessionId: string
		checkoutUrl: string
	}> {
		try {
			const session = await stripe.checkout.sessions.create({
				payment_method_types: ['card'],
				mode: 'payment',
				line_items: [
					{
						price_data: {
							currency: 'eur',
							product_data: {
								name: `Consulta con ${practitionerName}`,
								description: `Consulta programada para ${consultationDate}`
							},
							unit_amount: Math.round(amount * 100) // Convert to cents
						},
						quantity: 1
					}
				],
				customer_email: clientEmail,
				metadata: {
					booking_id: bookingId,
					consultation_date: consultationDate,
					client_name: clientName,
					practitioner_name: practitionerName,
					practitioner_email: practitionerEmail,
					practitioner_user_id: practitionerUserId,
					start_time: startTime,
					end_time: endTime
				},
				success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success?booking_id=${bookingId}`,
				cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/cancelled`,
				payment_intent_data: {
					application_fee_amount: Math.round(amount * 100 * 0.0), // 5% platform fee
					on_behalf_of: practitionerStripeAccountId, // Fix for cross-region settlement
					transfer_data: {
						destination: practitionerStripeAccountId
					}
				}
			})

			return {
				sessionId: session.id,
				checkoutUrl: session.url || ''
			}
		} catch (error) {
			console.error('Error creating checkout session:', error)
			throw new Error(
				`Failed to create checkout session: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`
			)
		}
	}

	/**
	 * Expires a Stripe checkout session to prevent payment completion
	 *
	 * Note: Stripe checkout sessions automatically expire after 24 hours,
	 * but we can manually expire them to immediately invalidate payment links.
	 * This is useful when a booking is cancelled before payment is completed.
	 */
	async expireCheckoutSession(sessionId: string): Promise<{
		success: boolean
		error?: string
	}> {
		try {
			await stripe.checkout.sessions.expire(sessionId)

			return {
				success: true
			}
		} catch (error) {
			console.error('Error expiring checkout session:', error)
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		}
	}

	/**
	 * Process a full refund for a consultation payment
	 *
	 * This method creates a full refund for a payment intent.
	 * For consultation bookings, we only support full refunds to keep things simple.
	 * The refund will be processed back to the original payment method.
	 *
	 * @param paymentIntentId - The Stripe payment intent ID to refund
	 * @param reason - Optional reason for the refund (for Stripe records)
	 * @param bookingId - The booking ID for metadata tracking
	 * @returns Promise with refund result containing Stripe refund ID
	 */
	async processRefund(
		paymentIntentId: string,
		reason?: string,
		bookingId?: string
	): Promise<{
		success: boolean
		refundId?: string
		error?: string
	}> {
		try {
			// Create full refund in Stripe
			const refund = await stripe.refunds.create({
				payment_intent: paymentIntentId,
				reason: (reason as any) || 'requested_by_customer',
				metadata: {
					booking_id: bookingId || '',
					refund_reason: reason || 'Full refund requested'
				}
			})

			return {
				success: true,
				refundId: refund.id
			}
		} catch (error) {
			console.error('Error processing refund:', error)
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		}
	}
}

// Export a singleton instance
export const stripeService = new StripeService()
