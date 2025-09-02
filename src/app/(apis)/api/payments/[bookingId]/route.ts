import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/db/bookings'
import { getBillsForBooking } from '@/lib/db/bills'
import { getClientById } from '@/lib/db/clients'
import { getProfileById } from '@/lib/db/profiles'
import { paymentOrchestrationService } from '@/lib/payments/payment-orchestration-service'

/**
 * GET /api/payments/[bookingId]
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: { bookingId: string } }
) {
	try {
		const supabase = createServiceRoleClient()
		const bookingId = params.bookingId

		console.log('[payments][route] start', { bookingId })

		const booking = await getBookingById(bookingId, supabase)
		if (!booking) {
			console.warn('[payments][route] booking_not_found', { bookingId })
			return NextResponse.redirect(
				new URL(`/payment/error?reason=booking_not_found`, request.url)
			)
		}

		if (booking.status === 'canceled') {
			console.warn('[payments][route] booking_canceled', { bookingId })
			return NextResponse.redirect(
				new URL(`/payment/error?reason=booking_canceled`, request.url)
			)
		}

		const bills = await getBillsForBooking(bookingId, supabase)
		const payableBill = bills.find(
			(bill) => bill.status === 'pending' || bill.status === 'sent'
		)

		if (!payableBill) {
			return NextResponse.redirect(
				new URL(`/payment/success?booking_id=${bookingId}`, request.url)
			)
		}

		const [client, practitioner] = await Promise.all([
			getClientById(booking.client_id, supabase),
			getProfileById(booking.user_id, supabase)
		])

		if (
			!client ||
			!practitioner ||
			!client.email ||
			!client.name ||
			!booking.start_time
		) {
			console.warn('[payments][route] missing_data', { bookingId })
			return NextResponse.redirect(
				new URL(`/payment/error?reason=missing_data`, request.url)
			)
		}

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
			console.error('[payments][route] checkout_creation_failed', {
				bookingId,
				error: paymentResult.error
			})
			return NextResponse.redirect(
				new URL(
					`/payment/error?reason=checkout_creation_failed`,
					request.url
				)
			)
		}

		return NextResponse.redirect(paymentResult.checkoutUrl)
	} catch (error) {
		console.error('Payment gateway error:', error)
		return NextResponse.redirect(
			new URL(`/payment/error?reason=server_error`, request.url)
		)
	}
}
