import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateBookingStatus, getBookingById } from '@/lib/db/bookings'
import {
	getCalendarEventsForBooking,
	updateCalendarEventType
} from '@/lib/db/calendar-events'
import { updatePendingToConfirmed } from '@/lib/calendar/calendar'
import { getProfileById } from '@/lib/db/profiles'
import { getClientById } from '@/lib/db/clients'

/**
 * POST /api/bookings/[id]/confirm
 *
 * Manually confirms a booking by:
 * 1. Updating booking status to 'scheduled' (confirmed)
 * 2. Converting pending calendar event to confirmed appointment with client invitation
 * 3. Updating calendar event type in database
 *
 * This endpoint confirms the booking and updates the calendar, but does NOT mark
 * the associated bill as paid. Payment status should be handled separately.
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

		// Check if booking is already confirmed
		if (booking.status === 'scheduled') {
			return NextResponse.json(
				{ error: 'Booking is already confirmed' },
				{ status: 400 }
			)
		}

		// Only allow confirmation of pending bookings
		if (booking.status !== 'pending') {
			return NextResponse.json(
				{ error: 'Only pending bookings can be confirmed' },
				{ status: 400 }
			)
		}

		// 2. Update booking status to 'scheduled' (confirmed)
		await updateBookingStatus(bookingId, 'scheduled', supabase)

		// 3. Convert pending calendar event to confirmed appointment
		try {
			// Get practitioner and client details for calendar update
			const [practitioner, client] = await Promise.all([
				getProfileById(user.id, supabase),
				getClientById(booking.client_id, supabase)
			])

			if (!practitioner) {
				throw new Error(`Practitioner profile not found: ${user.id}`)
			}

			if (!client) {
				throw new Error(`Client not found: ${booking.client_id}`)
			}

			// Find the existing pending calendar event for this booking
			const existingEvents = await getCalendarEventsForBooking(
				bookingId,
				supabase
			)
			const pendingEvent = existingEvents.find(
				(event) => event.event_type === 'pending'
			)

			if (pendingEvent) {
				// Update the pending event to confirmed with full appointment details
				const calendarResult = await updatePendingToConfirmed(
					{
						googleEventId: pendingEvent.google_event_id,
						userId: user.id,
						clientEmail: client.email,
						practitionerName: practitioner.name || 'Practitioner',
						practitionerEmail: practitioner.email
					},
					supabase
				)

				if (calendarResult.success && calendarResult.googleEventId) {
					// Update the calendar event record in database to confirmed status
					await updateCalendarEventType(
						pendingEvent.id,
						'confirmed',
						supabase
					)

					// Update the Google Meet link if provided
					if (calendarResult.googleMeetLink) {
						const { error: updateError } = await supabase
							.from('calendar_events')
							.update({
								google_meet_link: calendarResult.googleMeetLink,
								event_status: 'updated'
							})
							.eq('id', pendingEvent.id)

						if (updateError) {
							console.error(
								`Failed to update Meet link for event ${pendingEvent.id}:`,
								updateError
							)
						}
					}

					console.log(
						`Calendar event updated from pending to confirmed for booking ${bookingId}: ${calendarResult.googleEventId}`
					)
				} else {
					console.error(
						`Failed to update calendar event for booking ${bookingId}:`,
						calendarResult.error
					)
					// Don't fail the confirmation if calendar update fails
				}
			} else {
				console.warn(
					`No pending calendar event found for booking ${bookingId}`
				)
				// This might happen if the booking was created without calendar integration
				// Don't fail the confirmation
			}
		} catch (calendarError) {
			console.error(
				`Calendar update error for booking ${bookingId}:`,
				calendarError
			)
			// Don't fail the confirmation if calendar update fails
		}

		return NextResponse.json({
			success: true,
			message: 'Booking confirmed successfully',
			booking: {
				id: bookingId,
				status: 'scheduled'
			}
		})
	} catch (error) {
		console.error('Booking confirmation error:', error)
		return NextResponse.json(
			{
				error: 'Failed to confirm booking',
				details:
					error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
