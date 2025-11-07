import { addWeeks, addMinutes, addDays, format, parseISO, isAfter, isBefore } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'

export type WeeklyRule = {
	recurrenceKind: 'WEEKLY'
	intervalWeeks: 1 | 2
	byWeekday: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday .. 6 = Saturday (JS getDay)
}

export type SeriesSpec = {
	userId: string
	clientId: string
	dtstartLocal: string // e.g., '2025-11-11T10:00:00' (no 'Z')
	timezone: string // IANA tz, e.g., 'Europe/Madrid'
	durationMin: number
	rule: WeeklyRule
}

export type Occurrence = {
	occurrenceIndex: number
	localStart: string // 'YYYY-MM-DDTHH:mm:ss' in series timezone (no 'Z')
	localEnd: string // 'YYYY-MM-DDTHH:mm:ss' in series timezone (no 'Z')
	startUtc: string // ISO UTC
	endUtc: string // ISO UTC
	timezone: string
	durationMin: number
}

function ensureWeekday(anchor: Date, byWeekday: number): Date {
	const current = anchor.getDay()
	if (current === byWeekday) return anchor
	const diff = (byWeekday - current + 7) % 7
	return addDays(anchor, diff)
}

function toLocalIsoNoZ(d: Date): string {
	return format(d, "yyyy-MM-dd'T'HH:mm:ss")
}

/**
 * Generates weekly/bi-weekly occurrences anchored on dtstartLocal at a fixed weekday/time.
 * - DST-safe: converts each wall time in the provided timezone to UTC using date-fns-tz.
 * - Window boundaries are interpreted in the same local timezone (inclusive start, exclusive end).
 */
export function generateOccurrences(
	spec: SeriesSpec,
	windowStartLocal: string,
	windowEndLocal: string,
	maxOccurrences?: number
): Occurrence[] {
	if (spec.rule.recurrenceKind !== 'WEEKLY') return []
	if (spec.rule.intervalWeeks !== 1 && spec.rule.intervalWeeks !== 2) return []

	const anchorParsed = parseISO(spec.dtstartLocal)
	const windowStartParsed = parseISO(windowStartLocal)
	const windowEndParsed = parseISO(windowEndLocal)

	// Align anchor to the intended weekday if needed
	let currentLocal = ensureWeekday(anchorParsed, spec.rule.byWeekday)

	// Fast-forward to first occurrence >= windowStartLocal
	while (isBefore(currentLocal, windowStartParsed)) {
		currentLocal = addWeeks(currentLocal, spec.rule.intervalWeeks)
		// Safety cap to avoid infinite loops if bad inputs
		if (isAfter(currentLocal, addWeeks(windowEndParsed, 104))) break
	}

	const results: Occurrence[] = []
	let indexFromAnchor = 0

	// If we advanced, compute the occurrence index based on weeks stepped
	if (!isBefore(currentLocal, anchorParsed)) {
		const msPerWeek = 7 * 24 * 60 * 60 * 1000
		const diffWeeks = Math.round((currentLocal.getTime() - anchorParsed.getTime()) / msPerWeek)
		indexFromAnchor = Math.floor(diffWeeks / spec.rule.intervalWeeks)
	}

	while (isBefore(currentLocal, windowEndParsed)) {
		const localEnd = addMinutes(currentLocal, spec.durationMin)

		// Convert wall times in series timezone to UTC dates
		const startUtcDate = fromZonedTime(currentLocal, spec.timezone)
		const endUtcDate = fromZonedTime(localEnd, spec.timezone)

		results.push({
			occurrenceIndex: indexFromAnchor,
			localStart: toLocalIsoNoZ(currentLocal),
			localEnd: toLocalIsoNoZ(localEnd),
			startUtc: startUtcDate.toISOString(),
			endUtc: endUtcDate.toISOString(),
			timezone: spec.timezone,
			durationMin: spec.durationMin
		})

		if (maxOccurrences && results.length >= maxOccurrences) break

		currentLocal = addWeeks(currentLocal, spec.rule.intervalWeeks)
		indexFromAnchor += 1
	}

	return results
}


