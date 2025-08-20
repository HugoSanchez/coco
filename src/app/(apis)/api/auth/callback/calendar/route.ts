import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const oauth2Client = new google.auth.OAuth2(
	process.env.GOOGLE_CLIENT_ID_CALENDAR,
	process.env.GOOGLE_CLIENT_SECRET_CALENDAR,
	`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/calendar`
)

// GET /api/auth/callback/calendar
// This is the callback route for the Google Calendar API
// It is called by Google when the user is redirected back to the app
// after they have authorized the app to access their calendar.
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams
	const code = searchParams.get('code')
	const state = searchParams.get('state')

	// Parse source from state parameter, default to onboarding
	let source = 'onboarding'
	try {
		if (state) {
			const stateData = JSON.parse(state)
			source = stateData.source || 'onboarding'
		}
	} catch (error) {
		console.warn('Failed to parse OAuth state parameter:', error)
	}

	if (code) {
		try {
			// Get the access token from Google
			const { tokens } = await oauth2Client.getToken(code)
			oauth2Client.setCredentials(tokens)

			// Get token info to check granted scopes
			let grantedScopes: string[] = []
			try {
				const tokenInfoResponse = await fetch(
					`https://oauth2.googleapis.com/tokeninfo?access_token=${tokens.access_token}`
				)
				const tokenInfo = await tokenInfoResponse.json()

				if (tokenInfo.scope) {
					grantedScopes = tokenInfo.scope.split(' ')
				}
			} catch (scopeError) {
				console.warn(
					'Failed to fetch token info for scope detection:',
					scopeError
				)
				// Continue without scope info - we'll handle this in the UI
			}

			// Get user info from Google
			const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
			const { data: googleUserInfo } = await oauth2.userinfo.get()

			if (!googleUserInfo.email) {
				throw new Error('Failed to get user email from Google')
			}

			// Initialize Supabase client
			const supabase = createClient(
				process.env.NEXT_PUBLIC_SUPABASE_URL!,
				process.env.SUPABASE_SERVICE_ROLE_KEY!,
				{
					auth: {
						autoRefreshToken: false,
						persistSession: false
					}
				}
			)

			// Get Supabase user by email
			const { data: profileUser, error: profileError } = await supabase
				.from('profiles')
				.select('*')
				.eq('email', googleUserInfo.email)
				.single()

			if (profileError || !profileUser) {
				console.error('Error finding user profile:', profileError)
				throw new Error('Failed to find user profile')
			}

			// Upsert the calendar tokens with granted scopes
			// Preserve existing refresh_token if Google didn't return one (common on re-consent)
			const { data: existingTokenRow } = await supabase
				.from('calendar_tokens')
				.select('refresh_token')
				.eq('user_id', profileUser.id)
				.single()

			const effectiveRefreshToken =
				tokens.refresh_token ?? existingTokenRow?.refresh_token ?? null

			const upsertPayload: Record<string, any> = {
				user_id: profileUser.id,
				access_token: tokens.access_token,
				expiry_date: tokens.expiry_date,
				granted_scopes: grantedScopes
			}
			if (effectiveRefreshToken) {
				upsertPayload.refresh_token = effectiveRefreshToken
			}

			const { error: tokenError } = await supabase
				.from('calendar_tokens')
				.upsert(upsertPayload, { onConflict: 'user_id' })

			if (tokenError) throw tokenError

			// Determine redirect based on source and granted permissions
			let successRedirect: string

			if (source === 'settings') {
				successRedirect =
					'/settings?tab=calendar&calendar_connected=true'
			} else {
				// For onboarding, check if user granted calendar permissions
				const hasCalendarAccess = grantedScopes.includes(
					'https://www.googleapis.com/auth/calendar.events'
				)

				if (hasCalendarAccess) {
					// Full permissions granted - proceed to step 3
					successRedirect =
						'/onboarding?step=3&calendar_connected=true'
				} else {
					// Calendar permissions not granted - stay on step 2 to show upgrade message
					successRedirect =
						'/onboarding?step=2&calendar_connected=partial'
				}
			}

			return NextResponse.redirect(new URL(successRedirect, request.url))
		} catch (error) {
			console.error('Error in Google Calendar callback:', error)

			// Redirect based on source with error indicator
			const errorRedirect =
				source === 'settings'
					? '/settings?tab=calendar&calendar_connected=false'
					: '/onboarding?step=2&calendar_connected=false'

			return NextResponse.redirect(new URL(errorRedirect, request.url))
		}
	} else {
		return new NextResponse('No code provided', { status: 400 })
	}
}
