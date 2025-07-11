import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/db/bookings'
import { getBillForBookingAndMarkAsPaid } from '@/lib/db/bills'

/**
 * POST /api/bookings/[id]/mark-paid
 *
 * Manually marks a booking's bill as paid by:
 * 1. Finding the associated bill for the booking
 * 2. Updating bill status to 'paid'
 * 3. Setting paid_at timestamp
 *
 * This endpoint only handles payment status and does NOT affect:
 * - Booking status (pending/scheduled/completed)
 * - Calendar events or invitations
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

		// 1. Get the booking to verify ownership
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

		// 2. Mark associated bill as paid
		try {
			await getBillForBookingAndMarkAsPaid(bookingId, supabase)
		} catch (billError) {
			console.error(
				`Error marking bill as paid for booking ${bookingId}:`,
				billError
			)

			// Check if it's because no bill exists
			if (
				billError instanceof Error &&
				billError.message.includes('not found')
			) {
				return NextResponse.json(
					{ error: 'No bill found for this booking' },
					{ status: 404 }
				)
			}

			// Check if bill is already paid
			if (
				billError instanceof Error &&
				billError.message.includes('already paid')
			) {
				return NextResponse.json(
					{ error: 'Bill is already marked as paid' },
					{ status: 400 }
				)
			}

			// Other bill errors
			return NextResponse.json(
				{
					error: 'Failed to mark bill as paid',
					details:
						billError instanceof Error
							? billError.message
							: 'Unknown error'
				},
				{ status: 500 }
			)
		}

		return NextResponse.json({
			success: true,
			message: 'Payment marked as received successfully',
			booking: {
				id: bookingId
			}
		})
	} catch (error) {
		console.error('Mark as paid error:', error)
		return NextResponse.json(
			{
				error: 'Failed to mark as paid',
				details:
					error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
