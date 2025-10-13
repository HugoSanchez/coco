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
	 * Create checkout session for an invoice (can include multiple appointments)
	 */
	async createInvoiceCheckout({
		practitionerStripeAccountId,
		clientEmail,
		clientName,
		practitionerName,
		practitionerEmail,
		practitionerUserId,
		invoiceId,
		currency = 'EUR',
		billingPeriodStart,
		billingPeriodEnd,
		lineItems
	}: {
		practitionerStripeAccountId: string
		clientEmail?: string
		clientName?: string
		practitionerName: string
		practitionerEmail: string
		practitionerUserId: string
		invoiceId: string
		currency?: string
		billingPeriodStart?: string | null
		billingPeriodEnd?: string | null
		lineItems: Array<{
			name: string
			description?: string | null
			unitAmountEur: number
			quantity: number
		}>
	}): Promise<{ sessionId: string; checkoutUrl: string }> {
		try {
			const totalCents = lineItems.reduce((acc, li) => acc + Math.round(li.unitAmountEur * 100) * li.quantity, 0)
			const idempotencyKey = `invoice:${invoiceId}:${totalCents}:${lineItems.length}`

			const session = await stripe.checkout.sessions.create(
				{
					payment_method_types: ['card'],
					mode: 'payment',
					line_items: lineItems.map((li) => ({
						price_data: {
							currency: (currency || 'EUR').toLowerCase(),
							product_data: {
								name: li.name,
								description: li.description || undefined
							},
							unit_amount: Math.round(li.unitAmountEur * 100)
						},
						quantity: li.quantity
					})),
					customer_email: clientEmail && clientEmail.trim() ? clientEmail.trim() : undefined,
					metadata: {
						invoice_id: invoiceId,
						client_name: clientName || '',
						practitioner_name: practitionerName,
						practitioner_email: practitionerEmail,
						practitioner_user_id: practitionerUserId,
						billing_period_start: billingPeriodStart || '',
						billing_period_end: billingPeriodEnd || ''
					},
					success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success?invoice_id=${invoiceId}`,
					cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/cancelled`,
					payment_intent_data: {
						application_fee_amount: Math.round(totalCents * 0.0)
					}
				},
				{ idempotencyKey, stripeAccount: practitionerStripeAccountId }
			)

			return {
				sessionId: session.id,
				checkoutUrl: session.url || ''
			}
		} catch (error) {
			console.error('Error creating invoice checkout session:', error)
			Sentry.captureException(error, {
				tags: { component: 'stripe-service', method: 'createInvoiceCheckout' }
			})
			throw new Error(
				`Failed to create invoice checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
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
				charges_enabled && payouts_enabled && details_submitted && requirements_due.length === 0

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
			// Use Stripe idempotency to deduplicate near-simultaneous creates
			// Rationale:
			// - Emails/link scanners or multi-device opens can hit our payments route twice.
			// - An idempotency key ensures Stripe returns the same checkout session
			//   for identical inputs instead of creating duplicates.
			// - We derive the key from stable inputs so genuine changes (price/time)
			//   naturally create a new session with a different key.
			const idempotencyKey = `booking:${bookingId}:${Math.round(amount * 100)}:${startTime}:${endTime}`

			const session = await stripe.checkout.sessions.create(
				{
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
					// Direct charges: collect platform fee via application_fee_amount
					// No transfer_data/on_behalf_of here; charge is created on the connected account
					payment_intent_data: {
						application_fee_amount: Math.round(amount * 100 * 0.0)
					}
				},
				// Create session on connected (practitioner) account and keep idempotent
				{ idempotencyKey, stripeAccount: practitionerStripeAccountId }
			)

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
				`Failed to create checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`
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
		bookingId?: string,
		practitionerStripeAccountId?: string
	): Promise<{
		success: boolean
		refundId?: string
		error?: string
	}> {
		try {
			// First attempt: on the connected account (direct charges)
			// If the PI lives on the platform (legacy destination charge), Stripe
			// will throw a resource_missing error and we retry without the header.
			let refund
			try {
				refund = await stripe.refunds.create(
					{
						payment_intent: paymentIntentId,
						reason: (reason as any) || 'requested_by_customer',
						metadata: {
							booking_id: bookingId || '',
							refund_reason: reason || 'Full refund requested'
						}
					},
					practitionerStripeAccountId ? { stripeAccount: practitionerStripeAccountId } : undefined
				)
			} catch (err: any) {
				const isDirectAttempt = Boolean(practitionerStripeAccountId)
				const isMissing =
					err?.code === 'resource_missing' || err?.raw?.code === 'resource_missing' || err?.statusCode === 404
				if (isDirectAttempt && isMissing) {
					// Fallback: try on platform account for legacy charges
					refund = await stripe.refunds.create({
						payment_intent: paymentIntentId,
						reason: (reason as any) || 'requested_by_customer',
						metadata: {
							booking_id: bookingId || '',
							refund_reason: reason || 'Full refund requested'
						}
					})
				} else {
					throw err
				}
			}

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
