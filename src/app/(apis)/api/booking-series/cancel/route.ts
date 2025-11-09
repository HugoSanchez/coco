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
import { setBookingSeriesStatus } from '@/lib/db/booking-series'
import { cancelFutureBookingsForSeries } from '@/lib/db/bookings'

type CancelSeriesPayload = {
  series_id: string
  until_local?: string | null
  cancel_future?: boolean
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CancelSeriesPayload
    if (!body?.series_id) return NextResponse.json({ error: 'missing series_id' }, { status: 400 })

    const client = createServiceRoleClient()

    // Stage 1: Update series status (and optional until local wall time)
    await setBookingSeriesStatus(client, body.series_id, 'ended', body.until_local ?? null)

    // Stage 2 (optional): cancel future bookings in DB only
    let cancelled = 0
    if (body.cancel_future) {
      cancelled = await cancelFutureBookingsForSeries(body.series_id, new Date().toISOString(), client)
    }

    return NextResponse.json({ series_id: body.series_id, future_cancelled: cancelled })
  } catch (error: any) {
    console.error('booking-series/cancel error', error)
    return NextResponse.json({ error: error?.message || 'unknown_error' }, { status: 500 })
  }
}


