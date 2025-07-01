import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
	try {
		const supabase = createClient()

		// Get current user
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()
		if (authError || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Check if user has a Stripe account and if onboarding is completed
		const { data: stripeAccount, error: accountError } = await supabase
			.from('stripe_accounts')
			.select('onboarding_completed, payments_enabled, stripe_account_id')
			.eq('user_id', user.id)
			.single()

		if (accountError && accountError.code !== 'PGRST116') {
			// PGRST116 is "not found" error, which is fine - just means no account yet
			console.error('Error checking onboarding status:', accountError)
			return NextResponse.json(
				{
					error: 'Failed to check onboarding status',
					details: accountError.message
				},
				{ status: 500 }
			)
		}

		return NextResponse.json({
			has_stripe_account: !!stripeAccount,
			onboarding_completed: stripeAccount?.onboarding_completed || false,
			payments_enabled: stripeAccount?.payments_enabled || false,
			stripe_account_id: stripeAccount?.stripe_account_id || null
		})
	} catch (error) {
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
