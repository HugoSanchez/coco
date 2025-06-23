import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// GET /api/auth/callback
// This route is being called by Supabase AUTH during the authentication flow.
// It exchanges the authorization code for a session token and redirects to the dashboard.

export async function GET(request: Request) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get('code')

	if (code) {
		const supabase = createClient()
		await supabase.auth.exchangeCodeForSession(code)
	}

	// URL to redirect to after sign in process completes
	return NextResponse.redirect(new URL('/dashboard'))
}
