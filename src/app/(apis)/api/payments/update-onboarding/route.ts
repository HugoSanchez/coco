import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { markOnboardingCompleted } from '@/lib/db/stripe-accounts'

// Force dynamic rendering since this page uses useSearchParams
export const dynamic = 'force-dynamic'
/**
 * POST /api/payments/update-onboarding
 *
 * Marks a practitioner's Stripe onboarding as completed in our database.
 * This endpoint is called after the user returns from Stripe's onboarding flow
 * to update their account status and enable payment processing capabilities.
 *
 * Flow:
 * 1. Authenticates the practitioner
 * 2. Marks their Stripe account onboarding as completed in database
 * 3. Returns success confirmation
 *
 * This is typically called by the frontend when users return from Stripe
 * onboarding with a success status, allowing them to start accepting payments.
 * After this call, the onboarding-status endpoint will show onboarding_completed: true.
 */
export async function POST() {
	try {
		const supabase = createClient()

		// Step 1: Authenticate the practitioner
		// Only authenticated users can update their onboarding status
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()
		if (authError || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Step 2: Mark Stripe onboarding as completed in database
		// This enables the user to start accepting payments
		await markOnboardingCompleted(user.id, supabase)

		// Step 3: Return success confirmation
		return NextResponse.json({
			success: true,
			message: 'Onboarding status updated successfully'
		})
	} catch (error) {
		// Catch any errors from authentication or database operations
		console.error('Error updating onboarding status:', error)
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
