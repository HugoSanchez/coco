import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
	const supabase = createClient()

	// Get the user from the session
	const {
		data: { user },
		error
	} = await supabase.auth.getUser()

	if (error || !user) {
		return NextResponse.json({ error: 'Unauthorized 86' }, { status: 401 })
	}

	// This is your protected data
	return NextResponse.json({
		message: 'This is protected data!',
		user: {
			id: user.id,
			email: user.email,
			user: user
		},
		timestamp: new Date().toISOString()
	})
}
