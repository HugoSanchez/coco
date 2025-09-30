import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'

import { getBookingById, updateBookingStatus } from '@/lib/db/bookings'
import { getBillForBookingAndMarkAsPaid } from '@/lib/db/bills'
import {
	getCalendarEventsForBooking,
	createCalendarEvent as createCalendarEventDb,
	updateCalendarEventType
} from '@/lib/db/calendar-events'
import {
	createCalendarEventWithInvite,
	createInternalConfirmedCalendarEvent,
	updatePendingToConfirmed
} from '@/lib/calendar/calendar'
import { getClientById } from '@/lib/db/clients'
import { getProfileById } from '@/lib/db/profiles'

/**
 * Admin: Repair Booking Endpoint
 * ---------------------------------------
 * PURPOSE
 * - Repair a booking after a missed/failed webhook so DB and calendar reflect a successful payment.
 *
 * SECURITY
 * - Header guard: `X-Admin-Key` must match `ADMIN_API_KEY`.
 * - Uses Supabase service-role client (bypasses RLS) to operate across users.
 *
 * SIDE EFFECTS (in order)
 * 1) Mark the booking's bill as paid (`status = 'paid'`, `paid_at` set).
 * 2) Ensure the booking is confirmed (`bookings.status = 'scheduled'`).
 * 3) Ensure a confirmed Google Calendar event exists:
 *    - Promote pending → confirmed with invite, or
 *    - Create confirmed with invite when client email exists, or
 *    - Create internal confirmed (no invite) when no client email.
 *
 * IDEMPOTENCY
 * - Safe to call multiple times: already-paid/already-scheduled/already-confirmed are no-ops.
 *
 * REQUEST
 * - POST /api/admin/repair-booking
 * - Headers: `Content-Type: application/json`, `X-Admin-Key: <ADMIN_API_KEY>`
 * - Body: { "bookingId": "<uuid>" }
 *
 * RESPONSES
 * - 200: { success: true, bookingId, billMarked: boolean, calendarEnsured: boolean }
 * - 401: { error: 'Unauthorized' }
 * - 400: { error: 'bookingId is required' }
 * - 404: { error: 'Booking not found' }
 * - 500: { error: 'Failed to repair booking', details }
 */

// Simple admin guard using header. Expect X-Admin-Key to match env ADMIN_API_KEY
function isAuthorizedAdmin(request: NextRequest): boolean {
	const headerKey =
		request.headers.get('x-admin-key') || request.headers.get('X-Admin-Key')
	const adminKey = process.env.ADMIN_API_KEY
	return Boolean(adminKey && headerKey && headerKey === adminKey)
}

export async function POST(request: NextRequest) {
	// Step 0 — Admin header auth
	if (!isAuthorizedAdmin(request)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	try {
		// Step 1 — Parse body and validate
		const body = await request.json().catch(() => ({}))
		const bookingId: string | undefined =
			body?.bookingId || body?.id || body?.booking_id
		if (!bookingId) {
			return NextResponse.json(
				{ error: 'bookingId is required' },
				{ status: 400 }
			)
		}

		// Step 2 — Init service-role client (bypass RLS)
		// Service role client to bypass RLS
		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.SUPABASE_SERVICE_ROLE_KEY!
		)

		// Step 3 — Fetch booking (ownership not required)
		// 1) Fetch booking and related data (ownership not required with service role)
		const booking = await getBookingById(bookingId, supabase)
		if (!booking) {
			return NextResponse.json(
				{ error: 'Booking not found' },
				{ status: 404 }
			)
		}

		// Step 4 — Mark bill as paid (idempotent)
		// 2) Mark bill as paid (creates paid_at timestamp)
		let billMarked = false
		try {
			await getBillForBookingAndMarkAsPaid(bookingId, supabase)
			billMarked = true
		} catch (e: any) {
			Sentry.captureException(e, {
				tags: {
					component: 'api:admin',
					method: 'repair-booking',
					stage: 'bill'
				},
				extra: { bookingId }
			})
		}

		// Step 5 — Ensure booking is scheduled (idempotent)
		// 3) Ensure booking is scheduled
		if (booking.status !== 'scheduled') {
			await updateBookingStatus(bookingId, 'scheduled', supabase)
		}

		// Step 6 — Ensure a confirmed calendar event exists (promote/create as needed)
		// 4) Ensure a confirmed calendar event exists
		let calendarEnsured = false
		try {
			const existingEvents = await getCalendarEventsForBooking(
				bookingId,
				supabase
			)
			const confirmed = existingEvents.find(
				(e) => e.event_type === 'confirmed'
			)
			if (confirmed) {
				calendarEnsured = true
			} else {
				const pending = existingEvents.find(
					(e) => e.event_type === 'pending'
				)
				const practitioner = await getProfileById(
					booking.user_id,
					supabase
				)
				const client = booking.client_id
					? await getClientById(booking.client_id, supabase)
					: null

				if (pending && practitioner && client && client.email) {
					// Promote pending event to confirmed and update DB record
					const result = await updatePendingToConfirmed(
						{
							googleEventId: pending.google_event_id,
							userId: booking.user_id,
							clientEmail: client.email,
							practitionerName:
								practitioner.name || 'Practitioner',
							practitionerEmail: practitioner.email,
							bookingId,
							mode: (booking as any).mode,
							locationText: (booking as any).location_text || null
						},
						supabase
					)
					if (result.success) {
						await updateCalendarEventType(
							pending.id,
							'confirmed',
							supabase
						)
						calendarEnsured = true
					}
				} else if (practitioner && client && client.email) {
					// Create a brand-new confirmed event with invite, then record it
					const result = await createCalendarEventWithInvite(
						{
							userId: booking.user_id,
							clientName: client.name,
							clientEmail: client.email,
							practitionerName:
								practitioner.name || 'Practitioner',
							practitionerEmail: practitioner.email,
							startTime: booking.start_time,
							endTime: booking.end_time,
							bookingNotes: undefined,
							bookingId: booking.id as any,
							mode: (booking as any).mode,
							locationText: (booking as any).location_text || null
						},
						supabase
					)
					if (result.success && result.googleEventId) {
						await createCalendarEventDb(
							{
								booking_id: booking.id,
								user_id: booking.user_id,
								google_event_id: result.googleEventId,
								event_type: 'confirmed',
								event_status: 'created'
							},
							supabase
						)
						calendarEnsured = true
					}
				} else if (practitioner) {
					// Create internal confirmed event (no invite), then record it
					const result = await createInternalConfirmedCalendarEvent(
						{
							userId: booking.user_id,
							clientName: client ? client.name : 'Client',
							practitionerName:
								practitioner.name || 'Practitioner',
							practitionerEmail: practitioner.email,
							startTime: booking.start_time,
							endTime: booking.end_time,
							bookingNotes: undefined,
							bookingId: booking.id as any
						},
						supabase
					)
					if (result.success && result.googleEventId) {
						await createCalendarEventDb(
							{
								booking_id: booking.id,
								user_id: booking.user_id,
								google_event_id: result.googleEventId,
								event_type: 'confirmed',
								event_status: 'created'
							},
							supabase
						)
						calendarEnsured = true
					}
				}
			}
		} catch (calendarError) {
			// Calendar errors are captured but do not fail the whole repair
			Sentry.captureException(calendarError, {
				tags: {
					component: 'api:admin',
					method: 'repair-booking',
					stage: 'calendar'
				},
				extra: { bookingId }
			})
		}

		// Step 7 — Respond with outcome flags
		return NextResponse.json({
			success: true,
			bookingId,
			billMarked,
			calendarEnsured
		})
	} catch (error) {
		// Fallback error
		console.error('admin:repair-booking error', error)
		Sentry.captureException(error, {
			tags: { component: 'api:admin', method: 'repair-booking' }
		})
		return NextResponse.json(
			{
				error: 'Failed to repair booking',
				details:
					error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
