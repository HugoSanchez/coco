import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBookingByIdAndUser, rescheduleBooking, updateBookingStandaloneEventId } from '@/lib/db/bookings'
import { getCalendarEventsForBooking } from '@/lib/db/calendar-events'
import { rescheduleCalendarEvent } from '@/lib/calendar/calendar'
import * as Sentry from '@sentry/nextjs'
// V2: Series exception handling
import { getBookingSeriesById, addExcludedDateToSeries, getExcludedDatesForSeries, getStandaloneEventIdForOccurrence, recordStandaloneEventForOccurrence } from '@/lib/db/booking-series'
import { updateMasterRecurringEventWithExdates, createStandaloneOccurrenceEvent, deleteOccurrenceInstance } from '@/lib/calendar/master-recurring'
import { toLocalDateString } from '@/lib/dates/recurrence'
import { getClientById } from '@/lib/db/clients'
import { getProfileById } from '@/lib/db/profiles'

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

		// V2: Check if this is part of a recurring series
		const isSeriesBooking = booking.series_id != null && booking.occurrence_index != null

		let calendarUpdateSuccess = true
		let calendarError: string | undefined

		if (isSeriesBooking) {
			// V2: SERIES BOOKING - Handle via EXDATE + standalone event
			const series = await getBookingSeriesById(supabase, booking.series_id!)
			if (!series) {
				console.warn(`Series ${booking.series_id} not found for booking ${bookingId}`)
				calendarUpdateSuccess = false
				calendarError = 'Series not found'
			} else {
				// Check if already rescheduled (has standalone event)
				const existingStandaloneId = await getStandaloneEventIdForOccurrence(
					supabase,
					booking.series_id!,
					booking.occurrence_index!
				)

				if (existingStandaloneId) {
					// Update existing standalone event
					const calendarResult = await rescheduleCalendarEvent(
						{
							googleEventId: existingStandaloneId,
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
							'Failed to reschedule standalone event:',
							calendarResult.error
						)
					}
				} else {
					// First time rescheduling this occurrence
					// 1. Delete the original occurrence instance from Google Calendar
					//    This prevents the duplicate event when rescheduling on the same day
					if (series.google_master_event_id) {
						const deleteResult = await deleteOccurrenceInstance({
							userId: user.id,
							masterEventId: series.google_master_event_id,
							occurrenceStartTimeUtc: booking.start_time,
							timezone: series.timezone,
							supabaseClient: supabase
						})

						if (!deleteResult.success) {
							console.warn(
								`Failed to delete occurrence instance: ${deleteResult.error}`
							)
							// Continue anyway - EXDATE will prevent future instances
						}
					}

					// 2. Exclude original date from master event
					const originalLocalDate = toLocalDateString(booking.start_time, series.timezone)
					await addExcludedDateToSeries(supabase, booking.series_id!, originalLocalDate)

					// 3. Update master event with EXDATE
					const allExcluded = await getExcludedDatesForSeries(supabase, booking.series_id!)
					if (series.google_master_event_id) {
						const updateResult = await updateMasterRecurringEventWithExdates({
							userId: user.id,
							googleEventId: series.google_master_event_id,
							excludedDates: allExcluded,
							timezone: series.timezone,
							supabaseClient: supabase
						})

						if (!updateResult.success) {
							console.warn(
								`Failed to update master event with EXDATE: ${updateResult.error}`
							)
							// Continue anyway - we'll still create the standalone event
						}
					}

					// 4. Create standalone event for new time
					try {
						const client = await getClientById(booking.client_id, supabase)
						const profile = await getProfileById(user.id, supabase)

						if (!client) {
							throw new Error('Client not found')
						}

						const standalone = await createStandaloneOccurrenceEvent({
							userId: user.id,
							seriesId: booking.series_id!,
							occurrenceIndex: booking.occurrence_index!,
							clientName: client.name,
							clientEmail: client.email,
							practitionerName: profile?.name || null,
							newStartTime: startDate.toISOString(),
							newEndTime: endDate.toISOString(),
							timezone: series.timezone,
							mode: series.mode as 'online' | 'in_person' | undefined,
							locationText: series.location_text || null,
							supabaseClient: supabase
						})

						// 5. Record standalone event ID
						await recordStandaloneEventForOccurrence(
							supabase,
							booking.series_id!,
							booking.occurrence_index!,
							standalone.googleEventId
						)

						// 6. Store in booking for quick lookup
						await updateBookingStandaloneEventId(
							bookingId,
							standalone.googleEventId,
							supabase
						)

						console.log(
							`Created standalone event ${standalone.googleEventId} for rescheduled occurrence ${bookingId}`
						)
					} catch (standaloneError) {
						console.error(
							`Failed to create standalone event for booking ${bookingId}:`,
							standaloneError
						)
						calendarUpdateSuccess = false
						calendarError = standaloneError instanceof Error ? standaloneError.message : 'Unknown error'
					}
				}
			}
		} else {
			// SINGLE BOOKING - Original logic
			const calendarEvents = await getCalendarEventsForBooking(
				bookingId,
				supabase
			)

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
