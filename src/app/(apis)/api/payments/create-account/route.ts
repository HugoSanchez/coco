import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripeService } from '@/lib/payments/stripe-service'
import { hasStripeAccount, createStripeAccount } from '@/lib/db/stripe-accounts'
import { getUserEmail } from '@/lib/db/profiles'

/**
 * POST /api/payments/create-account
 *
 * Creates a new Stripe Connect account for the authenticated user.
 * This is the first step in enabling payments - users need a Connect account
 * before they can accept payments for their consultations.
 *
 * Flow:
 * 1. Validates user is authenticated and has a profile
 * 2. Checks they don't already have a Stripe account
 * 3. Creates Stripe Connect account with their email
 * 4. Saves account details to our database
 *
 * Next steps after this: User completes Stripe onboarding via separate endpoint
 */
export async function POST() {
	try {
		// Step 1: Authenticate the user
		const supabase = createClient()

		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()
		if (authError || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Step 2: Get user's email from their profile
		const userEmail = await getUserEmail(user.id)

		if (!userEmail) {
			return NextResponse.json(
				{ error: 'Profile not found' },
				{ status: 404 }
			)
		}

		// Step 3: Check if user already has a Stripe account (prevent duplicates)
		// This is a security measure to prevent users from creating multiple accounts
		const userHasAccount = await hasStripeAccount(user.id)

		if (userHasAccount) {
			return NextResponse.json(
				{
					error: 'Stripe account already exists'
				},
				{ status: 400 }
			)
		}

		// Step 4: Create Stripe Connect account with Stripe
		// This creates the account but doesn't complete onboarding yet
		const result = await stripeService.createConnectAccount(userEmail)

		if (!result.success) {
			return NextResponse.json(
				{
					error: 'Failed to create Stripe account',
					details: result.error
				},
				{ status: 500 }
			)
		}

		// Step 5: Save Stripe account info to our database
		// Account starts in pending state - user must complete onboarding
		const stripeAccount = await createStripeAccount({
			user_id: user.id,
			stripe_account_id: result.accountId!,
			onboarding_completed: false, // Will be updated after onboarding
			payments_enabled: false // Will be enabled after verification
		})

		// Return success with account details
		// Frontend can now call /api/payments/onboarding-link to start onboarding
		return NextResponse.json({
			success: true,
			message: 'Stripe Connect account created successfully',
			accountId: result.accountId,
			stripeAccount
		})
	} catch (error) {
		// Catch any errors from auth, database operations, or Stripe API calls
		console.error('Error creating Stripe account:', error)

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
