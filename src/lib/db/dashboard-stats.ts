/**
 * Dashboard Statistics Database Operations
 *
 * This module handles all database operations for dashboard analytics and metrics, including:
 * - Revenue calculations (current month, previous month, percentage changes)
 * - Booking statistics (confirmed, pending bookings by period)
 * - Client activity metrics (active clients in specific timeframes)
 * - Performance-optimized queries with proper date filtering
 *
 * The dashboard statistics system integrates with:
 * - Bills: Revenue calculations based on paid bills
 * - Bookings: Booking counts and status tracking
 * - Clients: Active client analysis
 * - User timezone handling: All date calculations respect user context
 */

import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabase = createSupabaseClient()

/**
 * Interface for revenue statistics
 * Contains current month revenue, previous month revenue, and calculated changes
 *
 * @interface RevenueStats
 * @property current - Revenue for current calendar month in EUR
 * @property previous - Revenue for previous calendar month in EUR
 * @property percentageChange - Percentage change from previous to current month (null if no previous data)
 * @property currency - Currency code (always 'EUR' for now)
 */
export interface RevenueStats {
	current: number
	previous: number
	percentageChange: number | null
	currency: string
}

/**
 * Interface for booking count statistics
 * Contains current month bookings, previous month bookings, and calculated changes
 *
 * @interface BookingStats
 * @property current - Booking count for current calendar month
 * @property previous - Booking count for previous calendar month
 * @property percentageChange - Percentage change from previous to current month (null if no previous data)
 */
export interface BookingStats {
	current: number
	previous: number
	percentageChange: number | null
}

/**
 * Interface for active clients statistics
 * Contains active client count for last 30 days and previous 30-day period
 *
 * @interface ActiveClientsStats
 * @property current - Active clients in last 30 days
 * @property previous - Active clients in previous 30-day period (days 31-60 ago)
 * @property percentageChange - Percentage change from previous to current period (null if no previous data)
 */
export interface ActiveClientsStats {
	current: number
	previous: number
	percentageChange: number | null
}

/**
 * Calculates the percentage change between two values
 * Handles edge cases like zero or null previous values gracefully
 * Returns exact percentage with 1 decimal place precision
 *
 * @param current - Current period value
 * @param previous - Previous period value
 * @returns Percentage change (positive for increase, negative for decrease)
 *
 * @example
 * calculatePercentageChange(120, 100) // Returns 20.0 (20% increase)
 * calculatePercentageChange(80, 100)  // Returns -20.0 (20% decrease)
 * calculatePercentageChange(125.50, 100) // Returns 25.5 (25.5% increase)
 * calculatePercentageChange(50, 0)    // Returns null (handled as "new" in UI)
 */
export function calculatePercentageChange(
	current: number,
	previous: number
): number | null {
	// Handle edge case: no previous data (return null to be handled in UI)
	if (previous === 0 || previous === null || previous === undefined) {
		return null
	}

	// Calculate exact percentage change with 1 decimal place precision
	const percentageChange = ((current - previous) / previous) * 100
	return Math.round(percentageChange * 10) / 10
}

/**
 * Retrieves total revenue for the current calendar month
 * Sums all bills with status 'paid' and paid_at in current month
 *
 * This function:
 * 1. Filters bills by user_id for security
 * 2. Only includes bills with status = 'paid'
 * 3. Filters by paid_at timestamp for current calendar month
 * 4. Handles timezone-aware date filtering
 * 5. Returns 0 if no revenue found (graceful handling)
 *
 * @param userId - UUID of the user whose revenue to calculate
 * @param supabaseClient - Optional Supabase client (defaults to standard client)
 * @returns Promise<number> - Total revenue in EUR for current month
 * @throws Error if database query fails
 *
 * @example
 * const revenue = await getCurrentMonthRevenue('user-uuid-123')
 * console.log(`Current month revenue: €${revenue}`) // "Current month revenue: €1234.56"
 */
export async function getCurrentMonthRevenue(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<number> {
	const client = supabaseClient || supabase

	try {
		// Get current date for month calculation
		const now = new Date()
		const currentYear = now.getFullYear()
		const currentMonth = now.getMonth() + 1 // JavaScript months are 0-indexed

		// Calculate upper bound for date range (first day of next month)
		let upperBoundYear = currentYear
		let upperBoundMonth = currentMonth + 1

		if (upperBoundMonth > 12) {
			// December -> January of next year
			upperBoundMonth = 1
			upperBoundYear = upperBoundYear + 1
		}

		// Query bills for current calendar month
		// Using date extraction functions for accurate month filtering
		const { data, error } = await client
			.from('bills')
			.select('amount')
			.eq('user_id', userId)
			.eq('status', 'paid')
			.not('paid_at', 'is', null) // Ensure paid_at is not null
			.gte(
				'paid_at',
				`${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`
			)
			.lt(
				'paid_at',
				`${upperBoundYear}-${upperBoundMonth.toString().padStart(2, '0')}-01`
			)

		if (error) {
			console.error('Error fetching current month revenue:', error)
			throw new Error(
				`Failed to fetch current month revenue: ${error.message}`
			)
		}

		// Sum all amounts, handle empty results gracefully
		if (!data || data.length === 0) {
			return 0
		}

		const totalRevenue = data.reduce(
			(sum, bill) => sum + (bill.amount || 0),
			0
		)
		return Math.round(totalRevenue * 100) / 100 // Round to 2 decimal places
	} catch (error) {
		console.error('Unexpected error in getCurrentMonthRevenue:', error)
		throw error
	}
}

/**
 * Retrieves total revenue for the previous calendar month
 * Sums all bills with status 'paid' and paid_at in previous month
 *
 * This function:
 * 1. Calculates previous month dates accounting for year boundaries
 * 2. Filters bills by user_id for security
 * 3. Only includes bills with status = 'paid'
 * 4. Filters by paid_at timestamp for previous calendar month
 * 5. Handles timezone-aware date filtering
 * 6. Returns 0 if no revenue found (graceful handling)
 *
 * @param userId - UUID of the user whose revenue to calculate
 * @param supabaseClient - Optional Supabase client (defaults to standard client)
 * @returns Promise<number> - Total revenue in EUR for previous month
 * @throws Error if database query fails
 *
 * @example
 * const revenue = await getLastMonthRevenue('user-uuid-123')
 * console.log(`Last month revenue: €${revenue}`) // "Last month revenue: €987.65"
 */
export async function getLastMonthRevenue(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<number> {
	const client = supabaseClient || supabase

	try {
		// Calculate previous month, handling year boundary
		const now = new Date()
		let previousMonth = now.getMonth() // 0-indexed (0 = January)
		let previousYear = now.getFullYear()

		if (previousMonth === 0) {
			// January -> December of previous year
			previousMonth = 11 // December is month 11 in 0-indexed
			previousYear = previousYear - 1
		} else {
			// All other months, just subtract 1
			previousMonth = previousMonth - 1
		}

		// Convert to 1-indexed for date formatting
		const monthForQuery = previousMonth + 1

		// Calculate upper bound for date range (first day of following month)
		let upperBoundYear = previousYear
		let upperBoundMonth = monthForQuery + 1

		if (upperBoundMonth > 12) {
			// December -> January of next year
			upperBoundMonth = 1
			upperBoundYear = upperBoundYear + 1
		}

		// Query bills for previous calendar month
		const { data, error } = await client
			.from('bills')
			.select('amount')
			.eq('user_id', userId)
			.eq('status', 'paid')
			.not('paid_at', 'is', null) // Ensure paid_at is not null
			.gte(
				'paid_at',
				`${previousYear}-${monthForQuery.toString().padStart(2, '0')}-01`
			)
			.lt(
				'paid_at',
				`${upperBoundYear}-${upperBoundMonth.toString().padStart(2, '0')}-01`
			)

		if (error) {
			console.error('Error fetching last month revenue:', error)
			throw new Error(
				`Failed to fetch last month revenue: ${error.message}`
			)
		}

		// Sum all amounts, handle empty results gracefully
		if (!data || data.length === 0) {
			return 0
		}

		const totalRevenue = data.reduce(
			(sum, bill) => sum + (bill.amount || 0),
			0
		)
		return Math.round(totalRevenue * 100) / 100 // Round to 2 decimal places
	} catch (error) {
		console.error('Unexpected error in getLastMonthRevenue:', error)
		throw error
	}
}

/**
 * Retrieves complete revenue statistics for dashboard display
 * Combines current month, previous month, and percentage change calculations
 *
 * This function:
 * 1. Fetches current month revenue
 * 2. Fetches previous month revenue
 * 3. Calculates percentage change
 * 4. Returns formatted statistics object
 * 5. Handles all edge cases gracefully
 *
 * @param userId - UUID of the user whose revenue statistics to calculate
 * @param supabaseClient - Optional Supabase client (defaults to standard client)
 * @returns Promise<RevenueStats> - Complete revenue statistics object
 * @throws Error if database queries fail
 *
 * @example
 * const stats = await getRevenueStats('user-uuid-123')
 * console.log(`Revenue: €${stats.current} (${stats.percentageChange > 0 ? '+' : ''}${stats.percentageChange}%)`)
 * // "Revenue: €1234.56 (+25%)"
 */
export async function getRevenueStats(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<RevenueStats> {
	try {
		// Fetch both current and previous month revenue in parallel for better performance
		const [currentRevenue, previousRevenue] = await Promise.all([
			getCurrentMonthRevenue(userId, supabaseClient),
			getLastMonthRevenue(userId, supabaseClient)
		])

		// Calculate percentage change
		const percentageChange = calculatePercentageChange(
			currentRevenue,
			previousRevenue
		)

		return {
			current: currentRevenue,
			previous: previousRevenue,
			percentageChange,
			currency: 'EUR'
		}
	} catch (error) {
		console.error('Error fetching revenue statistics:', error)
		throw new Error(`Failed to fetch revenue statistics: ${error}`)
	}
}

/**
 * Retrieves total confirmed bookings for the current calendar month
 * Counts all bookings with status 'scheduled' or 'completed' in current month
 *
 * This function:
 * 1. Filters bookings by user_id for security
 * 2. Only includes bookings with status 'scheduled' or 'completed'
 * 3. Filters by start_time timestamp for current calendar month
 * 4. Handles timezone-aware date filtering
 * 5. Returns 0 if no bookings found (graceful handling)
 *
 * @param userId - UUID of the user whose bookings to count
 * @param supabaseClient - Optional Supabase client (defaults to standard client)
 * @returns Promise<number> - Total confirmed bookings for current month
 * @throws Error if database query fails
 *
 * @example
 * const bookings = await getCurrentMonthBookings('user-uuid-123')
 * console.log(`Current month bookings: ${bookings}`) // "Current month bookings: 15"
 */
export async function getCurrentMonthBookings(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<number> {
	const client = supabaseClient || supabase

	try {
		// Get current date for month calculation
		const now = new Date()
		const currentYear = now.getFullYear()
		const currentMonth = now.getMonth() + 1 // JavaScript months are 0-indexed

		// Calculate upper bound for date range (first day of next month)
		let upperBoundYear = currentYear
		let upperBoundMonth = currentMonth + 1

		if (upperBoundMonth > 12) {
			// December -> January of next year
			upperBoundMonth = 1
			upperBoundYear = upperBoundYear + 1
		}

		// Query bookings for current calendar month
		// Count confirmed bookings (scheduled + completed)
		const { count, error } = await client
			.from('bookings')
			.select('*', { count: 'exact', head: true })
			.eq('user_id', userId)
			.in('status', ['scheduled', 'completed'])
			.gte(
				'start_time',
				`${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`
			)
			.lt(
				'start_time',
				`${upperBoundYear}-${upperBoundMonth.toString().padStart(2, '0')}-01`
			)

		if (error) {
			console.error('Error fetching current month bookings:', error)
			throw new Error(
				`Failed to fetch current month bookings: ${error.message}`
			)
		}

		// Return count, handle null gracefully
		return count || 0
	} catch (error) {
		console.error('Unexpected error in getCurrentMonthBookings:', error)
		throw error
	}
}

/**
 * Retrieves total confirmed bookings for the previous calendar month
 * Counts all bookings with status 'scheduled' or 'completed' in previous month
 *
 * This function:
 * 1. Calculates previous month dates accounting for year boundaries
 * 2. Filters bookings by user_id for security
 * 3. Only includes bookings with status 'scheduled' or 'completed'
 * 4. Filters by start_time timestamp for previous calendar month
 * 5. Handles timezone-aware date filtering
 * 6. Returns 0 if no bookings found (graceful handling)
 *
 * @param userId - UUID of the user whose bookings to count
 * @param supabaseClient - Optional Supabase client (defaults to standard client)
 * @returns Promise<number> - Total confirmed bookings for previous month
 * @throws Error if database query fails
 *
 * @example
 * const bookings = await getLastMonthBookings('user-uuid-123')
 * console.log(`Last month bookings: ${bookings}`) // "Last month bookings: 12"
 */
export async function getLastMonthBookings(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<number> {
	const client = supabaseClient || supabase

	try {
		// Calculate previous month, handling year boundary
		const now = new Date()
		let previousMonth = now.getMonth() // 0-indexed (0 = January)
		let previousYear = now.getFullYear()

		if (previousMonth === 0) {
			// January -> December of previous year
			previousMonth = 11 // December is month 11 in 0-indexed
			previousYear = previousYear - 1
		} else {
			// All other months, just subtract 1
			previousMonth = previousMonth - 1
		}

		// Convert to 1-indexed for date formatting
		const monthForQuery = previousMonth + 1

		// Calculate upper bound for date range (first day of following month)
		let upperBoundYear = previousYear
		let upperBoundMonth = monthForQuery + 1

		if (upperBoundMonth > 12) {
			// December -> January of next year
			upperBoundMonth = 1
			upperBoundYear = upperBoundYear + 1
		}

		// Query bookings for previous calendar month
		const { count, error } = await client
			.from('bookings')
			.select('*', { count: 'exact', head: true })
			.eq('user_id', userId)
			.in('status', ['scheduled', 'completed'])
			.gte(
				'start_time',
				`${previousYear}-${monthForQuery.toString().padStart(2, '0')}-01`
			)
			.lt(
				'start_time',
				`${upperBoundYear}-${upperBoundMonth.toString().padStart(2, '0')}-01`
			)

		if (error) {
			console.error('Error fetching last month bookings:', error)
			throw new Error(
				`Failed to fetch last month bookings: ${error.message}`
			)
		}

		// Return count, handle null gracefully
		return count || 0
	} catch (error) {
		console.error('Unexpected error in getLastMonthBookings:', error)
		throw error
	}
}

/**
 * Retrieves complete booking statistics for dashboard display
 * Combines current month, previous month, and percentage change calculations
 *
 * This function:
 * 1. Fetches current month confirmed bookings
 * 2. Fetches previous month confirmed bookings
 * 3. Calculates percentage change
 * 4. Returns formatted statistics object
 * 5. Handles all edge cases gracefully
 *
 * @param userId - UUID of the user whose booking statistics to calculate
 * @param supabaseClient - Optional Supabase client (defaults to standard client)
 * @returns Promise<BookingStats> - Complete booking statistics object
 * @throws Error if database queries fail
 *
 * @example
 * const stats = await getBookingStats('user-uuid-123')
 * console.log(`Bookings: ${stats.current} (${stats.percentageChange > 0 ? '+' : ''}${stats.percentageChange}%)`)
 * // "Bookings: 15 (+25%)"
 */
export async function getBookingStats(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<BookingStats> {
	try {
		// Fetch both current and previous month bookings in parallel for better performance
		const [currentBookings, previousBookings] = await Promise.all([
			getCurrentMonthBookings(userId, supabaseClient),
			getLastMonthBookings(userId, supabaseClient)
		])

		// Calculate percentage change
		const percentageChange = calculatePercentageChange(
			currentBookings,
			previousBookings
		)

		return {
			current: currentBookings,
			previous: previousBookings,
			percentageChange
		}
	} catch (error) {
		console.error('Error fetching booking statistics:', error)
		throw new Error(`Failed to fetch booking statistics: ${error}`)
	}
}

/**
 * Retrieves total pending bookings for the current calendar month
 * Counts all bookings with status 'pending' in current month
 *
 * This function:
 * 1. Filters bookings by user_id for security
 * 2. Only includes bookings with status 'pending' (unconfirmed)
 * 3. Filters by start_time timestamp for current calendar month
 * 4. Handles timezone-aware date filtering
 * 5. Returns 0 if no bookings found (graceful handling)
 *
 * @param userId - UUID of the user whose bookings to count
 * @param supabaseClient - Optional Supabase client (defaults to standard client)
 * @returns Promise<number> - Total pending bookings for current month
 * @throws Error if database query fails
 *
 * @example
 * const bookings = await getCurrentMonthPendingBookings('user-uuid-123')
 * console.log(`Current month pending bookings: ${bookings}`) // "Current month pending bookings: 3"
 */
export async function getCurrentMonthPendingBookings(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<number> {
	const client = supabaseClient || supabase

	try {
		// Get current date for month calculation
		const now = new Date()
		const currentYear = now.getFullYear()
		const currentMonth = now.getMonth() + 1 // JavaScript months are 0-indexed

		// Calculate upper bound for date range (first day of next month)
		let upperBoundYear = currentYear
		let upperBoundMonth = currentMonth + 1

		if (upperBoundMonth > 12) {
			// December -> January of next year
			upperBoundMonth = 1
			upperBoundYear = upperBoundYear + 1
		}

		// Query bookings for current calendar month
		// Count pending bookings (unconfirmed)
		const { count, error } = await client
			.from('bookings')
			.select('*', { count: 'exact', head: true })
			.eq('user_id', userId)
			.eq('status', 'pending')
			.gte(
				'start_time',
				`${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`
			)
			.lt(
				'start_time',
				`${upperBoundYear}-${upperBoundMonth.toString().padStart(2, '0')}-01`
			)

		if (error) {
			console.error(
				'Error fetching current month pending bookings:',
				error
			)
			throw new Error(
				`Failed to fetch current month pending bookings: ${error.message}`
			)
		}

		// Return count, handle null gracefully
		return count || 0
	} catch (error) {
		console.error(
			'Unexpected error in getCurrentMonthPendingBookings:',
			error
		)
		throw error
	}
}

/**
 * Retrieves total pending bookings for the previous calendar month
 * Counts all bookings with status 'pending' in previous month
 *
 * This function:
 * 1. Calculates previous month dates accounting for year boundaries
 * 2. Filters bookings by user_id for security
 * 3. Only includes bookings with status 'pending' (unconfirmed)
 * 4. Filters by start_time timestamp for previous calendar month
 * 5. Handles timezone-aware date filtering
 * 6. Returns 0 if no bookings found (graceful handling)
 *
 * @param userId - UUID of the user whose bookings to count
 * @param supabaseClient - Optional Supabase client (defaults to standard client)
 * @returns Promise<number> - Total pending bookings for previous month
 * @throws Error if database query fails
 *
 * @example
 * const bookings = await getLastMonthPendingBookings('user-uuid-123')
 * console.log(`Last month pending bookings: ${bookings}`) // "Last month pending bookings: 1"
 */
export async function getLastMonthPendingBookings(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<number> {
	const client = supabaseClient || supabase

	try {
		// Calculate previous month, handling year boundary
		const now = new Date()
		let previousMonth = now.getMonth() // 0-indexed (0 = January)
		let previousYear = now.getFullYear()

		if (previousMonth === 0) {
			// January -> December of previous year
			previousMonth = 11 // December is month 11 in 0-indexed
			previousYear = previousYear - 1
		} else {
			// All other months, just subtract 1
			previousMonth = previousMonth - 1
		}

		// Convert to 1-indexed for date formatting
		const monthForQuery = previousMonth + 1

		// Calculate upper bound for date range (first day of following month)
		let upperBoundYear = previousYear
		let upperBoundMonth = monthForQuery + 1

		if (upperBoundMonth > 12) {
			// December -> January of next year
			upperBoundMonth = 1
			upperBoundYear = upperBoundYear + 1
		}

		// Query bookings for previous calendar month
		const { count, error } = await client
			.from('bookings')
			.select('*', { count: 'exact', head: true })
			.eq('user_id', userId)
			.eq('status', 'pending')
			.gte(
				'start_time',
				`${previousYear}-${monthForQuery.toString().padStart(2, '0')}-01`
			)
			.lt(
				'start_time',
				`${upperBoundYear}-${upperBoundMonth.toString().padStart(2, '0')}-01`
			)

		if (error) {
			console.error('Error fetching last month pending bookings:', error)
			throw new Error(
				`Failed to fetch last month pending bookings: ${error.message}`
			)
		}

		// Return count, handle null gracefully
		return count || 0
	} catch (error) {
		console.error('Unexpected error in getLastMonthPendingBookings:', error)
		throw error
	}
}

/**
 * Retrieves statistics for pending bookings (current vs previous month)
 * Provides comprehensive analytics for dashboard cards
 *
 * This function calculates:
 * - Current month total pending bookings
 * - Previous month total pending bookings
 * - Percentage change between months (with 1 decimal precision)
 * - Handles zero previous month values gracefully (returns null for % change)
 *
 * @param userId - UUID of the user whose statistics to calculate
 * @param supabaseClient - Optional Supabase client for testing/transactions
 * @returns Promise<BookingStats> - Statistics object with current, previous, and percentage change
 * @throws Error if database operations fail
 *
 * @example
 * const stats = await getPendingBookingStats('user-uuid-123')
 * console.log(stats)
 * // {
 * //   current: 3,
 * //   previous: 1,
 * //   percentageChange: 200.0
 * // }
 */
export async function getPendingBookingStats(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<BookingStats> {
	try {
		// Execute both queries in parallel for better performance
		const [currentTotal, previousTotal] = await Promise.all([
			getCurrentMonthPendingBookings(userId, supabaseClient),
			getLastMonthPendingBookings(userId, supabaseClient)
		])

		// Calculate percentage change with proper null handling
		let percentageChange: number | null = null

		if (previousTotal > 0) {
			// Standard percentage calculation when previous month has data
			const change =
				((currentTotal - previousTotal) / previousTotal) * 100
			// Round to 1 decimal place for clean display
			percentageChange = Math.round(change * 10) / 10
		}
		// If previousTotal is 0, leave percentageChange as null
		// This will display as "Primera vez este período" in UI

		return {
			current: currentTotal,
			previous: previousTotal,
			percentageChange
		}
	} catch (error) {
		console.error('Error in getPendingBookingStats:', error)
		throw error
	}
}

/**
 * Retrieves count of active clients in the last 30 days
 * Active clients are those who have at least one booking in the last 30 days
 *
 * This function:
 * 1. Filters bookings by user_id for security
 * 2. Includes all booking statuses (pending, scheduled, completed, canceled)
 * 3. Filters by start_time in the last 30 days from today
 * 4. Counts distinct client_ids to avoid duplicates
 * 5. Returns 0 if no active clients found (graceful handling)
 *
 * @param userId - UUID of the user whose active clients to count
 * @param supabaseClient - Optional Supabase client (defaults to standard client)
 * @returns Promise<number> - Total active clients in last 30 days
 * @throws Error if database query fails
 *
 * @example
 * const activeClients = await getActiveClientsLast30Days('user-uuid-123')
 * console.log(`Active clients (last 30 days): ${activeClients}`) // "Active clients (last 30 days): 8"
 */
export async function getActiveClientsLast30Days(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<number> {
	const client = supabaseClient || supabase

	try {
		// Calculate date 30 days ago from today
		const now = new Date()
		const thirtyDaysAgo = new Date()
		thirtyDaysAgo.setDate(now.getDate() - 30)

		// Format dates for PostgreSQL (YYYY-MM-DD format)
		const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]
		const nowStr = now.toISOString().split('T')[0]

		// Query distinct clients with bookings in last 30 days
		// Use distinct on client_id to count unique clients only
		const { data, error } = await client
			.from('bookings')
			.select('client_id', { count: 'exact' })
			.eq('user_id', userId)
			.gte('start_time', thirtyDaysAgoStr)
			.lte('start_time', nowStr)

		if (error) {
			console.error(
				'Error fetching active clients (last 30 days):',
				error
			)
			throw new Error(`Failed to fetch active clients: ${error.message}`)
		}

		// Count unique client IDs
		const uniqueClientIds = new Set(
			data?.map((booking) => booking.client_id) || []
		)
		return uniqueClientIds.size
	} catch (error) {
		console.error('Unexpected error in getActiveClientsLast30Days:', error)
		throw error
	}
}

/**
 * Retrieves count of active clients in the previous 30-day period
 * Active clients are those who had bookings 31-60 days ago (previous period)
 *
 * This function:
 * 1. Calculates the previous 30-day period (31-60 days ago)
 * 2. Filters bookings by user_id for security
 * 3. Includes all booking statuses for comprehensive comparison
 * 4. Filters by start_time in the previous 30-day window
 * 5. Counts distinct client_ids to avoid duplicates
 * 6. Returns 0 if no active clients found (graceful handling)
 *
 * @param userId - UUID of the user whose active clients to count
 * @param supabaseClient - Optional Supabase client (defaults to standard client)
 * @returns Promise<number> - Total active clients in previous 30-day period
 * @throws Error if database query fails
 *
 * @example
 * const previousActiveClients = await getActiveClientsPrevious30Days('user-uuid-123')
 * console.log(`Active clients (31-60 days ago): ${previousActiveClients}`) // "Active clients (31-60 days ago): 6"
 */
export async function getActiveClientsPrevious30Days(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<number> {
	const client = supabaseClient || supabase

	try {
		// Calculate previous 30-day period (31-60 days ago)
		const now = new Date()
		const sixtyDaysAgo = new Date()
		const thirtyOneDaysAgo = new Date()

		sixtyDaysAgo.setDate(now.getDate() - 60)
		thirtyOneDaysAgo.setDate(now.getDate() - 31)

		// Format dates for PostgreSQL (YYYY-MM-DD format)
		const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0]
		const thirtyOneDaysAgoStr = thirtyOneDaysAgo.toISOString().split('T')[0]

		// Query distinct clients with bookings in previous 30-day period
		const { data, error } = await client
			.from('bookings')
			.select('client_id', { count: 'exact' })
			.eq('user_id', userId)
			.gte('start_time', sixtyDaysAgoStr)
			.lte('start_time', thirtyOneDaysAgoStr)

		if (error) {
			console.error(
				'Error fetching active clients (previous 30 days):',
				error
			)
			throw new Error(
				`Failed to fetch previous active clients: ${error.message}`
			)
		}

		// Count unique client IDs
		const uniqueClientIds = new Set(
			data?.map((booking) => booking.client_id) || []
		)
		return uniqueClientIds.size
	} catch (error) {
		console.error(
			'Unexpected error in getActiveClientsPrevious30Days:',
			error
		)
		throw error
	}
}

/**
 * Retrieves statistics for active clients (last 30 days vs previous 30 days)
 * Provides comprehensive analytics for dashboard cards
 *
 * This function calculates:
 * - Active clients in last 30 days (unique clients with bookings)
 * - Active clients in previous 30-day period (31-60 days ago)
 * - Percentage change between periods (with 1 decimal precision)
 * - Handles zero previous period values gracefully (returns null for % change)
 *
 * @param userId - UUID of the user whose statistics to calculate
 * @param supabaseClient - Optional Supabase client for testing/transactions
 * @returns Promise<BookingStats> - Statistics object with current, previous, and percentage change
 * @throws Error if database operations fail
 *
 * @example
 * const stats = await getActiveClientsStats('user-uuid-123')
 * console.log(stats)
 * // {
 * //   current: 8,
 * //   previous: 6,
 * //   percentageChange: 33.3
 * // }
 */
export async function getActiveClientsStats(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<BookingStats> {
	try {
		// Execute both queries in parallel for better performance
		const [currentActiveClients, previousActiveClients] = await Promise.all(
			[
				getActiveClientsLast30Days(userId, supabaseClient),
				getActiveClientsPrevious30Days(userId, supabaseClient)
			]
		)

		// Calculate percentage change with proper null handling
		let percentageChange: number | null = null

		if (previousActiveClients > 0) {
			// Standard percentage calculation when previous period has data
			const change =
				((currentActiveClients - previousActiveClients) /
					previousActiveClients) *
				100
			// Round to 1 decimal place for clean display
			percentageChange = Math.round(change * 10) / 10
		}
		// If previousActiveClients is 0, leave percentageChange as null
		// This will display as "Primera vez este período" in UI

		return {
			current: currentActiveClients,
			previous: previousActiveClients,
			percentageChange
		}
	} catch (error) {
		console.error('Error in getActiveClientsStats:', error)
		throw error
	}
}

/**
 * Formats a currency amount for display
 * Handles EUR formatting with proper decimal places and symbols
 *
 * @param amount - Numeric amount to format
 * @param currency - Currency code (default: 'EUR')
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1234.56) // "€1,234.56"
 * formatCurrency(0) // "€0.00"
 */
export function formatCurrency(
	amount: number,
	currency: string = 'EUR'
): string {
	return new Intl.NumberFormat('es-ES', {
		style: 'currency',
		currency: currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount)
}
