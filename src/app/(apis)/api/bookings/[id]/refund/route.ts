import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/db/bookings'
import { paymentOrchestrationService } from '@/lib/payments/payment-orchestration-service'

/**
 * POST /api/bookings/[id]/refund
 *
 * Processes a full refund for a booking payment with comprehensive error handling:
 *
 * VALIDATION CHECKS:
 * - User authentication and booking ownership
 * - Booking exists and belongs to authenticated user
 * - Payment exists and is in 'paid' status
 *
 * REFUND PROCESS:
 * - Finds the paid bill associated with the booking
 * - Locates the Stripe payment intent from payment session
 * - Processes full refund through Stripe API
 * - Updates bill status to 'refunded' with tracking data
 *
 * The refund is processed back to the original payment method.
 * This endpoint only supports full refunds to keep the implementation simple.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const supabase = createClient()

		// Check authentication
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

		const bookingId = params.id

		// Parse request body for optional refund reason
		let refundReason: string | undefined
		try {
			const body = await request.json()
			refundReason = body.reason
		} catch {
			// Body is optional, continue without reason
		}

		// 1. Get the booking to verify ownership and existence
		const booking = await getBookingById(bookingId, supabase)

		if (!booking) {
			return NextResponse.json(
				{ error: 'Booking not found' },
				{ status: 404 }
			)
		}

		// Verify user owns this booking
		if (booking.user_id !== user.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
		}

		// 2. Process the refund using the orchestration service
		const refundResult =
			await paymentOrchestrationService.refundBookingPayment(
				bookingId,
				refundReason,
				supabase
			)

		if (!refundResult.success) {
			// Return specific error message from the service
			const statusCode = refundResult.error?.includes('No paid bill')
				? 400 // Bad Request - nothing to refund
				: 500 // Internal Server Error - processing failed

			return NextResponse.json(
				{
					error: 'Refund failed',
					details: refundResult.error
				},
				{ status: statusCode }
			)
		}

		// 3. Return success response
		return NextResponse.json({
			success: true,
			message: 'Refund processed successfully',
			refund: {
				bookingId,
				refundId: refundResult.refundId,
				status: 'refunded',
				reason: refundReason || 'Full refund requested'
			}
		})
	} catch (error) {
		console.error('Booking refund error:', error)
		return NextResponse.json(
			{
				error: 'Failed to process refund',
				details:
					error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
