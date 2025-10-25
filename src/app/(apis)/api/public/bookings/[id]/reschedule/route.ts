import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getBookingById, rescheduleBooking } from '@/lib/db/bookings'
import { getClientById } from '@/lib/db/clients'
import { getCalendarEventsForBooking } from '@/lib/db/calendar-events'
import { rescheduleCalendarEvent } from '@/lib/calendar/calendar'
import { computeMonthlySlots } from '@/lib/calendar/availability-orchestration'
import { verifyManageSig } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/public/bookings/:id/reschedule
 *
 * Patient self-service reschedule using HMAC-signed link.
 *
 * Steps
 * 1) Parse body { start, end, sig } and params.id
 * 2) Load booking and client; verify signature against bookingId + client.email + 'reschedule'
 * 3) Server-side availability check (same logic as public booking creation)
 * 4) Reschedule Google Calendar event if exists
 * 5) Update booking times
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
	try {
		const { id } = params
		const body = (await request.json().catch(() => ({}))) as { start?: string; end?: string; sig?: string }
		const { start, end, sig } = body || {}

		if (!id || !start || !end || !sig) {
			return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
		}

		// Normalize times
		const newStartIso = new Date(start).toISOString()
		const newEndIso = new Date(end).toISOString()
		if (
			Number.isNaN(new Date(newStartIso).getTime()) ||
			Number.isNaN(new Date(newEndIso).getTime()) ||
			new Date(newEndIso) <= new Date(newStartIso)
		) {
			return NextResponse.json({ error: 'invalid_time_range' }, { status: 400 })
		}

		const service = createServiceRoleClient()

		// Load booking and client
		const booking = await getBookingById(id, service as any)
		if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 })
		if (booking.status === 'canceled' || booking.status === 'completed') {
			return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
		}

		const client = await getClientById(booking.client_id, service as any)
		if (!client?.email) return NextResponse.json({ error: 'client_not_found' }, { status: 404 })

		// Step 2: Verify signature (bookingId:email:action)
		const ok = verifyManageSig(sig, id, client.email, 'reschedule')
		if (!ok) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })

		// Step 3: Availability check for practitioner
		const monthIso = new Date(newStartIso).toISOString()
		const slots = await computeMonthlySlots({
			userId: booking.user_id,
			monthIso,
			tz: 'Europe/Madrid',
			window: '08:00-20:00',
			durationMin: 60,
			supabase: service as any
		})
		const dayKey = newStartIso.slice(0, 10)
		const daySlots = slots.slotsByDay[dayKey] || []
		const fits = daySlots.some((s) => s.start === newStartIso && s.end === newEndIso)
		if (!fits) return NextResponse.json({ error: 'slot_conflict' }, { status: 409 })

		// Step 4: Reschedule Google event if present
		try {
			const calendarEvents = await getCalendarEventsForBooking(id, service as any)
			const first = calendarEvents.find((e) => Boolean(e.google_event_id))
			if (first?.google_event_id) {
				await rescheduleCalendarEvent(
					{
						googleEventId: first.google_event_id,
						userId: booking.user_id,
						newStartTime: newStartIso,
						newEndTime: newEndIso
					},
					service as any
				)
			}
		} catch (_) {
			// Do not fail whole operation if calendar fails; we still update the booking
		}

		// Step 5: Persist booking new times
		const updated = await rescheduleBooking(id, booking.user_id, newStartIso, newEndIso, service as any)
		return NextResponse.json({ success: true, booking: updated })
	} catch (e) {
		console.error('public reschedule error', e)
		return NextResponse.json({ error: 'server_error' }, { status: 500 })
	}
}
