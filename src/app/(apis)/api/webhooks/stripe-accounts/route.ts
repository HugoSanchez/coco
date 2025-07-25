import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { updateStripeAccountStatus } from '@/lib/db/stripe-accounts'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: '2025-05-28.basil'
})

// You'll need to add this to your .env.local - get it from Stripe Dashboard
const webhookSecret = process.env.STRIPE_ACCOUNTS_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
	console.log('Received Stripe account webhook')
	try {
		const body = await request.text()
		const headersList = headers()
		const signature = headersList.get('stripe-signature')

		if (!signature) {
			console.error('Missing Stripe signature')
			return NextResponse.json(
				{ error: 'Missing signature' },
				{ status: 400 }
			)
		}

		// Verify webhook signature
		let event: Stripe.Event
		try {
			event = stripe.webhooks.constructEvent(
				body,
				signature,
				webhookSecret
			)
		} catch (err: any) {
			console.error('Webhook signature verification failed:', err.message)
			return NextResponse.json(
				{ error: 'Webhook signature verification failed' },
				{ status: 400 }
			)
		}

		// Handle different account events
		switch (event.type) {
			case 'account.updated':
				await handleAccountUpdated(event)
				break

			case 'account.application.authorized':
				await handleAccountAuthorized(event)
				break

			case 'account.application.deauthorized':
				await handleAccountDeauthorized(event)
				break

			default:
				console.log(`Unhandled account event type: ${event.type}`)
		}

		return NextResponse.json({ received: true })
	} catch (error) {
		console.error('Webhook error:', error)
		return NextResponse.json(
			{ error: 'Webhook handler failed' },
			{ status: 500 }
		)
	}
}

/**
 * Handle account.updated events
 * This fires when account capabilities, verification status, or other details change
 */
async function handleAccountUpdated(event: Stripe.Event) {
	const account = event.data.object as Stripe.Account

	// Determine if account is ready for payments
	const isReadyForPayments =
		account.charges_enabled &&
		account.payouts_enabled &&
		account.details_submitted &&
		(account.requirements?.currently_due?.length || 0) === 0

	try {
		// Update our database with the new status - use service role for webhooks
		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.SUPABASE_SERVICE_ROLE_KEY!
		)

		// Find the user associated with this Stripe account
		const { data: stripeAccountRecord, error: findError } = await supabase
			.from('stripe_accounts')
			.select('user_id')
			.eq('stripe_account_id', account.id)
			.single()

		if (findError || !stripeAccountRecord) {
			console.error(
				`No user found for Stripe account ${account.id}:`,
				findError
			)
			return
		}

		// Only update database if account is now ready for payments
		// Don't spam the DB with updates for every partial completion step
		if (isReadyForPayments) {
			await updateStripeAccountStatus(
				stripeAccountRecord.user_id,
				{
					onboarding_completed: true,
					payments_enabled: true
				},
				supabase
			)

			console.log(
				`Stripe account ready for user ${stripeAccountRecord.user_id}`
			)
		}
	} catch (error) {
		console.error('Error updating database from webhook:', error)
		// Don't throw - we don't want to fail the webhook delivery
	}
}

/**
 * Handle account.application.authorized events
 * This fires when a Connect account is first authorized
 */
async function handleAccountAuthorized(event: Stripe.Event) {
	// Account authorized - account.updated will handle the status updates
}

/**
 * Handle account.application.deauthorized events
 * This fires when a Connect account is disconnected
 */
async function handleAccountDeauthorized(event: Stripe.Event) {
	const account = event.data.object as Stripe.Account

	try {
		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.SUPABASE_SERVICE_ROLE_KEY!
		)

		// Find and disable the account in our database
		const { data: stripeAccountRecord, error: findError } = await supabase
			.from('stripe_accounts')
			.select('user_id')
			.eq('stripe_account_id', account.id)
			.single()

		if (findError || !stripeAccountRecord) {
			console.error(
				`No user found for deauthorized Stripe account ${account.id}:`,
				findError
			)
			return
		}

		// Disable payments for this account
		await updateStripeAccountStatus(
			stripeAccountRecord.user_id,
			{
				onboarding_completed: false,
				payments_enabled: false
			},
			supabase
		)
	} catch (error) {
		console.error('Error handling account deauthorization:', error)
	}
}
