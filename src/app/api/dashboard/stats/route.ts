/**
 * Dashboard Statistics API Route
 *
 * This API endpoint provides comprehensive dashboard statistics for authenticated users.
 * Currently supports revenue statistics with plans to extend for bookings and client metrics.
 *
 * SECURITY:
 * - Requires user authentication via Supabase session
 * - Users can only access their own statistics
 * - Proper error handling with sanitized error messages
 *
 * ENDPOINTS:
 * - GET /api/dashboard/stats - Returns complete dashboard statistics
 *
 * RESPONSE FORMAT:
 * {
 *   success: boolean,
 *   data: {
 *     revenue: RevenueStats,
 *     // Future: bookings, clients, etc.
 *   },
 *   error?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
	getRevenueStats,
	getBookingStats,
	formatCurrency
} from '@/lib/db/dashboard-stats'

/**
 * Interface for the complete dashboard statistics response
 * Provides type safety for the API response structure
 *
 * @interface DashboardStatsResponse
 * @property success - Indicates if the request was successful
 * @property data - Contains all dashboard statistics (when successful)
 * @property error - Error message (when unsuccessful)
 */
interface DashboardStatsResponse {
	success: boolean
	data?: {
		revenue: {
			current: number
			previous: number
			percentageChange: number | null
			currency: string
			formattedCurrent: string
			formattedPrevious: string
		}
		bookings: {
			current: number
			previous: number
			percentageChange: number | null
		}
		// Future additions:
		// clients: ActiveClientsStats
	}
	error?: string
}

/**
 * GET Handler - Retrieves dashboard statistics for authenticated user
 *
 * This endpoint:
 * 1. Validates user authentication via Supabase session
 * 2. Fetches revenue statistics for the authenticated user
 * 3. Formats currency values for display
 * 4. Returns structured response with proper error handling
 * 5. Logs errors for debugging while sanitizing user-facing messages
 *
 * @param request - Next.js request object
 * @returns Promise<NextResponse<DashboardStatsResponse>> - JSON response with statistics or error
 *
 * @example
 * GET /api/dashboard/stats
 * Response: {
 *   "success": true,
 *   "data": {
 *     "revenue": {
 *       "current": 1234.56,
 *       "previous": 987.65,
 *       "percentageChange": 25,
 *       "currency": "EUR",
 *       "formattedCurrent": "€1,234.56",
 *       "formattedPrevious": "€987.65"
 *     }
 *   }
 * }
 */
export async function GET(
	request: NextRequest
): Promise<NextResponse<DashboardStatsResponse>> {
	try {
		// Create Supabase client for server-side authentication
		const supabase = createClient()

		// Get the current user session
		const {
			data: { session },
			error: sessionError
		} = await supabase.auth.getSession()

		// Handle authentication errors
		if (sessionError) {
			console.error('Session error in dashboard stats API:', sessionError)
			return NextResponse.json(
				{
					success: false,
					error: 'Authentication failed. Please log in again.'
				},
				{ status: 401 }
			)
		}

		// Ensure user is authenticated
		if (!session?.user) {
			console.warn('Unauthorized access attempt to dashboard stats API')
			return NextResponse.json(
				{
					success: false,
					error: 'Authentication required. Please log in to access dashboard statistics.'
				},
				{ status: 401 }
			)
		}

		// Extract user ID for database queries
		const userId = session.user.id

		// Fetch both revenue and booking statistics in parallel for better performance
		// Pass the server-side Supabase client for proper RLS enforcement
		const [revenueStats, bookingStats] = await Promise.all([
			getRevenueStats(userId, supabase),
			getBookingStats(userId, supabase)
		])

		// Format currency values for consistent display
		const formattedRevenueStats = {
			...revenueStats,
			formattedCurrent: formatCurrency(
				revenueStats.current,
				revenueStats.currency
			),
			formattedPrevious: formatCurrency(
				revenueStats.previous,
				revenueStats.currency
			)
		}

		// Return successful response with formatted statistics
		return NextResponse.json(
			{
				success: true,
				data: {
					revenue: formattedRevenueStats,
					bookings: bookingStats
				}
			},
			{ status: 200 }
		)
	} catch (error) {
		// Log detailed error for debugging (server-side only)
		console.error('Error fetching dashboard statistics:', {
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined,
			timestamp: new Date().toISOString()
		})

		// Return sanitized error message to client
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to fetch dashboard statistics. Please try again later.'
			},
			{ status: 500 }
		)
	}
}

/**
 * OPTIONS Handler - Handles CORS preflight requests
 * Required for cross-origin requests from the frontend
 *
 * @param request - Next.js request object
 * @returns NextResponse with CORS headers
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
	return new NextResponse(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	})
}
