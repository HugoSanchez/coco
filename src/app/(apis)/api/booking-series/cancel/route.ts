/**
 * POST /api/booking-series/cancel
 * ------------------------------------------------------------
 * Minimal series cancellation endpoint.
 *
 * WHAT IT DOES (V1)
 * - Sets booking_series.status = 'ended'
 * - Optionally cancels FUTURE bookings for the series in DB (no Google actions)
 * - Returns a compact summary
 */

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
	setBookingSeriesStatus,
	getBookingSeriesById,
	setBookingSeriesMasterEventId,
	getAllStandaloneEventIdsForSeries
} from '@/lib/db/booking-series'
import { cancelFutureBookingsForSeries } from '@/lib/db/bookings'
import { deleteMasterRecurringEvent } from '@/lib/calendar/master-recurring'
import { deleteCalendarEvent } from '@/lib/calendar/calendar'

type CancelSeriesPayload = {
	series_id: string
	until_local?: string | null
	cancel_future?: boolean
	delete_future?: boolean
}

export async function POST(req: Request) {
	try {
		const body = (await req.json()) as CancelSeriesPayload
		if (!body?.series_id) return NextResponse.json({ error: 'missing series_id' }, { status: 400 })

		const client = createServiceRoleClient()

		// Stage 0: Load series to check for master event presence
		const series = await getBookingSeriesById(client, body.series_id)
		if (!series) return NextResponse.json({ error: 'series_not_found' }, { status: 404 })

		// Stage 1: Update series status (and optional until local wall time)
		await setBookingSeriesStatus(client, body.series_id, 'ended', body.until_local ?? null)

		// Stage 1B: If master event exists, delete it from Google and clear the id
		if (series.google_master_event_id) {
			try {
				await deleteMasterRecurringEvent(series.user_id, series.google_master_event_id, client)
			} catch (e) {
				// Non-fatal; continue cancellation flow
				console.error('[cancel series] failed deleting master event', e)
			}
			try {
				await setBookingSeriesMasterEventId(client, body.series_id, null)
			} catch (e) {
				console.error('[cancel series] failed clearing master event id', e)
			}
		}

		// V2: Stage 1C: Delete all standalone events for rescheduled occurrences
		try {
			const standaloneEventIds = await getAllStandaloneEventIdsForSeries(client, body.series_id)
			for (const eventId of standaloneEventIds) {
				try {
					const result = await deleteCalendarEvent(eventId, series.user_id, client)
					if (result.success) {
						console.log(`[cancel series] deleted standalone event ${eventId}`)
					} else {
						console.warn(`[cancel series] failed to delete standalone event ${eventId}: ${result.error}`)
					}
				} catch (e) {
					console.warn(`[cancel series] error deleting standalone event ${eventId}:`, e)
					// Continue with other events
				}
			}
		} catch (e) {
			// Non-fatal; continue cancellation flow
			console.error('[cancel series] failed fetching/deleting standalone events', e)
		}

		// Stage 2: optionally delete eligible future bookings (no bills/payments)
		let deleted = 0
		const nowIso = new Date().toISOString()
		if (body.delete_future) {
			// Best-effort: delete safe bookings first
			const { deleteEligibleFutureBookingsForSeries } = await import('@/lib/db/bookings')
			deleted = await deleteEligibleFutureBookingsForSeries(body.series_id, nowIso, client)
		}

		// Stage 3: optionally cancel remaining future bookings
		let cancelled = 0
		if (body.cancel_future) {
			cancelled = await cancelFutureBookingsForSeries(body.series_id, nowIso, client)
		}

		return NextResponse.json({ series_id: body.series_id, future_deleted: deleted, future_cancelled: cancelled })
	} catch (error: any) {
		console.error('booking-series/cancel error', error)
		return NextResponse.json({ error: error?.message || 'unknown_error' }, { status: 500 })
	}
}
