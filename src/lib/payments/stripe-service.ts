import Stripe from 'stripe'
import { SupabaseClient } from '@supabase/supabase-js'
import { format, parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import * as Sentry from '@sentry/nextjs'

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
			Sentry.captureException(error, {
				tags: {
					component: 'stripe-service',
					method: 'createConnectAccount'
				}
			})
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
			Sentry.captureException(error, {
				tags: {
					component: 'stripe-service',
					method: 'createOnboardingLink'
				}
			})
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		}
	}

	/**
	 * Get the real-time status of a Stripe Connect account
	 */
	async getAccountStatus(accountId: string): Promise<{
		success: boolean
		paymentsEnabled: boolean
		error?: string
		details?: {
			charges_enabled: boolean
			payouts_enabled: boolean
			details_submitted: boolean
			requirements_due: string[]
			account_type: string
		}
	}> {
		try {
			const account = await stripe.accounts.retrieve(accountId)
			const charges_enabled = account.charges_enabled || false
			const payouts_enabled = account.payouts_enabled || false
			const details_submitted = account.details_submitted || false
			const requirements_due = account.requirements?.currently_due || []
			const paymentsEnabled =
				charges_enabled &&
				payouts_enabled &&
				details_submitted &&
				requirements_due.length === 0

			return {
				success: true,
				paymentsEnabled,
				details: {
					charges_enabled,
					payouts_enabled,
					details_submitted,
					requirements_due,
					account_type: account.type || 'unknown'
				}
			}
		} catch (error) {
			console.error('Error fetching Stripe account status:', error)
			Sentry.captureException(error, {
				tags: {
					component: 'stripe-service',
					method: 'getAccountStatus'
				}
			})
			return {
				success: false,
				paymentsEnabled: false,
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
								description: `Consulta del ${formatInTimeZone(parseISO(consultationDate), 'Europe/Madrid', "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}h`
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
			Sentry.captureException(error, {
				tags: {
					component: 'stripe-service',
					method: 'createConsultationCheckout'
				}
			})
			throw new Error(
				`Failed to create checkout session: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`
			)
		}
	}

	/**
	 * Expires a Stripe checkout session to prevent payment completion
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
			Sentry.captureException(error, {
				tags: {
					component: 'stripe-service',
					method: 'expireCheckoutSession'
				}
			})
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		}
	}

	/**
	 * Process a full refund for a consultation payment
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
			Sentry.captureException(error, {
				tags: { component: 'stripe-service', method: 'processRefund' }
			})
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		}
	}

	/**
	 * Retrieve a Stripe checkout session by ID
	 */
	async retrieveCheckoutSession(sessionId: string): Promise<{
		success: boolean
		status?: string
		url?: string
		error?: string
	}> {
		try {
			const session = await stripe.checkout.sessions.retrieve(sessionId)
			return {
				success: true,
				status: (session.status as string) || undefined,
				url: (session.url as string) || undefined
			}
		} catch (error) {
			console.error('Error retrieving checkout session:', error)
			Sentry.captureException(error, {
				tags: {
					component: 'stripe-service',
					method: 'retrieveCheckoutSession'
				}
			})
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		}
	}
}

// Export a singleton instance
export const stripeService = new StripeService()
