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
		practitionerName
	}: {
		practitionerStripeAccountId: string
		clientEmail: string
		clientName: string
		consultationDate: string
		amount: number
		bookingId: string
		practitionerName: string
	}): Promise<string> {
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
					practitioner_name: practitionerName
				},
				success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/cancelled`,
				payment_intent_data: {
					application_fee_amount: Math.round(amount * 100 * 0.0), // 5% platform fee
					on_behalf_of: practitionerStripeAccountId, // Fix for cross-region settlement
					transfer_data: {
						destination: practitionerStripeAccountId
					}
				}
			})

			return session.url || ''
		} catch (error) {
			console.error('Error creating checkout session:', error)
			throw new Error(
				`Failed to create checkout session: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`
			)
		}
	}
}

// Export a singleton instance
export const stripeService = new StripeService()
