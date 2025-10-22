import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getUserIdByUsername } from '@/lib/db/profiles'
import { getUserDefaultBillingSettings } from '@/lib/db/billing-settings'
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

		if (!username || !month) {
			return NextResponse.json({ error: 'Missing username or month' }, { status: 400 })
		}

		const service = createServiceRoleClient()
		// Resolve practitioner by username → userId
		const userId = await getUserIdByUsername(username, service as any)
		if (!userId) return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 })

		// Read durations from billing_settings (user defaults)
		const billingDefaults = await getUserDefaultBillingSettings(userId, service as any)

		const followupDuration = Number(billingDefaults?.meeting_duration_min ?? 60)
		const firstDuration =
			billingDefaults?.first_meeting_duration_min != null
				? Number(billingDefaults.first_meeting_duration_min)
				: null

		// Compute both slot sets
		const followup = await computeMonthlySlots({
			userId: userId,
			monthIso: month,
			tz,
			window,
			durationMin: followupDuration,
			supabase: service as any
		})
		const first =
			firstDuration != null
				? await computeMonthlySlots({
						userId: userId,
						monthIso: month,
						tz,
						window,
						durationMin: firstDuration,
						supabase: service as any
					})
				: null

		// Post-filter: enforce a 2-hour buffer for "now" in practitioner's timezone
		// Any slot with start time before (now_in_tz + 2h) is removed
		const applyBufferFilter = (result: { slotsByDay: Record<string, Array<{ start: string; end: string }>> }) => {
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
			return { slotsByDay: filteredSlotsByDay, daysWithSlots }
		}

		try {
			const filteredFollowup = applyBufferFilter(followup)
			const filteredFirst = first ? applyBufferFilter(first) : { slotsByDay: {}, daysWithSlots: [] as string[] }

			const payload = {
				...filteredFollowup,
				firstSlotsByDay: filteredFirst.slotsByDay,
				firstDaysWithSlots: filteredFirst.daysWithSlots,
				durations: { followup: followupDuration, first: firstDuration }
			}
			return NextResponse.json(payload)
		} catch (filterErr) {
			console.warn('[available-slots] buffer filter failed', filterErr)
			return NextResponse.json({
				...followup,
				firstSlotsByDay: first?.slotsByDay || {},
				firstDaysWithSlots: first ? (first as any).daysWithSlots || [] : [],
				durations: { followup: followupDuration, first: firstDuration }
			})
		}
	} catch (e) {
		console.error('available-slots error', e)
		return NextResponse.json({ error: 'failed_to_compute_slots' }, { status: 500 })
	}
}
