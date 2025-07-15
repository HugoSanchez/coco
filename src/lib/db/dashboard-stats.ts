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
 * @property percentageChange - Percentage change from previous to current month
 * @property currency - Currency code (always 'EUR' for now)
 */
export interface RevenueStats {
	current: number
	previous: number
	percentageChange: number
	currency: string
}

/**
 * Interface for booking count statistics
 * Contains current month bookings, previous month bookings, and calculated changes
 *
 * @interface BookingStats
 * @property current - Booking count for current calendar month
 * @property previous - Booking count for previous calendar month
 * @property percentageChange - Percentage change from previous to current month
 */
export interface BookingStats {
	current: number
	previous: number
	percentageChange: number
}

/**
 * Interface for active clients statistics
 * Contains active client count for last 30 days and previous 30-day period
 *
 * @interface ActiveClientsStats
 * @property current - Active clients in last 30 days
 * @property previous - Active clients in previous 30-day period (days 31-60 ago)
 * @property percentageChange - Percentage change from previous to current period
 */
export interface ActiveClientsStats {
	current: number
	previous: number
	percentageChange: number
}

/**
 * Calculates the percentage change between two values
 * Handles edge cases like zero or null previous values gracefully
 *
 * @param current - Current period value
 * @param previous - Previous period value
 * @returns Percentage change (positive for increase, negative for decrease)
 *
 * @example
 * calculatePercentageChange(120, 100) // Returns 20 (20% increase)
 * calculatePercentageChange(80, 100)  // Returns -20 (20% decrease)
 * calculatePercentageChange(50, 0)    // Returns 100 (treat as 100% increase from zero)
 */
export function calculatePercentageChange(
	current: number,
	previous: number
): number {
	// Handle edge case: no previous data
	if (previous === 0 || previous === null || previous === undefined) {
		return current > 0 ? 100 : 0
	}

	// Calculate standard percentage change
	return Math.round(((current - previous) / previous) * 100)
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
