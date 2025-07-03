import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paymentOrchestrationService } from '@/lib/payments/payment-orchestration-service'
import { sendConsultationBillEmail } from '@/lib/emails/email-service'
import { getClientById } from '@/lib/db/clients'
import { getProfileById } from '@/lib/db/profiles'
import { updateBillStatus } from '@/lib/db/bills'

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

		console.log('🔍 [DEBUG] Auth result:', {
			user: user ? { id: user.id, email: user.email } : null,
			authError: authError?.message
		})

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

		console.log('🔍 [DEBUG] Request payload:', {
			bookingId,
			clientEmail,
			clientName,
			consultationDate,
			amount,
			practitionerName,
			userId: user.id
		})

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
		console.log(
			'🔍 [DEBUG] Calling payment orchestration with userId:',
			user.id
		)

		// TEMPORARY DEBUG: Let's see all stripe accounts
		const { data: allAccounts } = await supabase
			.from('stripe_accounts')
			.select(
				'user_id, stripe_account_id, onboarding_completed, payments_enabled'
			)

		console.log('🔍 [DEBUG] All stripe accounts in DB:', allAccounts)
		console.log('🔍 [DEBUG] Looking for user_id:', user.id)

		// DIRECT TEST: Try querying stripe_accounts directly from API context
		const { data: directTest, error: directError } = await supabase
			.from('stripe_accounts')
			.select('*')
			.eq('user_id', user.id)

		console.log('🔍 [DEBUG] Direct query from API route:', {
			directTest,
			directError
		})

		const result =
			await paymentOrchestrationService.orechestrateConsultationCheckout({
				userId: user.id,
				bookingId,
				clientEmail,
				clientName,
				consultationDate,
				amount,
				practitionerName,
				supabaseClient: supabase
			})

		console.log('🔍 [DEBUG] Payment orchestration result:', result)

		// Step 5: Handle result from orchestration service
		if (!result.success) {
			console.log(
				'🔍 [DEBUG] Payment orchestration failed:',
				result.error
			)
			return NextResponse.json({ error: result.error }, { status: 400 })
		}

		// Step 6: Send consultation bill email with payment link
		if (result.checkoutUrl) {
			try {
				// Get practitioner info for email
				const practitioner = await getProfileById(user.id)

				if (practitioner) {
					const emailResult = await sendConsultationBillEmail({
						to: clientEmail,
						clientName: clientName,
						consultationDate,
						amount,
						billingTrigger: 'before_consultation',
						practitionerName:
							practitioner.name || 'Your Practitioner',
						practitionerEmail: practitioner.email,
						practitionerImageUrl:
							practitioner.profile_picture_url || undefined,
						paymentUrl: result.checkoutUrl
					})

					if (emailResult.success) {
						// Find and update bill status to 'sent'
						const { data: bill } = await supabase
							.from('bills')
							.select('id')
							.eq('booking_id', bookingId)
							.single()

						if (bill) {
							await updateBillStatus(bill.id, 'sent')
							console.log(
								'✅ [EMAIL] Bill email sent and status updated to sent'
							)
						}
					} else {
						console.error(
							'❌ [EMAIL] Failed to send bill email:',
							emailResult.error
						)
					}
				}
			} catch (emailError) {
				console.error('❌ [EMAIL] Error in email flow:', emailError)
				// Don't fail the entire request if email fails
			}
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
