import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBookingByIdAndUser, rescheduleBooking } from '@/lib/db/bookings'
import { getCalendarEventsForBooking } from '@/lib/db/calendar-events'
import { rescheduleCalendarEvent } from '@/lib/calendar/calendar'

export async function POST(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const supabase = createClient()
		const bookingId = params.id

		// Get authenticated user
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()

		if (authError || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Parse request body
		const { newStartTime, newEndTime } = await request.json()

		if (!newStartTime || !newEndTime) {
			return NextResponse.json(
				{ error: 'New start time and end time are required' },
				{ status: 400 }
			)
		}

		// Validate date format
		const startDate = new Date(newStartTime)
		const endDate = new Date(newEndTime)

		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
			return NextResponse.json(
				{ error: 'Invalid date format' },
				{ status: 400 }
			)
		}

		if (startDate >= endDate) {
			return NextResponse.json(
				{ error: 'Start time must be before end time' },
				{ status: 400 }
			)
		}

		// Check if booking exists and belongs to user
		const booking = await getBookingByIdAndUser(
			bookingId,
			user.id,
			supabase
		)

		if (!booking) {
			return NextResponse.json(
				{ error: 'Booking not found' },
				{ status: 404 }
			)
		}

		// Check if booking can be rescheduled
		if (booking.status === 'canceled' || booking.status === 'completed') {
			return NextResponse.json(
				{
					error: 'Cannot reschedule canceled or completed bookings'
				},
				{ status: 400 }
			)
		}

		// Get the calendar event associated with this booking
		const calendarEvents = await getCalendarEventsForBooking(
			bookingId,
			supabase
		)

		let calendarUpdateSuccess = true
		let calendarError: string | undefined

		// Update Google Calendar if a calendar event exists
		if (calendarEvents.length > 0) {
			const calendarEvent = calendarEvents[0] // Take the first (and typically only) event

			if (calendarEvent.google_event_id) {
				const calendarResult = await rescheduleCalendarEvent(
					{
						googleEventId: calendarEvent.google_event_id,
						userId: user.id,
						newStartTime: startDate.toISOString(),
						newEndTime: endDate.toISOString()
					},
					supabase
				)

				if (!calendarResult.success) {
					calendarUpdateSuccess = false
					calendarError = calendarResult.error
					console.error(
						'Failed to reschedule Google Calendar event:',
						calendarResult.error
					)
				}
			}
		}

		// Update the booking in the database
		let updatedBooking
		try {
			updatedBooking = await rescheduleBooking(
				bookingId,
				user.id,
				startDate.toISOString(),
				endDate.toISOString(),
				supabase
			)
		} catch (updateError) {
			console.error('Error updating booking:', updateError)
			return NextResponse.json(
				{ error: 'Failed to reschedule booking' },
				{ status: 500 }
			)
		}

		// If calendar update failed, return a warning but still consider the operation successful
		// since the booking time was updated in the database
		if (!calendarUpdateSuccess) {
			return NextResponse.json({
				success: true,
				message: 'Booking rescheduled successfully',
				booking: updatedBooking,
				warning:
					'Calendar event could not be updated. Please check your Google Calendar manually.',
				calendarError
			})
		}

		return NextResponse.json({
			success: true,
			message: 'Booking rescheduled successfully',
			booking: updatedBooking
		})
	} catch (error) {
		console.error('Error in reschedule API:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		)
	}
}
