import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paymentOrchestrationService } from '@/lib/payments/payment-orchestration-service'

/**
 * POST /api/payments/create-checkout
 *
 * Creates a Stripe checkout session for consultation payments.
 * This endpoint is called to create a checkout (payment link) for a consultation.
 *
 * Flow:
 * 1. Authenticates the practitioner (user making the request)
 * 2. Validates all required payment details are provided
 * 3. Uses payment orchestration service to handle the complete payment flow:
 *    - Validates practitioner's Stripe account is ready
 *    - Creates Stripe checkout session
 *    - Saves payment session to database for tracking
 * 4. Returns checkout URL for client to complete payment
 *
 * The payment goes directly to the practitioner's Stripe account.
 */
export async function POST(request: NextRequest) {
	try {
		const supabase = createClient()

		// Step 1: Authenticate the practitioner
		// Only authenticated practitioners can create checkout sessions
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

		// Step 2: Parse and validate required fields.
		// If any of the fields are missing, return an error.
		const {
			bookingId,
			clientEmail,
			clientName,
			consultationDate,
			amount,
			practitionerName
		} = await request.json()

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

		// Step 3: Create checkout session with payment orchestration
		// This handles Stripe account validation, checkout creation, and DB tracking
		const result =
			await paymentOrchestrationService.orechestrateConsultationCheckout({
				userId: user.id,
				bookingId,
				clientEmail,
				clientName,
				consultationDate,
				amount,
				practitionerName
			})

		// Step 5: Handle result from orchestration service
		if (!result.success) {
			return NextResponse.json({ error: result.error }, { status: 400 })
		}

		// Return checkout URL for client to complete payment
		return NextResponse.json({
			success: true,
			checkoutUrl: result.checkoutUrl
		})
	} catch (error) {
		// Catch any errors from auth, validation, or payment orchestration
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
