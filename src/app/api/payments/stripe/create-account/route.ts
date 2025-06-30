import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripeService } from '@/lib/payments/stripe-service'

export async function POST() {
	try {
		// Check if Stripe secret key is configured
		if (!process.env.STRIPE_SECRET_KEY) {
			console.error('STRIPE_SECRET_KEY is not configured')
			return NextResponse.json(
				{ error: 'Stripe is not configured' },
				{ status: 500 }
			)
		}

		const supabase = createClient()

		// Get current user
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()
		if (authError || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Get user profile to access email
		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('email')
			.eq('id', user.id)
			.single()

		if (profileError || !profile) {
			return NextResponse.json(
				{ error: 'Profile not found' },
				{ status: 404 }
			)
		}

		// Check if user already has a Stripe account
		const { data: existingAccount } = await supabase
			.from('stripe_accounts')
			.select('*')
			.eq('user_id', user.id)
			.single()

		if (existingAccount) {
			return NextResponse.json(
				{
					error: 'Stripe account already exists',
					accountId: existingAccount.stripe_account_id
				},
				{ status: 400 }
			)
		}

		// Create Stripe Connect account
		const result = await stripeService.createConnectAccount(profile.email)

		if (!result.success) {
			return NextResponse.json(
				{
					error: 'Failed to create Stripe account',
					details: result.error
				},
				{ status: 500 }
			)
		}

		// Save to database
		const { data: stripeAccount, error: dbError } = await supabase
			.from('stripe_accounts')
			.insert({
				user_id: user.id,
				stripe_account_id: result.accountId!,
				onboarding_completed: false,
				payments_enabled: false
			})
			.select()
			.single()

		if (dbError) {
			return NextResponse.json(
				{
					error: 'Failed to save account to database',
					details: dbError.message
				},
				{ status: 500 }
			)
		}

		return NextResponse.json({
			success: true,
			message: 'Stripe Connect account created successfully',
			accountId: result.accountId,
			stripeAccount
		})
	} catch (error) {
		console.error('Error creating Stripe account:', error)

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
