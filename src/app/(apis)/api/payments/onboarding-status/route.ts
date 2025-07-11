import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeAccountByUserId } from '@/lib/db/stripe-accounts'

/**
 * GET /api/payments/onboarding-status
 *
 * Checks the current Stripe onboarding status for the authenticated practitioner.
 * This endpoint is used by the frontend to determine what stage of payment setup
 * the user is in and show appropriate UI (create account, complete onboarding, etc).
 *
 * Flow:
 * 1. Authenticates the practitioner
 * 2. Retrieves their Stripe account information from database
 * 3. Returns comprehensive status including:
 *    - Whether they have a Stripe account
 *    - Whether onboarding is completed
 *    - Whether payments are enabled
 *    - Their Stripe account ID (if exists)
 *
 * Frontend uses this data to:
 * - Show "Create Stripe Account" button if no account exists
 * - Show "Complete Onboarding" if account exists but not onboarded
 * - Show "Ready for Payments" if fully set up
 */
export async function GET() {
	try {
		const supabase = createClient()

		// Step 1: Authenticate the practitioner
		// Only authenticated users can check their onboarding status
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()
		if (authError || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Step 2: Retrieve Stripe account information from database
		// This will be null if user hasn't created a Stripe account yet
		const stripeAccount = await getStripeAccountByUserId(user.id, supabase)

		// Step 3: Return comprehensive onboarding status
		// Frontend uses these flags to determine what UI to show
		return NextResponse.json({
			has_stripe_account: !!stripeAccount, // Boolean: Account exists
			onboarding_completed: stripeAccount?.onboarding_completed || false, // Boolean: Verification complete
			payments_enabled: stripeAccount?.payments_enabled || false, // Boolean: Ready to receive payments
			stripe_account_id: stripeAccount?.stripe_account_id || null // String: Stripe account ID (or null)
		})
	} catch (error) {
		// Catch any errors from authentication or database operations
		console.error('Error checking onboarding status:', error)
		return NextResponse.json(
			{
				error: 'Internal server error',
				details:
					error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
