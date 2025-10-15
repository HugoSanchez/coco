/**
 * Google OAuth and Calendar Integration Utilities
 *
 * This module provides core Google API authentication and calendar utilities
 * that are shared across the application. It handles:
 *
 * - OAuth2 client configuration and setup
 * - Access token refresh automation
 * - Authenticated Google Calendar client creation
 * - Token management and persistence
 *
 * All calendar operations should use these utilities for consistent
 * authentication handling and token management.
 */

import { google } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getUserCalendarTokens, updateUserCalendarTokens, deleteUserCalendarTokens } from '../db/calendar-tokens'

const clientId = process.env.GOOGLE_CLIENT_ID_CALENDAR
const clientSecret = process.env.GOOGLE_CLIENT_SECRET_CALENDAR
const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/calendar`

if (!clientId || !clientSecret || !process.env.NEXT_PUBLIC_BASE_URL) {
	console.error('Missing Google Calendar environment variables', {
		clientId: !!clientId,
		clientSecret: !!clientSecret,
		baseUrl: process.env.NEXT_PUBLIC_BASE_URL
	})
	throw new Error('Missing Google Calendar environment variables')
}

export function createOAuthClient() {
	return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

/**
 * Refreshes an expired Google Calendar access token using the refresh token
 *
 * When Google Calendar access tokens expire (typically after 1 hour), this function
 * uses the stored refresh token to obtain a new access token. The new token is
 * automatically saved to the database for future use.
 *
 * This is a core utility function used by all calendar operations to ensure
 * valid authentication tokens are always available.
 *
 * @param userId - The user's UUID whose token needs refreshing
 * @param refreshToken - The user's stored refresh token from Google
 * @param supabaseClient - Optional Supabase client for backend operations
 * @returns Promise<string> - The new access token
 * @throws Error if refresh fails or Google API returns no token
 */
export async function refreshToken(
	userId: string,
	refreshToken: string,
	supabaseClient?: SupabaseClient
): Promise<string> {
	console.log('🔄 [Token] Starting token refresh for user:', userId)

	// Use a per-request OAuth2 client to avoid cross-user credential bleed
	const oauth2Client = createOAuthClient()
	// Set the credentials to the refresh token
	oauth2Client.setCredentials({ refresh_token: refreshToken })

	try {
		// Request a new access token from Google
		// Ask Google for a new access token
		const tokenResponse = await oauth2Client.getAccessToken()

		// If unsuccessful, throw an error
		if (!tokenResponse.token) {
			console.error('❌ [Token] Google returned no access token for user:', userId)
			throw new Error('No access token returned after refresh')
		}

		// Determine absolute expiry epoch (ms).
		// Prefer the HTTP response's expires_in (seconds) when available.
		// Guard against near-now expiries to avoid immediate re-refresh loops.
		const expiresInSeconds: number | undefined = (tokenResponse as any)?.res?.data?.expires_in
		let expiryEpochMs =
			expiresInSeconds && Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
				? Date.now() + expiresInSeconds * 1000
				: oauth2Client.credentials.expiry_date || Date.now() + 3600 * 1000
		if (expiryEpochMs <= Date.now() + 120_000) {
			expiryEpochMs = Date.now() + 3600 * 1000
		}

		try {
			// update the token in the database
			await updateUserCalendarTokens(tokenResponse, userId, expiryEpochMs, supabaseClient)
		} catch (dbError) {
			console.error('❌ [Token] Failed to update token in database for user:', userId, 'Error:', dbError)
			throw new Error('Failed to update refreshed token in database')
		}

		// and return token
		return tokenResponse.token
	} catch (error: any) {
		console.error('❌ [Token] Token refresh failed for user:', userId, 'Error:', error.message || error)

		// Structured debug payload for invalid_grant and other auth failures
		const debugPayload = {
			userId,
			errorMessage: error?.message || String(error),
			name: error?.name,
			code: error?.code,
			responseStatus: error?.response?.status,
			responseData: error?.response?.data,
			hint: 'If errorMessage includes invalid_grant, user likely revoked access or refresh token aged out.'
		}
		console.log('🧪 [Token] Refresh debug payload:', debugPayload)

		// Handle invalid_grant errors specifically
		if (error.message?.includes('invalid_grant')) {
			console.log('🧹 [Token] Cleaning up invalid tokens for user:', userId)
			try {
				// Clean up the invalid tokens from database
				await deleteUserCalendarTokens(userId, supabaseClient)
				console.log('✅ [Token] Invalid tokens cleaned up for user:', userId)
			} catch (cleanupError) {
				console.error('❌ [Token] Failed to cleanup tokens for user:', userId, 'Error:', cleanupError)
			}
			throw new Error('Calendar access expired - please reconnect your Google Calendar')
		}

		throw error
	}
}

/**
 * Gets an authenticated Google Calendar client for a user
 *
 * This is the primary utility function for all calendar operations. It:
 * 1. Fetches the user's stored calendar tokens
 * 2. Automatically refreshes expired tokens when needed
 * 3. Configures the OAuth2 client with valid credentials
 * 4. Returns a ready-to-use Google Calendar API client
 *
 * This consolidates the authentication logic that was previously
 * duplicated across all calendar functions.
 *
 * @param userId - The user's UUID for token lookup
 * @param supabaseClient - Optional Supabase client for backend operations
 * @returns Promise<google.calendar_v3.Calendar> - Authenticated calendar client
 * @throws Error if user has no calendar tokens or authentication fails
 */
export async function getAuthenticatedCalendar(userId: string, supabaseClient?: SupabaseClient) {
	// ————————————————————————————————————————————————————————————————
	// STEP 1 — Load stored Google credentials for this user
	// We persist three key fields per user in `calendar_tokens`:
	//   - access_token: short‑lived Google token used on API calls
	//   - refresh_token: long‑lived token used to mint new access tokens
	//   - expiry_date: epoch ms when the current access_token expires
	// If tokens are missing, the caller should route the user to (re)connect.
	// ————————————————————————————————————————————————————————————————
	let tokens
	try {
		tokens = await getUserCalendarTokens(userId, supabaseClient)
	} catch {
		throw new Error('Failed to retrieve calendar tokens from database')
	}

	if (!tokens) {
		// No stored credentials → caller should guide the user to connect
		throw new Error('Calendar tokens not found')
	}

	// ————————————————————————————————————————————————————————————————
	// STEP 2 — Decide whether we must refresh the access token
	// Normalize stored expiry to ms since epoch (some schemas store seconds).
	// Access tokens typically last ~1 hour. We refresh only when:
	//   a) `expiry_date` exists AND
	//   b) it is <= now + small skew.
	// If no `expiry_date` was stored, we assume the access token is valid and
	// let Google reject if it is not (rare, but safe and simple).
	// ————————————————————————————————————————————————————————————————
	const now = Date.now()
	const skewMs = 60_000 // small clock-drift / network skew
	const rawExpiry = tokens.expiry_date
	const storedExpiryMs =
		rawExpiry == null
			? null
			: rawExpiry < 1_000_000_000_000 // treat values < 1e12 as seconds
				? rawExpiry * 1000
				: rawExpiry
	const needsRefresh = storedExpiryMs != null && storedExpiryMs <= now + skewMs

	// ————————————————————————————————————————————————————————————————
	// STEP 3 — Prepare an OAuth2 client for this request
	// Always create a fresh instance to avoid cross‑request/user credential bleed.
	// ————————————————————————————————————————————————————————————————
	const oauth2Client = createOAuthClient()

	if (needsRefresh) {
		// ————————————————————————————————————————————————————————————————
		// STEP 4A — Refresh access token using the long‑lived refresh_token
		// On success we set the new access_token on the client. Any failure is
		// bubbled up so the caller can guide the user to reconnect if needed.
		// ————————————————————————————————————————————————————————————————
		try {
			// Refresh using the long-lived refresh token, then apply new access token
			const newAccessToken = await refreshToken(userId, tokens.refresh_token, supabaseClient)
			oauth2Client.setCredentials({
				access_token: newAccessToken,
				refresh_token: tokens.refresh_token
			})
		} catch (error) {
			// Bubble up so callers can surface a reconnect message if needed
			throw error
		}
	} else {
		// ————————————————————————————————————————————————————————————————
		// STEP 4B — Access token still valid; use as‑is
		// We attach the stored access_token and refresh_token to the client.
		// ————————————————————————————————————————————————————————————————
		oauth2Client.setCredentials({
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token
		})
	}

	// ————————————————————————————————————————————————————————————————
	// STEP 5 — Return a ready‑to‑use Calendar client bound to credentials
	// Callers can directly use the returned client to read/write calendar data.
	// ————————————————————————————————————————————————————————————————
	return google.calendar({ version: 'v3', auth: oauth2Client })
}
