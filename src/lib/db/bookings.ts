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
 * @returns Promise<Booking> - The created booking object with generated ID
 * @throws Error if insertion fails or validation errors occur
 */
export async function createBooking(
	payload: CreateBookingPayload
): Promise<Booking> {
	// Set default values
	const bookingData = {
		...payload,
		status: payload.status || 'scheduled'
	}

	const { data, error } = await supabase
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
	status: string
): Promise<Booking> {
	const { data, error } = await supabase
		.from('bookings')
		.update({
			status,
			updated_at: new Date().toISOString()
		})
		.eq('id', bookingId)
		.select()
		.single()

	if (error) throw error
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
export async function deleteBooking(bookingId: string): Promise<void> {
	const { error } = await supabase
		.from('bookings')
		.delete()
		.eq('id', bookingId)

	if (error) throw error
}

/**
 * Retrieves a single booking by ID with client information
 *
 * @param bookingId - UUID of the booking to retrieve
 * @returns Promise<BookingWithClient | null> - The booking object with client data, or null if not found
 * @throws Error if database operation fails
 */
export async function getBookingById(
	bookingId: string
): Promise<BookingWithClient | null> {
	const { data, error } = await supabase
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
