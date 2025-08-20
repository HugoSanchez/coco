import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedCalendar } from '@/lib/google'

export async function GET(_request: NextRequest) {
	try {
		const supabase = createClient()
		const {
			data: { user },
			error: userError
		} = await supabase.auth.getUser()

		if (userError || !user) {
			return NextResponse.json(
				{ connected: false, error: 'unauthorized' },
				{ status: 401 }
			)
		}

		try {
			await getAuthenticatedCalendar(user.id, supabase)
			return NextResponse.json({ connected: true })
		} catch (error: any) {
			return NextResponse.json({
				connected: false,
				error: error?.message || 'calendar_error'
			})
		}
	} catch (e: any) {
		return NextResponse.json(
			{ connected: false, error: 'internal_error' },
			{ status: 500 }
		)
	}
}
