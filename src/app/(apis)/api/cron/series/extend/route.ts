import { NextResponse } from 'next/server'
import { addWeeks, addDays, format, parseISO } from 'date-fns'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { listAllActiveSeries } from '@/lib/db/booking-series'
import { getClientBillingSettings, getUserDefaultBillingSettings } from '@/lib/db/billing-settings'
import { getSeriesMaxOccurrenceIndex, tagBookingWithSeries } from '@/lib/db/bookings'
import { generateOccurrences } from '@/lib/dates/recurrence'
import { orchestrateBookingCreation } from '@/lib/bookings/booking-orchestration-service'

/**
 * GET /api/cron/series/extend
 * ------------------------------------------------------------
 * Weekly extension job for recurring series.
 *
 * WHAT IT DOES (V1)
 * - For each active booking_series, compute the next occurrence ONLY
 * - Create that single booking via the existing orchestrator (emails/calendar preserved)
 * - Tag the booking with (series_id, occurrence_index)
 * - Ignore overlaps/conflicts by design (requested policy)
 *
 * HOW IT COMPUTES THE NEXT OCCURRENCE
 * - Reads the max occurrence_index already materialized for the series (or -1 if none)
 * - Computes next occurrence index = max + 1
 * - Computes the local window as [nextLocalStart, nextLocalStart + 7 days)
 * - Calls the weekly/bi-weekly generator with maxOccurrences=1 to get exactly that item
 *
 * BILLING POLICY
 * - Derived from billing_settings (client-specific > user default)
 * - monthly => orchestrator billing.type='monthly'
 * - per-booking => lead hours from payment_email_lead_hours; clamped to {-1, 24}
 */

function toLocalIsoNoZ(d: Date): string {
	return format(d, "yyyy-MM-dd'T'HH:mm:ss")
}

function mapBillingFromSettings(settings: any, amount: number) {
	const currency: 'EUR' = 'EUR'
	if (settings?.billing_type === 'monthly') {
		return { type: 'monthly', amount, currency } as const
	}
	const lead = settings?.payment_email_lead_hours === 24 ? 24 : -1
	return { type: 'per_booking', amount, currency, paymentEmailLeadHours: lead } as const
}

export async function GET(request: Request) {
	try {
		////////////////////////////////////////////////////////////////
		// Step 0: Authenticate request
		////////////////////////////////////////////////////////////////
		const auth = process.env.CRON_SECRET
		const header = request.headers.get('authorization')
		if (!auth || !header?.startsWith('Bearer ') || header.split(' ')[1] !== auth) {
			return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
		}

		const client = createServiceRoleClient()

		////////////////////////////////////////////////////////////////
		// Step 1: Load all active series
		////////////////////////////////////////////////////////////////
		const seriesList = await listAllActiveSeries(client)
		let processed = 0
		let created = 0

		////////////////////////////////////////////////////////////////
		// Step 2: Iterate series and extend by exactly one next occurrence
		////////////////////////////////////////////////////////////////
		for (const series of seriesList) {
			processed += 1
			try {
				////////////////////////////////////////////////////////////////
				// Step 2.1: Determine next occurrence index
				////////////////////////////////////////////////////////////////
				const maxIdx = await getSeriesMaxOccurrenceIndex(series.id, client)
				const nextIdx = maxIdx + 1

				////////////////////////////////////////////////////////////////
				// Step 2.2: Compute the local window anchored at nextIdx
				////////////////////////////////////////////////////////////////
				const anchor = parseISO(series.dtstart_local)
				const nextLocalStart = addWeeks(anchor, series.interval_weeks * nextIdx)
				const windowStartLocal = toLocalIsoNoZ(nextLocalStart)
				const windowEndLocal = toLocalIsoNoZ(addDays(nextLocalStart, 7))

				////////////////////////////////////////////////////////////////
				// Step 2.3: Generate exactly one occurrence for this window
				////////////////////////////////////////////////////////////////
				const occs = generateOccurrences(
					{
						userId: series.user_id,
						clientId: series.client_id,
						dtstartLocal: series.dtstart_local,
						timezone: series.timezone,
						durationMin: series.duration_min,
						rule: {
							recurrenceKind: 'WEEKLY',
							intervalWeeks: series.interval_weeks,
							byWeekday: series.by_weekday
						}
					},
					windowStartLocal,
					windowEndLocal,
					1
				)
				if (occs.length === 0) continue
				const occ = occs[0]

				////////////////////////////////////////////////////////////////
				// Step 2.4: Resolve billing settings and amount
				////////////////////////////////////////////////////////////////
				const clientSettings = await getClientBillingSettings(series.user_id, series.client_id, client)
				const userDefault = clientSettings ? null : await getUserDefaultBillingSettings(series.user_id, client)
				const fallbackAmount = clientSettings?.billing_amount ?? userDefault?.billing_amount ?? 0
				const amount =
					occ.occurrenceIndex === 0 && clientSettings?.first_consultation_amount != null
						? Number(clientSettings.first_consultation_amount)
						: Number(fallbackAmount)
				const billing = mapBillingFromSettings(clientSettings || userDefault, amount)

				////////////////////////////////////////////////////////////////
				// Step 2.5: Create booking via orchestrator
				// V2: Suppress calendar if master event exists (to avoid duplicate Google events)
				////////////////////////////////////////////////////////////////
				const hasMasterEvent = Boolean(series.google_master_event_id)
				const result = await orchestrateBookingCreation(
					{
						userId: series.user_id,
						clientId: series.client_id,
						startTime: occ.startUtc,
						endTime: occ.endUtc,
						consultationType: (series as any).consultation_type || undefined,
						mode: (series as any).mode || undefined,
						locationText: (series as any).location_text || null
					},
					billing as any,
					client,
					{ suppressCalendar: hasMasterEvent, suppressEmail: true }
				)

				////////////////////////////////////////////////////////////////
				// Step 2.6: Tag the booking with series linkage
				////////////////////////////////////////////////////////////////
				await tagBookingWithSeries(result.booking.id, series.id, occ.occurrenceIndex, client)
				created += 1
			} catch (e) {
				// Best-effort per series; continue with the next
				console.error('[cron series extend] failed for series', (series as any)?.id, e)
			}
		}

		////////////////////////////////////////////////////////////////
		// Step 3: Return results
		////////////////////////////////////////////////////////////////
		return NextResponse.json({ processed, created })
	} catch (error: any) {
		console.error('[cron series extend] fatal', error)
		return NextResponse.json({ error: error?.message || 'unknown_error' }, { status: 500 })
	}
}
