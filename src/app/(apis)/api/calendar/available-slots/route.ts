import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { computeMonthlySlots } from '@/lib/calendar/availability-orchestration'
import { addHours } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
	console.log('available-slots request', request.url)
	try {
		const { searchParams } = new URL(request.url)
		const username = searchParams.get('username')
		const month = searchParams.get('month')
		const tz = searchParams.get('tz') || 'Europe/Madrid'
		const window = searchParams.get('window') || '08:00-20:00'
		const duration = Number(searchParams.get('duration') || '60')

		if (!username || !month) {
			return NextResponse.json({ error: 'Missing username or month' }, { status: 400 })
		}

		const service = createServiceRoleClient()
		// Resolve practitioner by username → userId
		const { data: profile, error } = await service
			.from('profiles')
			.select('id')
			.ilike('username', username)
			.single()
		if (error || !profile) return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 })

		const result = await computeMonthlySlots({
			userId: profile.id,
			monthIso: month,
			tz,
			window,
			durationMin: duration,
			supabase: service as any
		})
		// Post-filter: enforce a 2-hour buffer for "now" in practitioner's timezone
		// Any slot with start time before (now_in_tz + 2h) is removed
		try {
			const nowUtc = new Date()
			const nowInTz = toZonedTime(nowUtc, tz)
			const cutoffInTz = addHours(nowInTz, 2)
			const cutoffUtc = fromZonedTime(cutoffInTz, tz)

			const filteredSlotsByDay: Record<string, Array<{ start: string; end: string }>> = {}
			for (const [day, slots] of Object.entries(result.slotsByDay || {})) {
				filteredSlotsByDay[day] = (slots || []).filter((s) => new Date(s.start) >= cutoffUtc)
			}
			const daysWithSlots = Object.keys(filteredSlotsByDay).filter(
				(d) => (filteredSlotsByDay[d] || []).length > 0
			)

			const payload = { ...result, slotsByDay: filteredSlotsByDay, daysWithSlots }
			console.log('available-slots result', {
				userId: profile.id,
				days: daysWithSlots.length
			})
			return NextResponse.json(payload)
		} catch (filterErr) {
			// If anything goes wrong during filtering, fall back to original result
			console.warn('[available-slots] buffer filter failed', filterErr)
			return NextResponse.json(result)
		}
	} catch (e) {
		console.error('available-slots error', e)
		return NextResponse.json({ error: 'failed_to_compute_slots' }, { status: 500 })
	}
}
