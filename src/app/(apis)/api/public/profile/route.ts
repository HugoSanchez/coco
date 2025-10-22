import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url)
		const username = searchParams.get('username')
		if (!username) return NextResponse.json({ error: 'missing_username' }, { status: 400 })

		const service = createServiceRoleClient()

		const { data: profile, error: pErr } = await service
			.from('profiles')
			.select('*')
			.ilike('username', username)
			.single()
		if (pErr || !profile) return NextResponse.json({ error: 'not_found' }, { status: 404 })

		const { data: schedule } = await service
			.from('schedules')
			.select('meeting_duration')
			.eq('user_id', profile.id)
			.single()

		// Fetch default billing settings to expose price info publicly (non-sensitive subset)
		const { data: billingDefaults } = await service
			.from('billing_settings')
			.select('billing_amount, currency, first_consultation_amount, updated_at, is_default')
			.eq('user_id', profile.id)
			.is('client_id', null)
			.is('booking_id', null)
			.eq('is_default', true)
			.order('updated_at', { ascending: false })
			.limit(1)
			.maybeSingle()

		const response = {
			id: profile.id,
			name: profile.name,
			description: profile.description,
			profile_picture_url: profile.profile_picture_url,
			schedules: {
				meeting_duration: schedule?.meeting_duration ?? 60
			},
			pricing: {
				amount: billingDefaults?.billing_amount ?? 0,
				currency: billingDefaults?.currency ?? 'EUR',
				first_consultation_amount: billingDefaults?.first_consultation_amount ?? null
			}
		}

		return NextResponse.json(response)
	} catch (e) {
		console.error('public profile error', e)
		return NextResponse.json({ error: 'server_error' }, { status: 500 })
	}
}
