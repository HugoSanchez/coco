import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateBookingStatus, getBookingById } from '@/lib/db/bookings'
import {
	getCalendarEventsForBooking,
	updateCalendarEventStatus
} from '@/lib/db/calendar-events'
import {
	deleteCalendarEvent,
	cancelCalendarEvent
} from '@/lib/calendar/calendar'
import { paymentOrchestrationService } from '@/lib/payments/payment-orchestration-service'

/**
 * POST /api/bookings/[id]/cancel
 *
 * Cancels a booking with smart handling based on booking status:
 *
 * PENDING BOOKINGS:
 * - Deletes calendar event completely (just a placeholder)
 * - Cancels payment sessions and bills to prevent accidental payment
 * - Updates booking status to 'canceled'
 *
 * CONFIRMED BOOKINGS:
 * - Cancels calendar event with notifications to attendees
 * - Updates event title to show "CANCELLED" status
 * - Updates booking status to 'canceled'
 * - No payment cancellation (already processed)
 *
 * This endpoint provides a complete cancellation flow that handles
 * both the business logic and user experience aspects of cancellation.
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

		// 1. Get the booking to verify ownership and current status
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

		// Check if booking is already canceled
		if (booking.status === 'canceled') {
			return NextResponse.json(
				{ error: 'Booking is already canceled' },
				{ status: 400 }
			)
		}

		// 2. Handle calendar event cancellation based on booking status
		try {
			// Find the calendar event for this booking
			const calendarEvents = await getCalendarEventsForBooking(
				bookingId,
				supabase
			)

			const activeEvent = calendarEvents.find(
				(event) => event.event_status !== 'cancelled'
			)

			if (activeEvent) {
				let calendarResult

				if (booking.status === 'pending') {
					// PENDING BOOKING: Delete calendar event completely
					// This removes the placeholder event as if it never existed
					calendarResult = await deleteCalendarEvent(
						activeEvent.google_event_id,
						user.id,
						supabase
					)
				} else {
					// CONFIRMED BOOKING: Cancel calendar event with notifications
					// This marks the event as cancelled and notifies attendees
					calendarResult = await cancelCalendarEvent(
						activeEvent.google_event_id,
						user.id,
						supabase
					)
				}

				if (calendarResult.success) {
					// Update calendar event status in database
					await updateCalendarEventStatus(
						activeEvent.id,
						'cancelled',
						supabase
					)

					console.log(
						`Calendar event ${booking.status === 'pending' ? 'deleted' : 'cancelled'} for booking ${bookingId}: ${activeEvent.google_event_id}`
					)
				} else {
					console.error(
						`Failed to ${booking.status === 'pending' ? 'delete' : 'cancel'} calendar event for booking ${bookingId}:`,
						calendarResult.error
					)
					// Don't fail the entire cancellation if calendar update fails
				}
			} else {
				console.warn(
					`No active calendar event found for booking ${bookingId}`
				)
			}
		} catch (calendarError) {
			console.error(
				`Calendar cancellation error for booking ${bookingId}:`,
				calendarError
			)
			// Don't fail the booking cancellation if calendar update fails
		}

		// 3. Cancel payments if booking is pending
		if (booking.status === 'pending') {
			try {
				const paymentResult =
					await paymentOrchestrationService.cancelPaymentForBooking(
						bookingId,
						supabase
					)

				if (paymentResult.success) {
					console.log(`Payment cancelled for booking ${bookingId}`)
				} else {
					console.error(
						`Failed to cancel payment for booking ${bookingId}:`,
						paymentResult.error
					)
					// Don't fail the booking cancellation if payment cancellation fails
				}
			} catch (paymentError) {
				console.error(
					`Payment cancellation error for booking ${bookingId}:`,
					paymentError
				)
				// Continue with booking cancellation even if payment cancellation fails
			}
		}

		// 4. Update booking status to canceled (matches database constraint)
		await updateBookingStatus(bookingId, 'canceled', supabase)

		// 5. Return success with appropriate message
		const isPending = booking.status === 'pending'
		return NextResponse.json({
			success: true,
			message: isPending
				? 'Booking canceled and payment link invalidated'
				: 'Booking canceled and attendees notified',
			booking: {
				id: bookingId,
				status: 'canceled',
				wasReservation: isPending
			}
		})
	} catch (error) {
		console.error('Booking cancellation error:', error)
		return NextResponse.json(
			{
				error: 'Failed to cancel booking',
				details:
					error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
