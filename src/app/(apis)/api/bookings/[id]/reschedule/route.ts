import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBookingByIdAndUser, rescheduleBooking } from '@/lib/db/bookings'
import { getCalendarEventsForBooking } from '@/lib/db/calendar-events'
import { rescheduleCalendarEvent } from '@/lib/calendar/calendar'
import * as Sentry from '@sentry/nextjs'

export async function POST(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const supabase = createClient()
		const bookingId = params.id

		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()

		if (authError || !user) {
			Sentry.captureMessage('bookings:reschedule unauthorized', {
				level: 'warning',
				tags: { component: 'api:bookings' },
				extra: { bookingId }
			})
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { newStartTime, newEndTime } = await request.json()

		if (!newStartTime || !newEndTime) {
			Sentry.captureMessage('bookings:reschedule missing_fields', {
				level: 'warning',
				tags: { component: 'api:bookings' },
				extra: { bookingId }
			})
			return NextResponse.json(
				{ error: 'New start time and end time are required' },
				{ status: 400 }
			)
		}

		const startDate = new Date(newStartTime)
		const endDate = new Date(newEndTime)

		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
			Sentry.captureMessage('bookings:reschedule invalid_date', {
				level: 'warning',
				tags: { component: 'api:bookings' },
				extra: { bookingId }
			})
			return NextResponse.json(
				{ error: 'Invalid date format' },
				{ status: 400 }
			)
		}

		if (startDate >= endDate) {
			Sentry.captureMessage('bookings:reschedule invalid_range', {
				level: 'warning',
				tags: { component: 'api:bookings' },
				extra: { bookingId }
			})
			return NextResponse.json(
				{ error: 'Start time must be before end time' },
				{ status: 400 }
			)
		}

		const booking = await getBookingByIdAndUser(
			bookingId,
			user.id,
			supabase
		)

		if (!booking) {
			Sentry.captureMessage('bookings:reschedule not_found', {
				level: 'warning',
				tags: { component: 'api:bookings' },
				extra: { bookingId }
			})
			return NextResponse.json(
				{ error: 'Booking not found' },
				{ status: 404 }
			)
		}

		if (booking.status === 'canceled' || booking.status === 'completed') {
			Sentry.captureMessage('bookings:reschedule invalid_status', {
				level: 'warning',
				tags: { component: 'api:bookings' },
				extra: { bookingId, status: booking.status }
			})
			return NextResponse.json(
				{
					error: 'Cannot reschedule canceled or completed bookings'
				},
				{ status: 400 }
			)
		}

		const calendarEvents = await getCalendarEventsForBooking(
			bookingId,
			supabase
		)

		let calendarUpdateSuccess = true
		let calendarError: string | undefined

		if (calendarEvents.length > 0) {
			const calendarEvent = calendarEvents[0]

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
					Sentry.captureMessage(
						'bookings:reschedule calendar_update_failed',
						{
							level: 'warning',
							tags: { component: 'api:bookings' },
							extra: { bookingId }
						}
					)
				}
			}
		}

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
			Sentry.captureException(updateError, {
				tags: { component: 'api:bookings', method: 'reschedule' },
				extra: { bookingId }
			})
			return NextResponse.json(
				{ error: 'Failed to reschedule booking' },
				{ status: 500 }
			)
		}

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
		Sentry.captureException(error, {
			tags: { component: 'api:bookings', method: 'reschedule' },
			extra: { bookingId: params.id }
		})
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		)
	}
}
