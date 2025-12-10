/**
 * POST /api/booking-series/create
 * ------------------------------------------------------------
 * Minimal recurring bookings creation endpoint.
 *
 * WHAT IT DOES (V1)
 * 1) Creates a booking_series row
 * 2) Generates the first 2 occurrences starting at dtstart_local
 * 3) For each occurrence, calls the existing booking orchestrator to reuse
 *    all billing/email/calendar logic
 * 4) Tags each created booking with (series_id, occurrence_index)
 * 5) Returns a compact summary
 *
 * NOTES
 * - Only creates the first 2 occurrences upfront for better UX
 * - Remaining occurrences are created by the weekly cron job (/api/cron/series/extend)
 * - Overlaps/conflicts are ignored by design in V1 (always create)
 * - Billing policy is provided in the request and mapped to orchestrator
 * - Amount/currency are provided by the caller (same contract as single bookings)
 *   and requests without a valid amount are rejected
 */

import { NextResponse } from 'next/server'
import { addMonths, format, parseISO } from 'date-fns'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createBookingSeries, setBookingSeriesMasterEventId } from '@/lib/db/booking-series'
import { orchestrateBookingCreation } from '@/lib/bookings/booking-orchestration-service'
import { tagBookingWithSeries, getExistingSeriesBookings } from '@/lib/db/bookings'
import { generateOccurrences } from '@/lib/dates/recurrence'
import { createMasterRecurringEvent } from '@/lib/calendar/master-recurring'
import { getClientById } from '@/lib/db/clients'
import { getProfileById } from '@/lib/db/profiles'

/**
 * TYPES
 * ------------------------------------------------------------
 */
type BillingPolicy = 'monthly' | 'right_after' | '24h_before'

type CreateSeriesPayload = {
  user_id: string
  client_id: string
  timezone: string
  dtstart_local: string // 'YYYY-MM-DDTHH:mm:ss'
  duration_min: number
  rule: { interval_weeks: 1 | 2; by_weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6 }
  billing_policy: BillingPolicy
  amount: number
  currency?: 'EUR'
  // Optional booking metadata
  mode?: 'online' | 'in_person'
  location_text?: string | null
  consultation_type?: 'first' | 'followup'
  // Optional safety cap (defaults to 2 - only first 2 occurrences created upfront)
  max_occurrences?: number
  // Optional: suppress Google Calendar notifications to attendees
  suppress_calendar_notifications?: boolean
}

/**
 * HELPERS
 * ------------------------------------------------------------
 */
function toLocalIsoNoZ(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm:ss")
}

function mapPolicyToBilling(policy: BillingPolicy, amount: number, currency: 'EUR') {
  if (policy === 'monthly') {
    return { type: 'monthly', amount, currency } as const
  }
  const lead = policy === 'right_after' ? -1 : 24
  return { type: 'per_booking', amount, currency, paymentEmailLeadHours: lead } as const
}

/**
 * ROUTE HANDLER
 * ------------------------------------------------------------
 */
export async function POST(req: Request) {
  try {
    // 1) Read & validate body (keep it simple)
    const body = (await req.json()) as CreateSeriesPayload
    if (!body?.user_id || !body?.client_id) return NextResponse.json({ error: 'missing user_id/client_id' }, { status: 400 })
    if (!body?.timezone || !body?.dtstart_local || !body?.duration_min) {
      return NextResponse.json({ error: 'missing timezone/dtstart_local/duration_min' }, { status: 400 })
    }
    if (!body?.rule || (body.rule.interval_weeks !== 1 && body.rule.interval_weeks !== 2)) {
      return NextResponse.json({ error: 'invalid rule.interval_weeks' }, { status: 400 })
    }
    if (body.rule.by_weekday < 0 || body.rule.by_weekday > 6) {
      return NextResponse.json({ error: 'invalid rule.by_weekday' }, { status: 400 })
    }
    if (typeof body.amount !== 'number' || Number.isNaN(body.amount) || body.amount < 0) {
      return NextResponse.json({ error: 'invalid amount' }, { status: 400 })
    }
    const currency: 'EUR' = body.currency ?? 'EUR'
    if (currency !== 'EUR') {
      return NextResponse.json({ error: 'unsupported currency' }, { status: 400 })
    }
    const normalizedAmount = Math.round(body.amount * 100) / 100

    // Only create the first 2 occurrences upfront (better UX, cron handles the rest)
    const maxOccurrences = body.max_occurrences && body.max_occurrences > 0 ? body.max_occurrences : 2

    const client = createServiceRoleClient()

    // 2) Create the booking_series master row
    const { id: seriesId } = await createBookingSeries(client, {
      user_id: body.user_id,
      client_id: body.client_id,
      timezone: body.timezone,
      dtstart_local: body.dtstart_local,
      duration_min: body.duration_min,
      interval_weeks: body.rule.interval_weeks,
      by_weekday: body.rule.by_weekday,
      mode: body.mode ?? null,
      location_text: body.location_text ?? null,
      consultation_type: body.consultation_type ?? null
    })

    // 3) Compute a window that will capture the first 2 occurrences
    // For bi-weekly series, we need at least 4 weeks to ensure we get 2 occurrences
    const startLocal = parseISO(body.dtstart_local)
    const endLocal = addMonths(startLocal, 1) // 1 month is enough to capture 2 occurrences (even bi-weekly)
    const windowStartLocal = toLocalIsoNoZ(startLocal)
    const windowEndLocal = toLocalIsoNoZ(endLocal)

    // 4) Generate occurrences (weekly/bi-weekly, tz/DST-safe conversion happens in generator)
    const occurrences = generateOccurrences(
      {
        userId: body.user_id,
        clientId: body.client_id,
        dtstartLocal: body.dtstart_local,
        timezone: body.timezone,
        durationMin: body.duration_min,
        rule: { recurrenceKind: 'WEEKLY', intervalWeeks: body.rule.interval_weeks, byWeekday: body.rule.by_weekday }
      },
      windowStartLocal,
      windowEndLocal,
      maxOccurrences
    )

    // 5) Small idempotency: skip occurrences already present (should be none initially)
    const existing = await getExistingSeriesBookings(seriesId, client)
    const existingIdx = new Set(existing.map((b) => b.occurrence_index))

    // 6) Create bookings per occurrence using the existing orchestrator
    const bookingIds: string[] = []
    for (const occ of occurrences) {
      if (existingIdx.has(occ.occurrenceIndex)) continue

      const billing = mapPolicyToBilling(body.billing_policy, normalizedAmount, currency)

      const result = await orchestrateBookingCreation(
        {
          userId: body.user_id,
          clientId: body.client_id,
          startTime: occ.startUtc,
          endTime: occ.endUtc,
          consultationType: body.consultation_type,
          mode: body.mode,
          locationText: body.location_text ?? null
        },
        billing as any,
        client,
        { suppressCalendar: true, suppressEmail: true }
      )

      bookingIds.push(result.booking.id)

      // Tag booking with series linkage
      await tagBookingWithSeries(result.booking.id, seriesId, occ.occurrenceIndex, client)
    }

    // Create single master recurring Google event and save id
    try {
      const [clientRow, profile] = await Promise.all([
        getClientById(body.client_id, client),
        getProfileById(body.user_id, client)
      ])
      if (clientRow) {
        const master = await createMasterRecurringEvent({
          userId: body.user_id,
          clientName: clientRow.name,
          clientEmail: clientRow.email,
          practitionerName: profile?.name || null,
          practitionerEmail: profile?.email || undefined,
          dtstartLocal: body.dtstart_local,
          timezone: body.timezone,
          durationMin: body.duration_min,
          intervalWeeks: body.rule.interval_weeks,
          byWeekday: body.rule.by_weekday as any,
          mode: (body.mode as any) || 'online',
          locationText: body.location_text || null,
          supabaseClient: client,
          suppressNotifications: body.suppress_calendar_notifications ?? false
        })
        await setBookingSeriesMasterEventId(client, seriesId, master.googleEventId)
      }
    } catch (e) {
      console.error('[series master] failed to create master event', e)
      // Non-fatal; proceed without master
    }

    return NextResponse.json({ series_id: seriesId, created_count: bookingIds.length, booking_ids: bookingIds })
  } catch (error: any) {
    console.error('booking-series/create error', error)
    return NextResponse.json({ error: error?.message || 'unknown_error' }, { status: 500 })
  }
}


