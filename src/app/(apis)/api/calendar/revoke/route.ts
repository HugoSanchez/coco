/**
 * Google Calendar Revocation API Endpoint
 *
 * This endpoint handles disconnecting a user's Google Calendar by:
 * 1. Revoking the access token with Google's OAuth servers
 * 2. Deleting the stored tokens from our database
 * 3. Providing proper error handling and user feedback
 *
 * SECURITY:
 * - Requires user authentication
 * - Only revokes tokens for the authenticated user
 * - Uses server-side Supabase client for secure database operations
 *
 * PROCESS:
 * 1. Authenticate the user
 * 2. Fetch their stored calendar tokens
 * 3. Call Google's token revocation API
 * 4. Delete tokens from our database
 * 5. Return success/failure response
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
	getUserCalendarTokens,
	deleteUserCalendarTokens
} from '@/lib/db/calendar-tokens'

/**
 * POST /api/calendar/revoke
 *
 * Revokes Google Calendar access for the authenticated user
 *
 * @returns JSON response with success status and message
 */
export async function POST(request: NextRequest) {
	try {
		// Create server-side Supabase client for secure operations
		const supabase = createClient()

		// Get the authenticated user
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()

		if (authError || !user) {
			return NextResponse.json(
				{ success: false, error: 'User not authenticated' },
				{ status: 401 }
			)
		}

		// Fetch the user's calendar tokens to get the access token for revocation
		const calendarTokens = await getUserCalendarTokens(user.id, supabase)

		if (!calendarTokens) {
			// User doesn't have calendar tokens - nothing to revoke
			return NextResponse.json(
				{
					success: true,
					message: 'No calendar connection found to revoke'
				},
				{ status: 200 }
			)
		}

		// Revoke the access token with Google's OAuth servers
		// This invalidates the token on Google's side
		try {
			const revokeResponse = await fetch(
				`https://oauth2.googleapis.com/revoke?token=${calendarTokens.access_token}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded'
					}
				}
			)

			// Google returns 200 for successful revocation
			// Note: Google may return 400 if token is already invalid, which is acceptable
			if (!revokeResponse.ok && revokeResponse.status !== 400) {
				console.error(
					'Google token revocation failed:',
					revokeResponse.status
				)
				// Continue with local cleanup even if Google revocation fails
			}
		} catch (error) {
			console.error('Error calling Google revocation API:', error)
			// Continue with local cleanup even if Google API call fails
		}

		// Delete the tokens from our database
		// This is the critical step - removes our stored access
		await deleteUserCalendarTokens(user.id, supabase)

		// Return success response
		return NextResponse.json(
			{
				success: true,
				message: 'Google Calendar successfully disconnected'
			},
			{ status: 200 }
		)
	} catch (error) {
		console.error('Error revoking calendar access:', error)

		return NextResponse.json(
			{
				success: false,
				error: 'Failed to revoke calendar access'
			},
			{ status: 500 }
		)
	}
}
