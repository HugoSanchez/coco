/**
 * Series Materializer (Minimal, Pure Planner)
 *
 * PURPOSE
 * - Given a recurring series and a time window, compute the concrete booking
 *   occurrences we should insert. PURE: no DB writes here.
 *
 * HOW IT FITS
 * - The API layer ("create series" or cron extender) will:
 *   1) Load series + existing bookings in the window
 *   2) Call planMaterialization(...)
 *   3) Persist the returned drafts as new rows in `bookings`
 *
 * SCOPE (V1)
 * - Recurrence: weekly / bi-weekly (intervalWeeks = 1 | 2)
 * - Conflict policy: IGNORE OVERLAPS (we don't check or flag conflicts in V1)
 * - Horizon: caller-provided (e.g., next 2 months)
 */

import { generateOccurrences, type SeriesSpec, type WeeklyRule } from '@/lib/dates/recurrence'

/**
 * TYPES (kept small and booking-centric)
 */

export type SeriesMinimal = {
	id: string
	userId: string
	clientId: string
	timezone: string
	dtstartLocal: string // e.g., '2025-11-11T10:00:00' (no 'Z')
	durationMin: number
	rule: WeeklyRule
	// Optional booking metadata you might want to carry into drafts (kept generic)
	mode?: string | null
	location_text?: string | null
	consultation_type?: string | null
}

export type MaterializeWindow = {
	windowStartLocal: string
	windowEndLocal: string
	maxOccurrences?: number
}

export type ExistingSeriesBooking = {
	id: string
	occurrence_index: number
	start_time: string // ISO UTC
	end_time: string // ISO UTC
}

export type BookingInsertDraft = {
	series_id: string
	user_id: string
	client_id: string
	start_time: string // ISO UTC
	end_time: string // ISO UTC
	occurrence_index: number
	is_conflicted: boolean // V1: always false (we ignore overlaps)
	mode?: string | null
	location_text?: string | null
	consultation_type?: string | null
}

export type MaterializePlan = {
	createdDrafts: BookingInsertDraft[]
	skippedExisting: number
}

/**
 * planMaterialization
 * - Prepares booking drafts for all missing occurrences inside the window.
 * - Idempotent with respect to (series_id, occurrence_index): existing are skipped.
 * - V1: No conflict checks; drafts are always created with is_conflicted = false.
 */
export function planMaterialization(
	series: SeriesMinimal,
	win: MaterializeWindow,
	existingSeriesBookings: ExistingSeriesBooking[] = []
): MaterializePlan {
	// 1) Generate target occurrences using the pure date generator
	const spec: SeriesSpec = {
		userId: series.userId,
		clientId: series.clientId,
		dtstartLocal: series.dtstartLocal,
		timezone: series.timezone,
		durationMin: series.durationMin,
		rule: series.rule
	}

	const occurrences = generateOccurrences(spec, win.windowStartLocal, win.windowEndLocal, win.maxOccurrences)

	// 2) Build a fast lookup of existing occurrence indexes to avoid duplicates
	const existingIndexes = new Set<number>(existingSeriesBookings.map((b) => b.occurrence_index))

	// 3) For each planned occurrence, create a draft unless it already exists
	const drafts: BookingInsertDraft[] = []
	let skippedExisting = 0

	for (const occ of occurrences) {
		if (existingIndexes.has(occ.occurrenceIndex)) {
			skippedExisting += 1
			continue
		}

		drafts.push({
			series_id: series.id,
			user_id: series.userId,
			client_id: series.clientId,
			start_time: occ.startUtc,
			end_time: occ.endUtc,
			occurrence_index: occ.occurrenceIndex,
			is_conflicted: false,
			mode: series.mode ?? null,
			location_text: series.location_text ?? null,
			consultation_type: series.consultation_type ?? null
		})
	}

	return {
		createdDrafts: drafts,
		skippedExisting
	}
}
