import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { getProfileByEmail } from '@/lib/db/profiles'
import { reconcileCalendarEventsForUser } from '@/lib/calendar/calendar'
import { getExistingRefreshToken, upsertCalendarTokens } from '@/lib/db/calendar-tokens'

const oauth2Client = new google.auth.OAuth2(
	process.env.GOOGLE_CLIENT_ID_CALENDAR,
	process.env.GOOGLE_CLIENT_SECRET_CALENDAR,
	`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/calendar`
)

/**
 * Google Calendar OAuth Callback Route
 *
 * This endpoint is called by Google after the user approves (or denies)
 * access to their Google account. We handle the OAuth code exchange,
 * persist tokens, and optionally reconcile missing calendar events.
 *
 * HIGH-LEVEL FLOW:
 * - Step 0: Parse query parameters (code/state)
 * - Step 1: Exchange authorization code for tokens
 * - Step 2: Determine granted scopes (to know capabilities)
 * - Step 3: Fetch the Google user profile (to derive email)
 * - Step 4: Find our local user profile by email
 * - Step 5: Upsert calendar tokens (preserving refresh_token on re-consent)
 * - Step 6: If full calendar scope, run reconciliation (small batch)
 * - Step 7: Redirect user to appropriate screen based on source and scopes
 */
export async function GET(request: NextRequest) {
	////////////////////////////////////////////////////////
	//// Step 0: Parse query parameters (code/state)
	////////////////////////////////////////////////////////
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
			////////////////////////////////////////////////////////
			//// Step 1: Exchange authorization code for tokens
			////////////////////////////////////////////////////////
			const { tokens } = await oauth2Client.getToken(code)
			oauth2Client.setCredentials(tokens)

			////////////////////////////////////////////////////////
			//// Step 2: Determine granted scopes
			////////////////////////////////////////////////////////
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
				console.warn('Failed to fetch token info for scope detection:', scopeError)
				// Continue without scope info - we'll handle this in the UI
			}

			////////////////////////////////////////////////////////
			//// Step 3: Fetch Google user info (email)
			////////////////////////////////////////////////////////
			const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
			const { data: googleUserInfo } = await oauth2.userinfo.get()

			if (!googleUserInfo.email) {
				throw new Error('Failed to get user email from Google')
			}

			////////////////////////////////////////////////////////
			//// Step 4: Initialize Supabase and resolve our local profile
			////////////////////////////////////////////////////////
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

			// Get Supabase user by email via DB helper
			const { data: profileUser, error: profileError } = await getProfileByEmail(googleUserInfo.email, supabase)

			if (profileError || !profileUser) {
				console.error('Error finding user profile:', profileError)
				throw new Error('Failed to find user profile')
			}

			////////////////////////////////////////////////////////
			//// Step 5: Upsert calendar tokens (preserve refresh_token)
			////////////////////////////////////////////////////////
			const existingRefreshToken = await getExistingRefreshToken(profileUser.id, supabase)

			const effectiveRefreshToken = tokens.refresh_token ?? existingRefreshToken ?? null

			const upsertPayload: {
				user_id: string
				access_token?: string | null
				refresh_token?: string | null
				expiry_date?: number | null
				granted_scopes?: string[] | null
			} = {
				user_id: profileUser.id,
				access_token: tokens.access_token,
				expiry_date: tokens.expiry_date,
				granted_scopes: grantedScopes
			}
			if (effectiveRefreshToken) {
				upsertPayload.refresh_token = effectiveRefreshToken
			}

			await upsertCalendarTokens(upsertPayload, supabase)

			////////////////////////////////////////////////////////
			//// Step 6: Optional reconciliation (requires full access)
			////////////////////////////////////////////////////////
			const hasCalendarAccess = grantedScopes.includes('https://www.googleapis.com/auth/calendar.events')

			// Reconciliation: only attempt if full access granted
			if (hasCalendarAccess) {
				const res = await reconcileCalendarEventsForUser(profileUser.id, { limit: 50 }, supabase)
				console.log('🧩 [Calendar Reconcile] Completed', res)
			} else {
				console.log('🧩 [Calendar Reconcile] Skipped — missing calendar.events scope')
			}

			////////////////////////////////////////////////////////
			//// Step 7: Determine redirect based on source and scope
			////////////////////////////////////////////////////////
			let successRedirect: string

			if (source === 'settings') {
				successRedirect = '/settings?tab=calendar&calendar_connected=true'
			} else {
				if (hasCalendarAccess) {
					// Full permissions granted - proceed to step 3
					successRedirect = '/onboarding?step=3&calendar_connected=true'
				} else {
					// Calendar permissions not granted - stay on step 2 to show upgrade message
					successRedirect = '/onboarding?step=2&calendar_connected=partial'
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
