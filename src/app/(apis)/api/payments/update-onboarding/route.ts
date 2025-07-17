import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncStripeAccountStatus } from '@/lib/db/stripe-accounts'

// Force dynamic rendering since this page uses useSearchParams
export const dynamic = 'force-dynamic'
/**
 * POST /api/payments/update-onboarding
 *
 * Syncs a practitioner's Stripe account status with the actual Stripe account capabilities.
 * This endpoint is called after the user returns from Stripe's onboarding flow
 * to update their account status based on real-time Stripe API data.
 *
 * Flow:
 * 1. Authenticates the practitioner
 * 2. Calls Stripe API to check actual account status and capabilities
 * 3. Updates database with onboarding_completed and payments_enabled flags
 * 4. Returns success confirmation with account status
 *
 * This ensures the database accurately reflects the actual Stripe account capabilities,
 * preventing issues where onboarding appears complete but payments are not yet enabled.
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

		// Step 2: Sync Stripe account status with actual Stripe capabilities
		// This calls the Stripe API to check real account status and updates both database flags
		const updatedAccount = await syncStripeAccountStatus(user.id, supabase)

		// Step 3: Return success confirmation with account status
		return NextResponse.json({
			success: true,
			message: 'Onboarding status synced successfully',
			account: {
				onboarding_completed: updatedAccount.onboarding_completed,
				payments_enabled: updatedAccount.payments_enabled
			}
		})
	} catch (error) {
		// Catch any errors from authentication, Stripe API, or database operations
		console.error('Error syncing onboarding status:', error)
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
