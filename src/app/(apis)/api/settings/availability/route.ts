import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWeeklyAvailability, replaceWeeklyAvailability, type AvailabilityRuleInput } from '@/lib/db/availability'

export const dynamic = 'force-dynamic'

export async function GET() {
	try {
		const supabase = createClient()
		const {
			data: { user },
			error
		} = await supabase.auth.getUser()
		if (error || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

		const rows = await getWeeklyAvailability(user.id, supabase)
		return NextResponse.json({ rules: rows })
	} catch (e) {
		console.error('availability GET error', e)
		return NextResponse.json({ error: 'server_error' }, { status: 500 })
	}
}

export async function POST(request: NextRequest) {
	try {
		const supabase = createClient()
		const {
			data: { user },
			error
		} = await supabase.auth.getUser()
		if (error || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

		const body = (await request.json()) as { rules: AvailabilityRuleInput[] }
		if (!body || !Array.isArray(body.rules)) {
			return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
		}

		await replaceWeeklyAvailability(user.id, body.rules, supabase)
		return NextResponse.json({ success: true })
	} catch (e: any) {
		console.error('availability POST error', e)
		const message = e instanceof Error ? e.message : 'server_error'
		return NextResponse.json({ error: message }, { status: 500 })
	}
}
