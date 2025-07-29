import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
		const supabase = createClient()
		const bookingId = params.bookingId

		console.log(
			`[PAYMENT-GATEWAY] Processing payment request for booking: ${bookingId}`
		)

		// Step 1: Fetch booking details
		const booking = await getBookingById(bookingId, supabase)

		if (!booking) {
			console.log(`[PAYMENT-GATEWAY] Booking not found: ${bookingId}`)
			return NextResponse.redirect(
				new URL(`/payment/error?reason=booking_not_found`, request.url)
			)
		}

		// Step 2: Validate booking is in a payable state
		if (booking.status === 'canceled') {
			console.log(`[PAYMENT-GATEWAY] Booking is canceled: ${bookingId}`)
			return NextResponse.redirect(
				new URL(`/payment/error?reason=booking_canceled`, request.url)
			)
		}

		if (booking.status === 'completed') {
			console.log(
				`[PAYMENT-GATEWAY] Booking is already completed: ${bookingId}`
			)
			return NextResponse.redirect(
				new URL(`/payment/error?reason=booking_completed`, request.url)
			)
		}

		// Step 3: Fetch and validate bill information
		const bills = await getBillsForBooking(bookingId, supabase)
		const payableBill = bills.find(
			(bill) => bill.status === 'pending' || bill.status === 'sent'
		)

		if (!payableBill) {
			console.log(
				`[PAYMENT-GATEWAY] No payable bill found for booking: ${bookingId}`
			)
			return NextResponse.redirect(
				new URL(`/payment/error?reason=already_paid`, request.url)
			)
		}

		if (payableBill.amount <= 0) {
			console.log(
				`[PAYMENT-GATEWAY] Bill amount is zero for booking: ${bookingId}`
			)
			return NextResponse.redirect(
				new URL(
					`/payment/error?reason=no_payment_required`,
					request.url
				)
			)
		}

		// Step 4: Fetch required data for checkout session creation
		const [client, practitioner] = await Promise.all([
			getClientById(booking.client_id, supabase),
			getProfileById(booking.user_id, supabase)
		])

		if (!client || !practitioner) {
			console.log(
				`[PAYMENT-GATEWAY] Missing client or practitioner data for booking: ${bookingId}`
			)
			return NextResponse.redirect(
				new URL(`/payment/error?reason=missing_data`, request.url)
			)
		}

		// Step 5: Validate required fields for checkout creation
		if (!client.email || !client.name || !booking.start_time) {
			console.log(
				`[PAYMENT-GATEWAY] Missing required fields for booking: ${bookingId}`
			)
			return NextResponse.redirect(
				new URL(`/payment/error?reason=invalid_data`, request.url)
			)
		}

		// Step 6: Create fresh Stripe checkout session
		console.log(
			`[PAYMENT-GATEWAY] Creating checkout session for booking: ${bookingId}`
		)

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
				`[PAYMENT-GATEWAY] Failed to create checkout session: ${paymentResult.error}`
			)
			return NextResponse.redirect(
				new URL(
					`/payment/error?reason=checkout_creation_failed`,
					request.url
				)
			)
		}

		// Step 7: Auto-redirect to Stripe checkout
		console.log(
			`[PAYMENT-GATEWAY] Redirecting to Stripe checkout for booking: ${bookingId}`
		)
		return NextResponse.redirect(paymentResult.checkoutUrl)
	} catch (error) {
		console.error('[PAYMENT-GATEWAY] Unexpected error:', error)
		return NextResponse.redirect(
			new URL(`/payment/error?reason=server_error`, request.url)
		)
	}
}
