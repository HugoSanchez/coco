import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripeService } from '@/lib/payments/stripe-service'

export async function POST(request: NextRequest) {
	try {
		const supabase = createClient()

		// Get authenticated user
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()

		if (authError || !user) {
			return NextResponse.json(
				{ error: 'Authentication required' },
				{ status: 401 }
			)
		}

		// Parse request body
		const {
			bookingId,
			clientEmail,
			clientName,
			consultationDate,
			amount,
			practitionerName
		} = await request.json()

		// Validate required fields
		if (
			!bookingId ||
			!clientEmail ||
			!clientName ||
			!consultationDate ||
			!amount ||
			!practitionerName
		) {
			return NextResponse.json(
				{ error: 'Missing required fields' },
				{ status: 400 }
			)
		}

		// Get practitioner's Stripe account
		const { data: stripeAccount, error: stripeError } = await supabase
			.from('stripe_accounts')
			.select('stripe_account_id, onboarding_completed, payments_enabled')
			.eq('user_id', user.id)
			.single()

		if (stripeError || !stripeAccount) {
			return NextResponse.json(
				{
					error: 'Stripe account not found. Please complete onboarding first.'
				},
				{ status: 400 }
			)
		}

		if (
			!stripeAccount.onboarding_completed ||
			!stripeAccount.payments_enabled
		) {
			return NextResponse.json(
				{
					error: 'Stripe account not ready for payments. Please complete onboarding.'
				},
				{ status: 400 }
			)
		}

		// Create checkout session
		const checkoutUrl = await stripeService.createConsultationCheckout({
			practitionerStripeAccountId: stripeAccount.stripe_account_id,
			clientEmail,
			clientName,
			consultationDate,
			amount,
			bookingId,
			practitionerName
		})

		return NextResponse.json({
			success: true,
			checkoutUrl
		})
	} catch (error) {
		console.error('Error creating checkout session:', error)
		return NextResponse.json(
			{
				error: 'Failed to create checkout session',
				details:
					error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
