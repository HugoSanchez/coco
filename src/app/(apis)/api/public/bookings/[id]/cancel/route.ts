import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getBookingById, updateBookingStatus } from '@/lib/db/bookings'
import { getClientById } from '@/lib/db/clients'
import { getCalendarEventsForBooking, updateCalendarEventStatus } from '@/lib/db/calendar-events'
import { deleteCalendarEvent, cancelCalendarEvent } from '@/lib/calendar/calendar'
import { paymentOrchestrationService } from '@/lib/payments/payment-orchestration-service'
import { verifyManageSig } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/public/bookings/:id/cancel
 *
 * Patient self-service cancellation using an HMAC-signed link included in
 * the Google Calendar event description.
 *
 * IMPLEMENTATION OVERVIEW
 * 1) Parse inputs and load booking/client using a server-role Supabase client
 * 2) Verify the HMAC signature: base64url(HMAC_SHA256(CRON_SECRET, `${id}:${email}:cancel`))
 * 3) Cancel Google Calendar event:
 *    - If booking.status === 'pending' → delete the placeholder event
 *    - Else (confirmed) → cancel the event and notify attendees
 *    Both paths update our `calendar_events` record to 'cancelled' (best-effort)
 * 4) Payments:
 *    - If booking is PENDING → expire checkout sessions and cancel bills
 *    - If booking has a PAID bill and your policy requires it → process refund
 *      (we do NOT auto-refund here; public cancellations usually do not refund
 *       unless policy allows. Adjust as needed.)
 * 5) Persist booking status as 'canceled'
 * 6) Return success JSON; errors are handled with specific HTTP codes
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
	try {
		/////////////////////////////////////////////////////////////////
		// 1) Parse path param and body
		/////////////////////////////////////////////////////////////////
		const { id } = params
		const body = (await request.json().catch(() => ({}))) as { sig?: string }
		const { sig } = body || {}
		if (!id || !sig) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

		const service = createServiceRoleClient()

		// Load booking and client
		const booking = await getBookingById(id, service as any)
		if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 })
		if (booking.status === 'canceled' || booking.status === 'completed') {
			return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
		}

		const client = await getClientById(booking.client_id, service as any)
		if (!client?.email) return NextResponse.json({ error: 'client_not_found' }, { status: 404 })

		/////////////////////////////////////////////////////////////////
		// 2) Verify HMAC signature for 'cancel' action
		/////////////////////////////////////////////////////////////////
		const ok = verifyManageSig(sig, id, client.email, 'cancel')
		if (!ok) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })

		/////////////////////////////////////////////////////////////////
		// 3) Cancel Google Calendar event (best-effort)
		/////////////////////////////////////////////////////////////////
		try {
			const calendarEvents = await getCalendarEventsForBooking(id, service as any)
			const active = calendarEvents.find((e) => e.event_status !== 'cancelled' && e.google_event_id)
			if (active?.google_event_id) {
				if (booking.status === 'pending') {
					await deleteCalendarEvent(active.google_event_id, booking.user_id, service as any)
				} else {
					await cancelCalendarEvent(active.google_event_id, booking.user_id, service as any)
				}
				await updateCalendarEventStatus(active.id, 'cancelled', service as any)
			}
		} catch (calendarError) {
			// Non-fatal: continue cancellation even if calendar update fails
			console.warn('[public-cancel] calendar update failed', calendarError)
		}

		/////////////////////////////////////////////////////////////////
		// 4) Payments orchestration
		/////////////////////////////////////////////////////////////////
		if (booking.status === 'pending') {
			try {
				await paymentOrchestrationService.cancelPaymentForBooking(id, service as any)
			} catch (payErr) {
				console.warn('[public-cancel] cancelPaymentForBooking failed', payErr)
			}
		}

		/////////////////////////////////////////////////////////////////
		// 5) Persist booking status
		/////////////////////////////////////////////////////////////////
		await updateBookingStatus(id, 'canceled', service as any)

		return NextResponse.json({ success: true })
	} catch (e) {
		console.error('public cancel error', e)
		return NextResponse.json({ error: 'server_error' }, { status: 500 })
	}
}
