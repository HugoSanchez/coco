import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
	const supabase = createClient()

	// Get the user from the session (middleware already verified they're authenticated)
	const {
		data: { user }
	} = await supabase.auth.getUser()

	// This is your protected data
	return NextResponse.json({
		message: 'This is protected data!',
		user: user
			? {
					id: user.id,
					email: user.email,
					user: user
				}
			: null,
		timestamp: new Date().toISOString()
	})
}
