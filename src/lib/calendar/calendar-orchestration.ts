import { createCalendarEvent } from '@/lib/db/calendar-events'
import {
	createPendingCalendarEvent,
	createCalendarEventWithInvite,
	createInternalConfirmedCalendarEvent
} from '@/lib/calendar/calendar'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { getCalendarEventsForBooking, updateCalendarEventType } from '@/lib/db/calendar-events'
import { updatePendingToConfirmed } from '@/lib/calendar/calendar'

export type CalendarVariant = 'internal_confirmed' | 'confirmed' | 'pending'

export async function createBookingCalendarEvent(options: {
	variant: CalendarVariant
	bookingId: string
	request: {
		userId: string
		startTime: string
		endTime: string
		notes?: string
		mode?: 'online' | 'in_person'
		locationText?: string | null
	}
	client: any
	practitioner: any
	supabaseClient?: SupabaseClient
}) {
	console.log('[calendar-orchestrator] createBookingCalendarEvent', {
		variant: options.variant,
		mode: options.request?.mode,
		locationText: options.request?.locationText
	})
	const { variant, bookingId, request, client, practitioner, supabaseClient } = options
	try {
		if (!client || !practitioner) return

		if (variant === 'internal_confirmed') {
			const eventResult = await createInternalConfirmedCalendarEvent(
				{
					userId: request.userId,
					clientName: client.name,
					practitionerName: practitioner.name || 'Your Practitioner',
					practitionerEmail: practitioner.email,
					startTime: request.startTime,
					endTime: request.endTime,
					bookingNotes: request.notes,
					bookingId: bookingId as any
				},
				supabaseClient
			)
			if (eventResult.success && eventResult.googleEventId) {
				await createCalendarEvent(
					{
						booking_id: bookingId,
						user_id: request.userId,
						google_event_id: eventResult.googleEventId,
						event_type: 'confirmed',
						event_status: 'created'
					},
					supabaseClient
				)
			}
			return
		}

		if (variant === 'confirmed') {
			const eventResult = await createCalendarEventWithInvite(
				{
					userId: request.userId,
					clientName: client.name,
					clientEmail: client.email,
					practitionerName: practitioner.name || 'Your Practitioner',
					practitionerEmail: practitioner.email,
					startTime: request.startTime,
					endTime: request.endTime,
					bookingNotes: request.notes,
					bookingId: bookingId as any,
					mode: request.mode,
					locationText: request.mode === 'in_person' ? request.locationText || null : null
				},
				supabaseClient
			)
			if (eventResult.success && eventResult.googleEventId) {
				await createCalendarEvent(
					{
						booking_id: bookingId,
						user_id: request.userId,
						google_event_id: eventResult.googleEventId,
						event_type: 'confirmed',
						event_status: 'created'
					},
					supabaseClient
				)
			}
			return
		}

		// pending
		const eventResult = await createPendingCalendarEvent(
			{
				userId: request.userId,
				clientName: client.name,
				practitionerEmail: practitioner.email,
				startTime: request.startTime,
				endTime: request.endTime,
				bookingId: bookingId,
				mode: request.mode,
				locationText: request.mode === 'in_person' ? request.locationText || null : null,
				extraDescription: request.notes
			},
			supabaseClient
		)
		if (eventResult.success && eventResult.googleEventId) {
			await createCalendarEvent(
				{
					booking_id: bookingId,
					user_id: request.userId,
					google_event_id: eventResult.googleEventId,
					event_type: 'pending',
					event_status: 'created'
				},
				supabaseClient
			)
		}
	} catch (error) {
		Sentry.captureException(error, {
			tags: { component: 'calendar-orchestrator', stage: 'createBookingCalendarEvent' },
			extra: { bookingId }
		})
	}
}

/**
 * updatePendingCalendarEventToConfirmed
 * ------------------------------------------------------------
 * Purpose
 *  - Find the pending Google Calendar event for a booking and convert it to a
 *    confirmed event after a successful payment.
 * Steps
 *  1) Load the pending calendar_event row for the booking
 *  2) Call calendar service to promote the event to confirmed (keeps Meet link)
 *  3) Update DB record to type 'confirmed' and persist optional Meet link
 */
export async function updatePendingCalendarEventToConfirmed(options: {
	bookingId: string
	practitionerUserId: string
	clientName: string
	clientEmail: string
	practitionerName: string
	practitionerEmail: string
	mode?: 'online' | 'in_person'
	locationText?: string | null
	supabaseClient?: SupabaseClient
}): Promise<void> {
	const {
		bookingId,
		practitionerUserId,
		clientName,
		clientEmail,
		practitionerName,
		practitionerEmail,
		mode,
		locationText,
		supabaseClient
	} = options

	try {
		// 1) Find pending event for booking
		const existingEvents = await getCalendarEventsForBooking(bookingId, supabaseClient)
		const pendingEvent = existingEvents.find((event) => event.event_type === 'pending')
		if (!pendingEvent) return

		// 2) Promote to confirmed in Google Calendar
		const calendarResult = await updatePendingToConfirmed(
			{
				googleEventId: pendingEvent.google_event_id,
				userId: practitionerUserId,
				clientName,
				clientEmail,
				practitionerName,
				practitionerEmail,
				bookingId,
				mode,
				locationText
			},
			supabaseClient
		)

		// 3) Persist DB changes and optional Meet link
		if (calendarResult.success && calendarResult.googleEventId) {
			await updateCalendarEventType(pendingEvent.id, 'confirmed', supabaseClient)
			if (calendarResult.googleMeetLink) {
				await (supabaseClient || ({} as any))
					.from('calendar_events')
					.update({ google_meet_link: calendarResult.googleMeetLink, event_status: 'updated' })
					.eq('id', pendingEvent.id)
			}
		}
	} catch (error) {
		Sentry.captureException(error, {
			tags: { component: 'calendar-orchestrator', stage: 'updatePendingCalendarEventToConfirmed' },
			extra: { bookingId }
		})
	}
}
