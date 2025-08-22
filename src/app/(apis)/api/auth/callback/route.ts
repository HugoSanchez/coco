import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PostHog } from 'posthog-node'
import { sendSignupNotificationEmail } from '@/lib/emails/email-service'

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
			// Capture auth analytics (signup vs signin) using PostHog server SDK
			try {
				if (process.env.POSTHOG_KEY) {
					const ph = new PostHog(process.env.POSTHOG_KEY!, {
						host: process.env.POSTHOG_HOST
					})
					const user = data.user
					const isNewSignup =
						Date.now() - new Date(user.created_at).getTime() <
						10 * 60 * 1000 // 10 minutes heuristic
					await ph.capture({
						distinctId: user.id,
						event: isNewSignup
							? 'user_signed_up'
							: 'user_logged_in',
						properties: {
							email: user.email,
							source: redirectTo || 'auth_callback'
						}
					})
					await ph.shutdown()

					if (isNewSignup) {
						await sendSignupNotificationEmail({
							newUserEmail: user.email || ''
						})
					}
				}
			} catch (_) {
				// Swallow analytics errors; do not block auth flow
			}

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
