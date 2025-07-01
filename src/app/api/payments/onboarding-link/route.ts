import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripeService } from '@/lib/payments/stripe-service'

export async function POST(request: NextRequest) {
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

		// Get user's Stripe account
		const { data: stripeAccount, error: accountError } = await supabase
			.from('stripe_accounts')
			.select('*')
			.eq('user_id', user.id)
			.single()

		if (accountError || !stripeAccount) {
			return NextResponse.json(
				{ error: 'No Stripe account found. Please create one first.' },
				{ status: 404 }
			)
		}

		// If onboarding is already completed, return error
		if (stripeAccount.onboarding_completed) {
			return NextResponse.json(
				{ error: 'Onboarding already completed' },
				{ status: 400 }
			)
		}

		// Get the current URL for return/refresh URLs
		const origin = request.headers.get('origin') || 'http://localhost:3000'
		const returnUrl = `${origin}/onboarding?step=4&stripe_onboarding=success`
		const refreshUrl = `${origin}/onboarding?step=4&stripe_onboarding=refresh`

		// Create onboarding link
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

		return NextResponse.json({
			success: true,
			url: result.url,
			message: 'Onboarding link created successfully'
		})
	} catch (error) {
		console.error('Error creating onboarding link:', error)

		// Log more details about the error
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
