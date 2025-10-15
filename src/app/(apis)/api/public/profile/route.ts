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
			.select('id, name, description, profile_picture_url')
			.eq('username', username)
			.single()
		if (pErr || !profile) return NextResponse.json({ error: 'not_found' }, { status: 404 })

		const { data: schedule } = await service
			.from('schedules')
			.select('meeting_duration')
			.eq('user_id', profile.id)
			.single()

		const response = {
			id: profile.id,
			name: profile.name,
			description: profile.description,
			profile_picture_url: profile.profile_picture_url,
			schedules: {
				meeting_duration: schedule?.meeting_duration ?? 60
			}
		}

		return NextResponse.json(response)
	} catch (e) {
		console.error('public profile error', e)
		return NextResponse.json({ error: 'server_error' }, { status: 500 })
	}
}
