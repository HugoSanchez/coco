import { startOfMonth, endOfMonth, eachDayOfInterval, setHours, setMinutes, addMinutes, isBefore } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getBookingsForDateRange } from '@/lib/db/bookings'
import { getSystemGoogleEventIds } from '@/lib/db/calendar-events'
import { getWeeklyAvailability } from '@/lib/db/availability'
import { getGoogleCalendarEventsForRange } from '@/lib/calendar/calendar'

type IsoString = string

export type MonthlySlots = {
	slotsByDay: Record<string, Array<{ start: IsoString; end: IsoString }>>
	daysWithSlots: string[]
}

function parseWindow(window: string): { startH: number; startM: number; endH: number; endM: number } {
	// format "HH:MM-HH:MM"
	const m = window.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/)
	if (!m) return { startH: 8, startM: 0, endH: 20, endM: 0 }
	return { startH: +m[1], startM: +m[2], endH: +m[3], endM: +m[4] }
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
	return aStart < bEnd && aEnd > bStart
}

export async function computeMonthlySlots(options: {
	userId: string
	monthIso: string
	tz?: string
	window?: string
	durationMin?: number
	supabase?: SupabaseClient
}): Promise<MonthlySlots> {
	////////////////////////////////////////////////////////////
	//// Step 0: Normalize inputs and default configuration
	//// - tz: execution timezone for window computation (CET)
	//// - window: practitioner daily window (HH:mm-HH:mm)
	//// - durationMin: fixed slot length (MVP = 60)
	////////////////////////////////////////////////////////////
	const tz = options.tz || 'Europe/Madrid'
	const windowStr = options.window || '08:00-20:00'
	const durationMin = options.durationMin ?? 60
	const { startH, startM, endH, endM } = parseWindow(windowStr)

	////////////////////////////////////////////////////////////
	//// Step 1: Resolve month boundaries from provided month ISO
	////////////////////////////////////////////////////////////
	const monthDate = new Date(options.monthIso)
	if (Number.isNaN(monthDate.getTime())) {
		throw new Error('Invalid month parameter')
	}

	const monthStart = startOfMonth(monthDate)
	const monthEnd = endOfMonth(monthDate)

	////////////////////////////////////////////////////////////
	//// Step 2: Preload DB bookings for the full month
	//// - Single range query → avoids N (days) lookups
	////////////////////////////////////////////////////////////
	const bookings = await getBookingsForDateRange(
		options.userId,
		monthStart.toISOString(),
		monthEnd.toISOString(),
		options.supabase
	)

	////////////////////////////////////////////////////////////
	//// Step 3: Preload system Google event IDs (dedup external)
	////////////////////////////////////////////////////////////
	let systemEventIds: string[] = []
	try {
		systemEventIds = await getSystemGoogleEventIds(options.userId, options.supabase)
	} catch (_) {
		systemEventIds = []
	}
	const systemIdSet = new Set(systemEventIds)

	const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
	const slotsByDay: Record<string, Array<{ start: IsoString; end: IsoString }>> = {}

	////////////////////////////////////////////////////////////
	//// Step 3b: Load weekly availability configuration
	//// - If no rules exist, we will fall back to windowStr for all days
	////////////////////////////////////////////////////////////
	let availabilityByWeekday: Record<
		number,
		Array<{ startH: number; startM: number; endH: number; endM: number; tz: string }>
	> = {}
	try {
		const rules = await getWeeklyAvailability(options.userId, options.supabase)
		for (const r of rules) {
			const s = (r.start_time || '').slice(0, 5)
			const e = (r.end_time || '').slice(0, 5)
			const [sh, sm] = s.split(':').map((v) => parseInt(v || '0', 10))
			const [eh, em] = e.split(':').map((v) => parseInt(v || '0', 10))
			if (!availabilityByWeekday[r.weekday]) availabilityByWeekday[r.weekday] = []
			availabilityByWeekday[r.weekday].push({ startH: sh, startM: sm, endH: eh, endM: em, tz: r.timezone || tz })
		}
	} catch (_) {
		availabilityByWeekday = {}
	}

	////////////////////////////////////////////////////////////
	//// Step 4: Fetch external events ONCE for the month
	//// - Single Google call, then bucket by dayKey in tz
	////////////////////////////////////////////////////////////
	const externalMonth = await getGoogleCalendarEventsForRange(options.userId, monthStart, monthEnd, options.supabase)
	const externalBuckets = new Map<string, typeof externalMonth>()
	for (const e of externalMonth) {
		const eStart = new Date(e.start)
		const eEnd = new Date(e.end)
		// Compute day range in practitioner tz to account for cross-midnight events
		const startTz = toZonedTime(eStart, tz)
		const endTz = toZonedTime(eEnd, tz)
		const dayCursor = new Date(startTz)
		dayCursor.setHours(0, 0, 0, 0)
		const dayEnd = new Date(endTz)
		dayEnd.setHours(0, 0, 0, 0)
		let guard = 0
		while (dayCursor.getTime() <= dayEnd.getTime() && guard < 32) {
			const key = `${dayCursor.getFullYear()}-${String(dayCursor.getMonth() + 1).padStart(2, '0')}-${String(dayCursor.getDate()).padStart(2, '0')}`
			if (!externalBuckets.has(key)) externalBuckets.set(key, [])
			externalBuckets.get(key)!.push(e)
			dayCursor.setDate(dayCursor.getDate() + 1)
			guard++
		}
	}

	for (const day of days) {
		////////////////////////////////////////////////////////////
		//// Step 5: Prepare day context (key)
		////////////////////////////////////////////////////////////
		const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
		slotsByDay[dayKey] = []

		// Determine applicable availability rules for this weekday
		const weekday = day.getDay() // 0..6 (Sun..Sat)
		const rulesForDay = availabilityByWeekday[weekday]

		// If weekly availability exists but there are no rules for this day, skip (no slots)
		if (Object.keys(availabilityByWeekday).length > 0 && (!rulesForDay || rulesForDay.length === 0)) {
			continue
		}

		// If no weekly rules configured at all, fall back to global window
		const effectiveRules =
			rulesForDay && rulesForDay.length > 0 ? rulesForDay : [{ startH, startM, endH, endM, tz }]

		for (const rule of effectiveRules) {
			// Compute window for the day → UTC instants using rule's timezone
			const windowStartUTC = fromZonedTime(setMinutes(setHours(day, rule.startH), rule.startM), rule.tz)
			const windowEndUTC = fromZonedTime(setMinutes(setHours(day, rule.endH), rule.endM), rule.tz)

			//////////////////////////////////////////////////////////
			//// Step 6: Build busy intervals for this day+rule window
			//////////////////////////////////////////////////////////
			const busy: Array<{ start: Date; end: Date }> = []

			// DB bookings overlap with this window
			for (const b of bookings) {
				const bStart = new Date(b.start_time)
				const bEnd = new Date(b.end_time)
				if (overlaps(windowStartUTC, windowEndUTC, bStart, bEnd)) {
					busy.push({ start: bStart, end: bEnd })
				}
			}

			// External events overlap with this window
			try {
				const bucket = externalBuckets.get(dayKey) || []
				for (const e of bucket) {
					if (systemIdSet.has(e.googleEventId)) continue
					const eStart = new Date(e.start)
					const eEnd = new Date(e.end)
					if (overlaps(windowStartUTC, windowEndUTC, eStart, eEnd)) {
						busy.push({ start: eStart, end: eEnd })
					}
				}
			} catch (_) {
				// ignore google failures
			}

			//////////////////////////////////////////////////////////
			//// Step 7: Generate candidate slots and filter by overlaps
			//////////////////////////////////////////////////////////
			let cursor = new Date(windowStartUTC)
			while (
				isBefore(addMinutes(cursor, durationMin), windowEndUTC) ||
				+addMinutes(cursor, durationMin) === +windowEndUTC
			) {
				const slotStart = new Date(cursor)
				const slotEnd = addMinutes(slotStart, durationMin)

				const overlapping = busy.some((b) => overlaps(slotStart, slotEnd, b.start, b.end))
				if (!overlapping) {
					slotsByDay[dayKey].push({ start: slotStart.toISOString(), end: slotEnd.toISOString() })
				}
				cursor = slotEnd
			}
		}
	}

	////////////////////////////////////////////////////////////
	//// Step 8: Assemble response
	////////////////////////////////////////////////////////////
	const daysWithSlots = Object.keys(slotsByDay).filter((k) => (slotsByDay[k]?.length || 0) > 0)
	return { slotsByDay, daysWithSlots }
}
