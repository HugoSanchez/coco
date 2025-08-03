import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/db/bookings'
import { getBillsForBooking } from '@/lib/db/bills'
import { getClientById } from '@/lib/db/clients'
import { getProfileById } from '@/lib/db/profiles'
import { paymentOrchestrationService } from '@/lib/payments/payment-orchestration-service'

/**
 * GET /api/payments/[bookingId]
 *
 * Payment Gateway Endpoint - Single entry point for all payment flows
 *
 * This endpoint replaces direct Stripe checkout URLs in emails with a validation layer.
 * It ensures that every payment attempt gets a fresh, valid checkout session.
 *
 *
 * Flow:
 * 1. Validate booking exists and is in a payable state
 * 2. Validate associated bill exists and requires payment
 * 3. Create a fresh Stripe checkout session
 * 4. Auto-redirect user to Stripe checkout
 * 5. Handle errors with user-friendly messages
 *
 * Benefits:
 * - Always fresh checkout sessions (no expiration issues)
 * - Prevents payments on invalid/completed bookings
 * - Centralized error handling
 * - Simplified email URLs
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: { bookingId: string } }
) {
	try {
		// Use service role client to bypass RLS for payment operations
		// Payment links are accessed by clients (not authenticated users)
		const supabase = createServiceRoleClient()
		// Get bookingId from params
		const bookingId = params.bookingId

		// ------------------------------------------------------------
		// Step 1: Fetch booking details from DB.
		// ------------------------------------------------------------
		const booking = await getBookingById(bookingId, supabase)
		// If booking not found, redirect to error page
		if (!booking) {
			return NextResponse.redirect(
				new URL(`/payment/error?reason=booking_not_found`, request.url)
			)
		}

		// ------------------------------------------------------------
		// Step 2: Validate booking is in a payable state
		// ------------------------------------------------------------
		if (booking.status === 'canceled') {
			return NextResponse.redirect(
				new URL(`/payment/error?reason=booking_canceled`, request.url)
			)
		}

		// ------------------------------------------------------------
		// Step 3: Fetch and validate bill information
		// ------------------------------------------------------------
		const bills = await getBillsForBooking(bookingId, supabase)
		const payableBill = bills.find(
			(bill) => bill.status === 'pending' || bill.status === 'sent'
		)

		if (!payableBill) {
			return NextResponse.redirect(
				new URL(`/payment/success?booking_id=${bookingId}`, request.url)
			)
		}

		// -----------------------------------------------------------------------------
		// Step 4: Fetch required data and validate all fields for checkout creation
		// -----------------------------------------------------------------------------
		const [client, practitioner] = await Promise.all([
			getClientById(booking.client_id, supabase),
			getProfileById(booking.user_id, supabase)
		])

		// Validate all required data for checkout creation
		if (
			!client ||
			!practitioner ||
			!client.email ||
			!client.name ||
			!booking.start_time
		) {
			return NextResponse.redirect(
				new URL(`/payment/error?reason=missing_data`, request.url)
			)
		}

		// -----------------------------------------------------------------------------
		// Step 5: Create fresh Stripe checkout session
		// -----------------------------------------------------------------------------
		const paymentResult =
			await paymentOrchestrationService.orechestrateConsultationCheckout({
				userId: booking.user_id,
				bookingId: bookingId,
				clientEmail: client.email,
				clientName: client.name,
				consultationDate: booking.start_time,
				amount: payableBill.amount,
				practitionerName: practitioner.name || 'Your Practitioner',
				supabaseClient: supabase
			})

		if (!paymentResult.success || !paymentResult.checkoutUrl) {
			console.error(
				`Failed to create checkout session: ${paymentResult.error}`
			)
			return NextResponse.redirect(
				new URL(
					`/payment/error?reason=checkout_creation_failed`,
					request.url
				)
			)
		}

		// -----------------------------------------------------------------------------
		// Step 6: Auto-redirect to Stripe checkout
		// -----------------------------------------------------------------------------
		return NextResponse.redirect(paymentResult.checkoutUrl)
	} catch (error) {
		// -----------------------------------------------------------------------------
		// Step 7: Handle unexpected errors
		// -----------------------------------------------------------------------------
		console.error('Payment gateway error:', error)
		return NextResponse.redirect(
			new URL(`/payment/error?reason=server_error`, request.url)
		)
	}
}
