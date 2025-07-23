import { NextRequest, NextResponse } from 'next/server'
import {
	getStripeAccountByUserId,
	updateStripeAccountStatus
} from '@/lib/db/stripe-accounts'
import { stripeService } from '@/lib/payments/stripe-service'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since this route processes redirects
export const dynamic = 'force-dynamic'

/**
 * GET /api/payments/onboarding-callback
 *
 * Handles the callback from Stripe after onboarding completion.
 * This route is called when Stripe redirects the user back to our app
 * after they complete (or attempt to complete) the onboarding process.
 *
 * Flow:
 * 1. Extract user_id from query parameters (passed via return URL)
 * 2. Validate the user exists and has a Stripe account
 * 3. Check real Stripe account status via API
 * 4. Update database based on actual capabilities
 * 5. Redirect to appropriate onboarding step with status
 *
 * This ensures we only mark onboarding as complete when Stripe
 * confirms the account is truly ready to accept payments.
 */
export async function GET(request: NextRequest) {
	try {
		console.log('=== STRIPE ONBOARDING CALLBACK CALLED ===')
		console.log('Request URL:', request.url)

		const searchParams = request.nextUrl.searchParams
		const userId = searchParams.get('user_id')
		console.log('Extracted user_id:', userId)

		// Step 1: Validate user_id parameter
		if (!userId) {
			console.error('Missing user_id parameter in onboarding callback')
			return NextResponse.redirect(
				new URL(
					'/onboarding?step=4&stripe_error=missing_user',
					request.url
				)
			)
		}

		// Step 2: Create Supabase client and validate user has a Stripe account
		const supabase = createClient()
		const stripeAccount = await getStripeAccountByUserId(userId, supabase)

		if (!stripeAccount) {
			console.error(`No Stripe account found for user ${userId}`)
			return NextResponse.redirect(
				new URL(
					'/onboarding?step=4&stripe_error=no_account',
					request.url
				)
			)
		}

		// Step 3: Check real Stripe account status via API
		console.log(
			`Checking Stripe status for account: ${stripeAccount.stripe_account_id}`
		)

		const stripeStatus = await stripeService.getAccountStatus(
			stripeAccount.stripe_account_id
		)

		if (!stripeStatus.success) {
			console.error(
				'Failed to get Stripe account status:',
				stripeStatus.error
			)
			return NextResponse.redirect(
				new URL(
					'/onboarding?step=4&stripe_error=status_check_failed',
					request.url
				)
			)
		}

		// Step 4: Determine if account is ready for payments and why it might not be
		const isReadyForPayments = stripeStatus.paymentsEnabled

		console.log(
			`Stripe account ${stripeAccount.stripe_account_id} ready for payments: ${isReadyForPayments}`
		)

		if (stripeStatus.details) {
			console.log('Stripe account details:', {
				charges_enabled: stripeStatus.details.charges_enabled,
				payouts_enabled: stripeStatus.details.payouts_enabled,
				details_submitted: stripeStatus.details.details_submitted,
				requirements_due: stripeStatus.details.requirements_due.length
			})
		}

		// Step 4.5: Update database with real Stripe account status
		try {
			await updateStripeAccountStatus(
				userId,
				{
					onboarding_completed: true, // User went through onboarding flow
					payments_enabled: isReadyForPayments // Based on actual Stripe capabilities
				},
				supabase
			)
			console.log(
				`Updated database: onboarding_completed=true, payments_enabled=${isReadyForPayments}`
			)
		} catch (dbError) {
			console.error(
				'Failed to update Stripe account status in database:',
				dbError
			)
			// Don't fail the entire flow if database update fails
			// User can still proceed, but we'll log the issue
		}

		// Step 5: Redirect based on account readiness with specific reason
		if (isReadyForPayments) {
			// Account is fully ready - proceed to next onboarding step
			return NextResponse.redirect(
				new URL('/onboarding?step=5&stripe_ready=true', request.url)
			)
		} else {
			// Account needs more setup - determine specific reason
			let reason = 'incomplete'

			if (stripeStatus.details) {
				const {
					charges_enabled,
					payouts_enabled,
					details_submitted,
					requirements_due
				} = stripeStatus.details

				if (!details_submitted) {
					// User hasn't completed the onboarding form
					reason = 'form_incomplete'
				} else if (requirements_due.length > 0) {
					// User completed form but has outstanding requirements (verification docs, etc.)
					reason = 'verification_needed'
				} else if (!charges_enabled) {
					// Form complete, no requirements, but charges not enabled
					reason = 'charges_disabled'
				} else if (!payouts_enabled) {
					// Can accept charges but can't receive payouts (bank verification pending)
					reason = 'payouts_disabled'
				}

				console.log(`Stripe account not ready. Reason: ${reason}`, {
					details_submitted,
					requirements_due: requirements_due.length,
					charges_enabled,
					payouts_enabled
				})
			}

			// Redirect with specific reason for better user messaging
			return NextResponse.redirect(
				new URL(
					`/onboarding?step=4&stripe_incomplete=true&reason=${reason}`,
					request.url
				)
			)
		}
	} catch (error) {
		console.error('Error in Stripe onboarding callback:', error)

		// Log the specific error details for debugging
		if (error instanceof Error) {
			console.error('Error message:', error.message)
			console.error('Error stack:', error.stack)
		}

		// Redirect to error state if something goes wrong
		return NextResponse.redirect(
			new URL(
				'/onboarding?step=4&stripe_error=callback_failed',
				request.url
			)
		)
	}
}
