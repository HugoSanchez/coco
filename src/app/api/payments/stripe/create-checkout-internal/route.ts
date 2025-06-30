import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripeService } from '@/lib/payments/stripe-service'

// Use service role client for admin operations
const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Internal-only endpoint for creating Stripe checkout sessions
 *
 * SECURITY: This endpoint should only be called by server-to-server code.
 * It bypasses user authentication and uses service role permissions.
 *
 * Used by: /api/billing/consultation and other internal billing processes
 */
export async function POST(request: NextRequest) {
	try {
		// Security check: Verify this is a server-to-server call
		const authHeader = request.headers.get('authorization')
		const expectedToken = process.env.SUPABASE_SERVICE_ROLE_KEY

		if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
			return NextResponse.json(
				{ error: 'Unauthorized - Internal use only' },
				{ status: 401 }
			)
		}

		// Parse request body
		const {
			userId,
			bookingId,
			clientEmail,
			clientName,
			consultationDate,
			amount,
			practitionerName
		} = await request.json()

		// Validate required fields
		if (
			!userId ||
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

		// Get practitioner's Stripe account (using service role)
		const { data: stripeAccount, error: stripeError } = await supabase
			.from('stripe_accounts')
			.select('stripe_account_id, onboarding_completed, payments_enabled')
			.eq('user_id', userId)
			.single()

		if (stripeError || !stripeAccount) {
			return NextResponse.json(
				{ error: 'Stripe account not found for practitioner' },
				{ status: 400 }
			)
		}

		if (
			!stripeAccount.onboarding_completed ||
			!stripeAccount.payments_enabled
		) {
			return NextResponse.json(
				{ error: 'Stripe account not ready for payments' },
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

		// Extract session ID from checkout URL
		const sessionIdMatch = checkoutUrl.match(/\/cs_[^?]+/)
		const stripeSessionId = sessionIdMatch
			? sessionIdMatch[0].substring(1)
			: null

		// Save payment session to database
		if (stripeSessionId) {
			const { error: insertError } = await supabase
				.from('payment_sessions')
				.insert({
					booking_id: bookingId,
					stripe_session_id: stripeSessionId,
					amount: amount,
					status: 'pending'
				})

			if (insertError) {
				console.error('Failed to save payment session:', insertError)
				// Continue anyway - don't fail the checkout creation
			} else {
				console.log('✅ Payment session saved:', stripeSessionId)
			}
		}

		return NextResponse.json({
			success: true,
			checkoutUrl,
			bookingId
		})
	} catch (error) {
		console.error('Error creating internal checkout session:', error)
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
