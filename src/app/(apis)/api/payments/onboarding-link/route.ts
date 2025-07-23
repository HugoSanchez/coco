import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripeService } from '@/lib/payments/stripe-service'
import { getStripeAccountByUserId } from '@/lib/db/stripe-accounts'

// Force dynamic rendering since this page uses useSearchParams
export const dynamic = 'force-dynamic'
/**
 * POST /api/payments/onboarding-link
 *
 * Creates a Stripe onboarding link for practitioners to complete their account setup.
 * This is the second step after creating a Stripe Connect account - users need to
 * complete Stripe's verification process before they can accept payments.
 *
 * Flow:
 * 1. Authenticates the practitioner
 * 2. Retrieves their existing Stripe account from database
 * 3. Validates onboarding hasn't already been completed
 * 4. Generates return/refresh URLs for the onboarding flow
 * 5. Creates Stripe onboarding link with proper redirects
 * 6. Returns onboarding URL for user to complete verification
 *
 * After completing onboarding, users return to the frontend which calls
 * the update-onboarding endpoint to mark their account as ready.
 */
export async function POST(request: NextRequest) {
	try {
		const supabase = createClient()

		// Step 1: Authenticate the practitioner
		// Only authenticated users can request onboarding links
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()
		if (authError || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Step 2: Retrieve practitioner's Stripe account from database
		// User must have created a Stripe account first
		const stripeAccount = await getStripeAccountByUserId(user.id, supabase)

		if (!stripeAccount) {
			return NextResponse.json(
				{ error: 'No Stripe account found. Please create one first.' },
				{ status: 404 }
			)
		}

		// Step 3: Validate onboarding hasn't already been completed
		// Prevent users from going through onboarding multiple times
		if (stripeAccount.onboarding_completed) {
			return NextResponse.json(
				{ error: 'Onboarding already completed' },
				{ status: 400 }
			)
		}

		// Step 4: Generate return and refresh URLs for onboarding flow
		// These URLs determine where Stripe redirects the user after onboarding
		// Include user_id parameter to identify the user when they return from Stripe
		const origin =
			request.headers.get('origin') ||
			process.env.NEXT_PUBLIC_BASE_URL ||
			'http://localhost:3000'
		const returnUrl = `${origin}/api/payments/onboarding-callback?user_id=${user.id}`
		const refreshUrl = `${origin}/api/payments/onboarding-callback?user_id=${user.id}`

		// Step 5: Create Stripe onboarding link
		// This generates a secure URL for the user to complete verification
		const result = await stripeService.createOnboardingLink(
			stripeAccount.stripe_account_id,
			returnUrl,
			refreshUrl
		)

		if (!result.success) {
			return NextResponse.json(
				{
					error: 'Failed to create onboarding link',
					details: result.error
				},
				{ status: 500 }
			)
		}

		// Return onboarding URL for user to complete verification
		return NextResponse.json({
			success: true,
			url: result.url,
			message: 'Onboarding link created successfully'
		})
	} catch (error) {
		// Catch any errors from auth, database operations, or Stripe API calls
		console.error('Error creating onboarding link:', error)

		// Log more details about the error for debugging
		if (error instanceof Error) {
			console.error('Error message:', error.message)
			console.error('Error stack:', error.stack)
		}

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
