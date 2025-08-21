/**
 * Calendar Token Database Operations
 *
 * This module handles database operations for OAuth calendar tokens, specifically
 * for Google Calendar integration. It manages the secure storage and updating
 * of access tokens and refresh tokens required for calendar API operations.
 *
 * SECURITY CONSIDERATIONS:
 * - Uses supabaseAdmin for server-side operations to bypass RLS
 * - Tokens are sensitive data and should only be accessed server-side
 * - Access tokens have limited lifespans and need periodic refresh
 * - Refresh tokens allow regenerating access tokens without user re-authentication
 *
 * TOKEN LIFECYCLE:
 * 1. User grants calendar permissions → Initial tokens stored
 * 2. Access token expires → Use refresh token to get new access token
 * 3. Update stored access token and expiry time
 * 4. Repeat cycle to maintain calendar access
 */

import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabase = createSupabaseClient()

/**
 * Updates a user's calendar access tokens in the database
 *
 * This function is called when:
 * - A user first connects their Google Calendar (initial token storage)
 * - Access tokens are refreshed (token renewal process)
 * - Token expiry times need to be updated
 *
 * IMPORTANT: This uses supabaseAdmin to bypass Row Level Security (RLS)
 * because token refresh operations happen server-side without user context.
 *
 * @param tokenResponse - OAuth token response from Google containing the new access token
 * @param userId - UUID of the user whose tokens to update
 * @param expiryDuration - Token expiry time (typically seconds from now or epoch timestamp)
 * @returns Promise<boolean> - true if update successful
 * @throws Error if database update fails
 */
export async function updateUserCalendarTokens(
	tokenResponse: any,
	userId: string,
	expiryDuration: number,
	supabaseClient?: SupabaseClient
) {
	const client = supabaseClient || supabase

	// Update the user's calendar tokens
	const { error: updateError } = await client
		.from('calendar_tokens')
		.update({
			access_token: tokenResponse.token, // New access token from OAuth refresh
			expiry_date: expiryDuration // Updated expiry time (typically 1 hour from now)
		})
		.eq('user_id', userId) // Target specific user's tokens

	// Handle any database errors that occur during the update
	if (updateError) {
		console.error('Error updating token in database:', updateError)
		throw new Error('Failed to update token in database')
	}

	// Return success indicator
	return true
}

/**
 * Retrieves calendar tokens for a specific user
 * Used for calendar API operations that require authentication
 *
 * @param userId - UUID of the user whose tokens to retrieve
 * @param supabaseClient - Optional SupabaseClient instance (required for backend operations)
 * @returns Promise with calendar tokens or null if not found
 * @throws Error if database operation fails
 */
export async function getUserCalendarTokens(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<{
	access_token: string
	refresh_token: string
	expiry_date: number | null
	granted_scopes: string[] | null
} | null> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('calendar_tokens')
		.select('access_token, refresh_token, expiry_date, granted_scopes')
		.eq('user_id', userId)
		.maybeSingle()

	if (error) {
		throw error
	}

	return data
}

/**
 * Retrieves the existing refresh_token for a user (if any).
 * Used during OAuth callback to avoid overwriting a valid refresh_token with undefined.
 */
export async function getExistingRefreshToken(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<string | null> {
	const client = supabaseClient || supabase
	const { data, error } = await client
		.from('calendar_tokens')
		.select('refresh_token')
		.eq('user_id', userId)
		.maybeSingle()

	if (error) return null
	return (data as any)?.refresh_token ?? null
}

/**
 * Upserts calendar tokens for a user.
 * Ensures a single row per user via onConflict: 'user_id'.
 */
export async function upsertCalendarTokens(
	payload: {
		user_id: string
		access_token?: string | null
		refresh_token?: string | null
		expiry_date?: number | null
		granted_scopes?: string[] | null
	},
	supabaseClient?: SupabaseClient
) {
	const client = supabaseClient || supabase
	const { error } = await client
		.from('calendar_tokens')
		.upsert(payload as any, { onConflict: 'user_id' })

	if (error) throw error
	console.log('🧩 [Calendar Tokens] Upserted', payload)
	return true
}

/**
 * Deletes all calendar tokens for a specific user
 *
 * This function is called when:
 * - A user disconnects their Google Calendar
 * - Calendar permissions are revoked
 * - User account cleanup is needed
 *
 * IMPORTANT: This permanently removes the user's ability to sync with Google Calendar
 * until they reconnect their account.
 *
 * @param userId - UUID of the user whose tokens to delete
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<boolean> - true if deletion successful
 * @throws Error if database deletion fails
 */
export async function deleteUserCalendarTokens(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<boolean> {
	const client = supabaseClient || supabase

	// Delete all calendar tokens for the specified user
	const { error } = await client
		.from('calendar_tokens')
		.delete()
		.eq('user_id', userId)

	// Handle any database errors that occur during deletion
	if (error) {
		console.error('Error deleting calendar tokens from database:', error)
		throw new Error('Failed to delete calendar tokens from database')
	}

	// Return success indicator
	return true
}

/**
 * Checks if a user has the required calendar permissions
 *
 * This function analyzes the granted scopes to determine if the user
 * has provided the necessary permissions for calendar operations.
 *
 * @param userId - UUID of the user to check permissions for
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<CalendarPermissionStatus> - Detailed permission status
 */
export async function checkCalendarPermissions(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<CalendarPermissionStatus> {
	const tokens = await getUserCalendarTokens(userId, supabaseClient)

	if (!tokens) {
		return {
			hasTokens: false,
			hasCalendarAccess: false,
			hasRequiredPermissions: false,
			grantedScopes: [],
			missingScopes: REQUIRED_SCOPES,
			canEdit: false,
			canRead: false
		}
	}

	const grantedScopes = tokens.granted_scopes || []
	const hasCalendarAccess = grantedScopes.includes(
		'https://www.googleapis.com/auth/calendar.events'
	)
	const hasRequiredPermissions = REQUIRED_SCOPES.every((scope) =>
		grantedScopes.includes(scope)
	)
	const missingScopes = REQUIRED_SCOPES.filter(
		(scope) => !grantedScopes.includes(scope)
	)

	return {
		hasTokens: true,
		hasCalendarAccess,
		hasRequiredPermissions,
		grantedScopes,
		missingScopes,
		canEdit: hasCalendarAccess,
		canRead:
			grantedScopes.includes(
				'https://www.googleapis.com/auth/calendar.readonly'
			) || hasCalendarAccess
	}
}

/**
 * Required OAuth scopes for full calendar functionality
 * These are the permissions we need for the app to work properly
 */
export const REQUIRED_SCOPES = [
	'https://www.googleapis.com/auth/calendar.events',
	'https://www.googleapis.com/auth/userinfo.email',
	'https://www.googleapis.com/auth/userinfo.profile'
]

/**
 * Interface defining the calendar permission status
 * Provides detailed information about what permissions the user has granted
 */
export interface CalendarPermissionStatus {
	hasTokens: boolean
	hasCalendarAccess: boolean
	hasRequiredPermissions: boolean
	grantedScopes: string[]
	missingScopes: string[]
	canEdit: boolean
	canRead: boolean
}

// TODO: Add additional calendar token management functions as needed:
// - createUserCalendarTokens() - For initial token storage
// - refreshExpiredTokens() - For automatic token refresh
// - validateTokenExpiry() - For checking if tokens need refresh
