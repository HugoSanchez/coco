import { createCalendarEvent } from '@/lib/db/calendar-events'
import {
	createPendingCalendarEvent,
	createCalendarEventWithInvite,
	createInternalConfirmedCalendarEvent
} from '@/lib/calendar/calendar'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'

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
