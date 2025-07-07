/**
 * Booking Database Operations
 *
 * This module handles all database operations related to bookings, including:
 * - Creating new bookings with client and time slot information
 * - Retrieving bookings for a user
 * - Managing booking status and updates
 *
 * The booking system integrates with:
 * - Clients: Each booking is associated with a specific client
 * - Time slots: Bookings have start and end times
 * - User scheduling: All bookings belong to a specific user
 */

import { Tables, TablesInsert } from '@/types/database.types'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
const supabase = createSupabaseClient()

/**
 * Type alias for the Booking table row structure
 * Provides type safety for booking data operations
 */
export type Booking = Tables<'bookings'>

/**
 * Type alias for booking insertion payload
 * Used when creating new bookings
 */
export type BookingInsert = TablesInsert<'bookings'>

/**
 * Interface for creating a new booking
 *
 * Ultra-clean booking interface: focused purely on scheduling.
 * Billing and payment details are tracked in separate tables.
 *
 * @interface CreateBookingPayload
 * @property user_id - UUID of the user who owns this booking
 * @property client_id - UUID of the client for this booking
 * @property start_time - ISO string of booking start time
 * @property end_time - ISO string of booking end time
 * @property status - Optional booking status (defaults to 'scheduled')
 */
export interface CreateBookingPayload {
	user_id: string
	client_id: string
	start_time: string
	end_time: string
	status?: 'pending' | 'scheduled' | 'completed' | 'canceled'
}

/**
 * Interface for booking with client information
 * Used when retrieving bookings with related client data
 */
export interface BookingWithClient extends Booking {
	client: {
		id: string
		name: string
		email: string
	}
}

/**
 * Interface for booking with complete dashboard data
 * Includes client, bill, and derived billing/payment status information
 */
export interface BookingWithBills extends Booking {
	client: {
		id: string
		name: string
		email: string
	}
	bill?: {
		id: string
		amount: number
		currency: string
		status: 'pending' | 'sent' | 'paid' | 'disputed' | 'canceled'
		created_at: string
		due_date: string | null
		sent_at: string | null
		paid_at: string | null
	} | null
	// Derived statuses for easy UI consumption
	billing_status: 'not_generated' | 'pending' | 'sent' | 'canceled'
	payment_status:
		| 'not_applicable'
		| 'pending'
		| 'paid'
		| 'disputed'
		| 'canceled'
}

/**
 * Interface for paginated booking results
 * Used when fetching bookings with pagination support
 */
export interface PaginatedBookingsResult {
	bookings: BookingWithBills[]
	hasMore: boolean
	total?: number // Optional: total count for debugging/UI
}

/**
 * Interface for pagination options
 * Used to configure pagination behavior
 */
export interface PaginationOptions {
	limit?: number
	offset?: number
}

/**
 * Interface for booking filters
 * Used to filter bookings at the database level
 */
export interface BookingFilterOptions {
	customerSearch?: string
	statusFilter?: 'all' | 'pending' | 'scheduled' | 'completed' | 'cancelled'
	startDate?: string
	endDate?: string
}

/**
 * Retrieves all bookings for a specific user, ordered by start time (newest first)
 * Includes related client information
 *
 * @param userId - The UUID of the user whose bookings to fetch
 * @returns Promise<BookingWithClient[]> - Array of booking objects with client data
 * @throws Error if database operation fails
 */
export async function getBookingsForUser(
	userId: string
): Promise<BookingWithClient[]> {
	const { data, error } = await supabase
		.from('bookings')
		.select(
			`
			*,
			client:clients(id, name, email)
		`
		)
		.eq('user_id', userId)
		.order('start_time', { ascending: false })

	if (error) throw error
	return data || []
}

/**
 * Retrieves bookings for a specific date range
 * Useful for calendar views and scheduling conflicts
 *
 * @param userId - The UUID of the user whose bookings to fetch
 * @param startDate - Start of date range (ISO string)
 * @param endDate - End of date range (ISO string)
 * @returns Promise<BookingWithClient[]> - Array of bookings in the date range
 * @throws Error if database operation fails
 */
export async function getBookingsForDateRange(
	userId: string,
	startDate: string,
	endDate: string
): Promise<BookingWithClient[]> {
	const { data, error } = await supabase
		.from('bookings')
		.select(
			`
			*,
			client:clients(id, name, email)
		`
		)
		.eq('user_id', userId)
		.gte('start_time', startDate)
		.lte('start_time', endDate)
		.order('start_time', { ascending: true })

	if (error) throw error
	return data || []
}

/**
 * Creates a new booking in the database
 * Note: Time slot conflicts are prevented at the UI level via DayViewTimeSelector
 *
 * @param payload - Booking data to insert
 * @param supabaseClient - Optional SupabaseClient instance to use for insertion
 * @returns Promise<Booking> - The created booking object with generated ID
 * @throws Error if insertion fails or validation errors occur
 */
export async function createBooking(
	payload: CreateBookingPayload,
	supabaseClient?: SupabaseClient
): Promise<Booking> {
	// Set default values
	const bookingData = {
		...payload,
		status: payload.status || 'scheduled'
	}

	// Use provided client or fall back to default
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('bookings')
		.insert([bookingData])
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Updates a booking's status
 * Common statuses: 'scheduled', 'completed', 'cancelled', 'no-show'
 *
 * @param bookingId - UUID of the booking to update
 * @param status - New status for the booking
 * @returns Promise<Booking> - The updated booking object
 * @throws Error if update fails or booking not found
 */
export async function updateBookingStatus(
	bookingId: string,
	status: string,
	supabaseClient?: SupabaseClient
): Promise<Booking> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('bookings')
		.update({
			status,
			updated_at: new Date().toISOString()
		})
		.eq('id', bookingId)
		.select()
		.single()

	if (error) {
		console.log('Error updating booking status', error)
		throw error
	}
	return data
}

/**
 * Deletes a booking from the database
 * Note: Consider using status updates ('cancelled') instead of hard deletion for audit trails
 *
 * @param bookingId - UUID of the booking to delete
 * @returns Promise<void>
 * @throws Error if deletion fails or booking not found
 */
export async function deleteBooking(
	bookingId: string,
	supabaseClient?: SupabaseClient
): Promise<void> {
	const client = supabaseClient || supabase

	const { error } = await client.from('bookings').delete().eq('id', bookingId)

	if (error) throw error
}

/**
 * Retrieves a single booking by ID with client information
 *
 * @param bookingId - UUID of the booking to retrieve
 * @param supabaseClient - Optional SupabaseClient instance to use
 * @returns Promise<BookingWithClient | null> - The booking object with client data, or null if not found
 * @throws Error if database operation fails
 */
export async function getBookingById(
	bookingId: string,
	supabaseClient?: SupabaseClient
): Promise<BookingWithClient | null> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('bookings')
		.select(
			`
			*,
			client:clients(id, name, email)
		`
		)
		.eq('id', bookingId)
		.single()

	if (error) {
		if (error.code === 'PGRST116') {
			// No rows returned
			return null
		}
		throw error
	}

	return data
}

/**
 * Retrieves bookings for a user with complete billing information and pagination support
 * Perfect for dashboard tables that need comprehensive booking data with efficient loading
 *
 * @param userId - The UUID of the user whose bookings to fetch
 * @param options - Optional pagination configuration
 * @param filters - Optional filters to apply at database level
 * @returns Promise<PaginatedBookingsResult> - Object with bookings array and pagination metadata
 * @throws Error if database operation fails
 */
export async function getBookingsWithBills(
	userId: string,
	options: PaginationOptions = {},
	filters: BookingFilterOptions = {}
): Promise<PaginatedBookingsResult> {
	const { limit = 10, offset = 0 } = options
	const { customerSearch, statusFilter, startDate, endDate } = filters

	// Fetch one extra record to determine if there are more results
	const fetchLimit = limit + 1

	let query = supabase
		.from('bookings')
		.select(
			`
			*,
			client:clients(id, name, email),
			bill:bills(
				id,
				amount,
				currency,
				status,
				created_at,
				due_date,
				sent_at,
				paid_at
			)
		`
		)
		.eq('user_id', userId)

	// Apply filters
	if (customerSearch) {
		query = query.or(
			`client.name.ilike.%${customerSearch}%,client.email.ilike.%${customerSearch}%`
		)
	}

	if (statusFilter && statusFilter !== 'all') {
		query = query.eq('status', statusFilter)
	}

	if (startDate) {
		query = query.gte('start_time', startDate)
	}

	if (endDate) {
		query = query.lte('start_time', endDate)
	}

	// Apply ordering and pagination
	const { data, error } = await query
		.order('created_at', { ascending: false })
		.range(offset, offset + fetchLimit - 1)

	if (error) throw error

	const allResults = data || []

	// Check if there are more results beyond our limit
	const hasMore = allResults.length > limit

	// Remove the extra record we fetched for hasMore detection
	const bookings = hasMore ? allResults.slice(0, limit) : allResults

	// Transform the data to include derived statuses
	const bookingsWithBills: BookingWithBills[] = bookings.map((booking) => {
		const bill = Array.isArray(booking.bill)
			? booking.bill[0]
			: booking.bill

		// Derive billing and payment statuses from bill status
		let billing_status: BookingWithBills['billing_status']
		let payment_status: BookingWithBills['payment_status']

		if (!bill) {
			billing_status = 'not_generated'
			payment_status = 'not_applicable'
		} else {
			switch (bill.status) {
				case 'pending':
					billing_status = 'pending'
					payment_status = 'pending'
					break
				case 'sent':
					billing_status = 'sent'
					payment_status = 'pending'
					break
				case 'paid':
					billing_status = 'sent'
					payment_status = 'paid'
					break
				case 'disputed':
					billing_status = 'sent'
					payment_status = 'disputed'
					break
				case 'canceled':
					billing_status = 'canceled'
					payment_status = 'canceled'
					break
				default:
					billing_status = 'not_generated'
					payment_status = 'not_applicable'
			}
		}

		return {
			...booking,
			bill: bill || null,
			billing_status,
			payment_status
		}
	})

	return {
		bookings: bookingsWithBills,
		hasMore,
		total: undefined // Can be added later if needed for UI
	}
}
