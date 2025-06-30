import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripeService } from '@/lib/payments/stripe-service'

export async function GET() {
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

		console.log('🧪 Testing payment link generation for user:', user.id)

		// Get user's Stripe account
		const { data: stripeAccount, error: stripeError } = await supabase
			.from('stripe_accounts')
			.select('stripe_account_id, onboarding_completed, payments_enabled')
			.eq('user_id', user.id)
			.single()

		if (stripeError || !stripeAccount) {
			return NextResponse.json(
				{
					error: 'No Stripe account found. Please complete Stripe onboarding first.',
					help: 'Go to /onboarding and complete the payments setup step.'
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
					error: 'Stripe account not ready for payments.',
					account_status: {
						onboarding_completed:
							stripeAccount.onboarding_completed,
						payments_enabled: stripeAccount.payments_enabled
					},
					help: 'Complete your Stripe onboarding first.'
				},
				{ status: 400 }
			)
		}

		// Test data for checkout session
		const testData = {
			practitionerStripeAccountId: stripeAccount.stripe_account_id,
			clientEmail: 'test@example.com',
			clientName: 'Hugo Test Client',
			consultationDate: '2025-01-20',
			amount: 80,
			bookingId: 'test-booking-123',
			practitionerName: 'Dr. Test Practitioner'
		}

		console.log('💳 Creating test checkout session with data:', testData)

		// Create test checkout session
		const checkoutUrl =
			await stripeService.createConsultationCheckout(testData)

		console.log('✅ Test checkout session created:', checkoutUrl)

		return NextResponse.json({
			success: true,
			message: 'Payment link generated successfully!',
			checkoutUrl,
			testData,
			stripe_account: {
				id: stripeAccount.stripe_account_id,
				onboarding_completed: stripeAccount.onboarding_completed,
				payments_enabled: stripeAccount.payments_enabled
			},
			instructions:
				'Click the checkout URL to test the payment flow in Stripe.'
		})
	} catch (error) {
		console.error('❌ Test payment error:', error)
		return NextResponse.json(
			{
				error: 'Test failed',
				details:
					error instanceof Error ? error.message : 'Unknown error',
				help: 'Check server console for detailed error logs.'
			},
			{ status: 500 }
		)
	}
}
