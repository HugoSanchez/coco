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
} | null> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('calendar_tokens')
		.select('access_token, refresh_token, expiry_date')
		.eq('user_id', userId)
		.single()

	if (error) {
		if (error.code === 'PGRST116') {
			// No rows returned - user hasn't connected calendar
			return null
		}
		throw error
	}

	return data
}

// TODO: Add additional calendar token management functions as needed:
// - createUserCalendarTokens() - For initial token storage
// - deleteUserCalendarTokens() - For revoking calendar access
// - getUserCalendarTokens() - For retrieving tokens for API calls
// - refreshExpiredTokens() - For automatic token refresh
// - validateTokenExpiry() - For checking if tokens need refresh
