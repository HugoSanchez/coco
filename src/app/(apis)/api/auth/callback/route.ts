import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Force dynamic rendering since this route uses cookies for authentication
export const dynamic = 'force-dynamic'

// GET /api/auth/callback
// This route is being called by Supabase AUTH during the authentication flow.
// It exchanges the authorization code for a session token and redirects to the dashboard.

export async function GET(request: Request) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get('code')
	const redirectTo = requestUrl.searchParams.get('redirectTo')

	// Default redirect logic
	let finalRedirect = new URL('/onboarding', requestUrl.origin)

	if (code) {
		const supabase = createClient()
		const { data, error } = await supabase.auth.exchangeCodeForSession(code)

		if (data?.user) {
			// If there's a specific redirect from middleware, use it
			if (redirectTo) {
				finalRedirect = new URL(redirectTo, requestUrl.origin)
			} else {
				// Check if the user has any clients, which indicates they are onboarded.
				const { count } = await supabase
					.from('clients')
					.select('id', { count: 'exact', head: true })
					.eq('user_id', data.user.id)

				// If they have clients (count > 0), redirect to dashboard.
				if (count && count > 0) {
					finalRedirect = new URL('/dashboard', requestUrl.origin)
				}
			}
		}
	}

	// URL to redirect to after sign in process completes
	return NextResponse.redirect(finalRedirect)
}
