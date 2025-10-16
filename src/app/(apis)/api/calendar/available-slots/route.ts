import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { computeMonthlySlots } from '@/lib/calendar/availability-orchestration'

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

		// debug logs removed

		return NextResponse.json(result)
	} catch (e) {
		console.error('available-slots error', e)
		return NextResponse.json({ error: 'failed_to_compute_slots' }, { status: 500 })
	}
}
