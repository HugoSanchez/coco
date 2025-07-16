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
	updateUserCalendarTokens
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
	// Set the credentials to the refresh token
	oauth2Client.setCredentials({ refresh_token: refreshToken })

	try {
		// Ask Google for a new access token
		const tokenResponse = await oauth2Client.getAccessToken()
		// If unsuccessful, throw an error
		if (!tokenResponse.token)
			throw new Error('No access token returned after refresh')
		// Else,
		else {
			// Extract expiry duration (defaults to 1 hour if not provided)
			const expiryDuration = oauth2Client.credentials.expiry_date
				? oauth2Client.credentials.expiry_date - Date.now()
				: 3600 * 1000
			// update the token in the database
			await updateUserCalendarTokens(
				tokenResponse,
				userId,
				expiryDuration,
				supabaseClient
			)
			// and return token
			return tokenResponse.token
		}
	} catch (error: any) {
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
	// Fetch user's calendar tokens using backend-compatible function
	const calendarTokens = await getUserCalendarTokens(userId, supabaseClient)

	if (!calendarTokens) {
		throw new Error('Calendar tokens not found')
	}

	// Non-null assertion since we've verified tokens exist above
	const tokens = calendarTokens!

	// Handle token refresh if needed
	const now = Date.now()
	if (
		(tokens.expiry_date && tokens.expiry_date < now) ||
		true // Force refresh for now to ensure fresh tokens
	) {
		const newAccessToken = await refreshToken(
			userId,
			tokens.refresh_token,
			supabaseClient
		)
		oauth2Client.setCredentials({
			access_token: newAccessToken,
			refresh_token: tokens.refresh_token
		})
	} else {
		oauth2Client.setCredentials({
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token
		})
	}

	// Return authenticated calendar instance
	return google.calendar({ version: 'v3', auth: oauth2Client })
}
