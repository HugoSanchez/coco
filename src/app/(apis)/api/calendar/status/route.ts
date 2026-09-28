import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedCalendar } from '@/lib/google'
import { CalendarDisconnectedError } from '@/lib/calendar/connection-status'

export async function GET(_request: NextRequest) {
	try {
		const supabase = createClient()
		const {
			data: { user },
			error: userError
		} = await supabase.auth.getUser()

		if (userError || !user) {
			return NextResponse.json(
				{ connected: null, error: 'unauthorized' },
				{ status: 401 }
			)
		}

		try {
			await getAuthenticatedCalendar(user.id, supabase)
			return NextResponse.json({ connected: true })
		} catch (error) {
			if (error instanceof CalendarDisconnectedError) {
				return NextResponse.json({ connected: false, error: 'reconnect_required' })
			}
			return NextResponse.json(
				{ connected: null, error: 'calendar_check_failed' },
				{ status: 503 }
			)
		}
	} catch (e: any) {
		return NextResponse.json(
			{ connected: null, error: 'internal_error' },
			{ status: 500 }
		)
	}
}
