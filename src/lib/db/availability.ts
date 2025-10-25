/**
 * Weekly Availability DB Helpers
 */

import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabase = createSupabaseClient()

export interface WeeklyAvailabilityRow {
	id: string
	user_id: string
	weekday: number
	start_time: string // time HH:MM:SS
	end_time: string // time HH:MM:SS
	timezone: string
	created_at: string
	updated_at: string
}

export interface AvailabilityRuleInput {
	weekday: number // 0..6
	start: string // HH:MM
	end: string // HH:MM
	timezone: string
}

export async function getWeeklyAvailability(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<WeeklyAvailabilityRow[]> {
	const client = supabaseClient || supabase
	const { data, error } = await client
		.from('weekly_availability')
		.select('*')
		.eq('user_id', userId)
		.order('weekday', { ascending: true })
		.order('start_time', { ascending: true })

	if (error) throw error
	return (data as any) || []
}

export async function replaceWeeklyAvailability(
	userId: string,
	rules: AvailabilityRuleInput[],
	supabaseClient?: SupabaseClient
): Promise<void> {
	const client = supabaseClient || supabase

	// Basic validation
	for (const r of rules) {
		if (r.weekday < 0 || r.weekday > 6) throw new Error('Invalid weekday')
		if (!/^\d{2}:\d{2}$/.test(r.start) || !/^\d{2}:\d{2}$/.test(r.end)) {
			throw new Error('Invalid time format, expected HH:MM')
		}
		if (r.start >= r.end) throw new Error('start must be earlier than end')
	}

	// Check overlaps per weekday (app-side)
	const byDay: Record<number, AvailabilityRuleInput[]> = {}
	rules.forEach((r) => {
		byDay[r.weekday] = byDay[r.weekday] || []
		byDay[r.weekday].push(r)
	})
	for (const key of Object.keys(byDay)) {
		const dayRules = byDay[Number(key)].sort((a, b) => (a.start < b.start ? -1 : 1))
		for (let i = 1; i < dayRules.length; i++) {
			if (dayRules[i].start < dayRules[i - 1].end) {
				throw new Error('Overlapping intervals on the same weekday')
			}
		}
	}

	// Transactional replace (delete then insert)
	const { error: delErr } = await client.from('weekly_availability').delete().eq('user_id', userId)
	if (delErr) throw delErr

	if (rules.length === 0) return

	const rows = rules.map((r) => ({
		user_id: userId,
		weekday: r.weekday,
		start_time: r.start + ':00', // normalize to HH:MM:SS
		end_time: r.end + ':00',
		timezone: r.timezone
	}))

	const { error: insErr } = await client.from('weekly_availability').insert(rows)
	if (insErr) throw insErr
}
