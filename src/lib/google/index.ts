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
import {
	getUserCalendarTokens,
	updateUserCalendarTokens,
	deleteUserCalendarTokens
} from '../db/calendar-tokens'

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

export const oauth2Client = new google.auth.OAuth2(
	clientId,
	clientSecret,
	redirectUri
)

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

	// Set the credentials to the refresh token
	oauth2Client.setCredentials({ refresh_token: refreshToken })

	try {
		console.log(
			'🔄 [Token] Requesting new access token from Google for user:',
			userId
		)
		// Ask Google for a new access token
		const tokenResponse = await oauth2Client.getAccessToken()

		// If unsuccessful, throw an error
		if (!tokenResponse.token) {
			console.error(
				'❌ [Token] Google returned no access token for user:',
				userId
			)
			throw new Error('No access token returned after refresh')
		}

		console.log(
			'✅ [Token] New access token received from Google for user:',
			userId
		)

		// Extract expiry duration (defaults to 1 hour if not provided)
		const expiryDuration = oauth2Client.credentials.expiry_date
			? oauth2Client.credentials.expiry_date - Date.now()
			: 3600 * 1000

		console.log(
			'🔄 [Token] Updating token in database for user:',
			userId,
			'Expiry:',
			new Date(Date.now() + expiryDuration)
		)

		try {
			// update the token in the database
			await updateUserCalendarTokens(
				tokenResponse,
				userId,
				expiryDuration,
				supabaseClient
			)
			console.log(
				'✅ [Token] Token successfully updated in database for user:',
				userId
			)
		} catch (dbError) {
			console.error(
				'❌ [Token] Failed to update token in database for user:',
				userId,
				'Error:',
				dbError
			)
			throw new Error('Failed to update refreshed token in database')
		}

		// and return token
		return tokenResponse.token
	} catch (error: any) {
		console.error(
			'❌ [Token] Token refresh failed for user:',
			userId,
			'Error:',
			error.message || error
		)

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
			console.log(
				'🧹 [Token] Cleaning up invalid tokens for user:',
				userId
			)
			try {
				// Clean up the invalid tokens from database
				await deleteUserCalendarTokens(userId, supabaseClient)
				console.log(
					'✅ [Token] Invalid tokens cleaned up for user:',
					userId
				)
			} catch (cleanupError) {
				console.error(
					'❌ [Token] Failed to cleanup tokens for user:',
					userId,
					'Error:',
					cleanupError
				)
			}
			throw new Error(
				'Calendar access expired - please reconnect your Google Calendar'
			)
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
export async function getAuthenticatedCalendar(
	userId: string,
	supabaseClient?: SupabaseClient
) {
	console.log(
		'🔍 [Calendar] Attempting to get authenticated calendar for user:',
		userId
	)

	// Step 1: Try to fetch user's calendar tokens
	let calendarTokens
	try {
		console.log(
			'🔍 [Calendar] Fetching tokens from database for user:',
			userId
		)
		calendarTokens = await getUserCalendarTokens(userId, supabaseClient)
	} catch (error) {
		console.error(
			'❌ [Calendar] Database error fetching tokens for user:',
			userId,
			'Error:',
			error
		)
		throw new Error('Failed to retrieve calendar tokens from database')
	}

	if (!calendarTokens) {
		console.error(
			'❌ [Calendar] No tokens found in database for user:',
			userId
		)
		throw new Error('Calendar tokens not found')
	}

	console.log(
		'✅ [Calendar] Tokens found for user:',
		userId,
		'Expiry:',
		calendarTokens.expiry_date
			? new Date(calendarTokens.expiry_date)
			: 'No expiry'
	)

	// Step 2: Check if tokens need refresh
	const now = Date.now()
	const needsRefresh =
		(calendarTokens.expiry_date && calendarTokens.expiry_date < now) || true // Force refresh for now to ensure fresh tokens

	if (needsRefresh) {
		console.log(
			'🔄 [Calendar] Tokens expired for user:',
			userId,
			'Attempting refresh...'
		)
		try {
			const newAccessToken = await refreshToken(
				userId,
				calendarTokens.refresh_token,
				supabaseClient
			)
			console.log(
				'✅ [Calendar] Token refresh successful for user:',
				userId
			)
			oauth2Client.setCredentials({
				access_token: newAccessToken,
				refresh_token: calendarTokens.refresh_token
			})
		} catch (error) {
			console.error(
				'❌ [Calendar] Token refresh failed for user:',
				userId,
				'Error:',
				error
			)
			throw error
		}
	} else {
		console.log(
			'✅ [Calendar] Using existing valid tokens for user:',
			userId
		)
		oauth2Client.setCredentials({
			access_token: calendarTokens.access_token,
			refresh_token: calendarTokens.refresh_token
		})
	}

	// Return authenticated calendar instance
	return google.calendar({ version: 'v3', auth: oauth2Client })
}
