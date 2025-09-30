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
	consultation_type?: 'first' | 'followup'
	// Scheduling mode: defaults to 'online' at the API/service layer
	mode?: 'online' | 'in_person'
	// Only present when mode is 'in_person'
	location_text?: string | null
}

/**
 * Interface for booking with client information
 * Used when retrieving bookings with related client data
 */
export interface BookingWithClient extends Booking {
	client: {
		id: string
		name: string
		last_name: string | null
		email: string
		full_name_search: string
	} | null
}

/**
 * Interface for booking with complete dashboard data
 * Includes client, bill, and derived billing/payment status information
 */
export interface BookingWithBills extends Booking {
	client: {
		id: string
		name: string
		last_name: string | null
		email: string
		full_name_search: string
	} | null
	bill?: {
		id: string
		amount: number
		currency: string
		status:
			| 'pending'
			| 'sent'
			| 'paid'
			| 'disputed'
			| 'canceled'
			| 'refunded'
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
		| 'refunded'
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
	statusFilter?: 'all' | 'pending' | 'scheduled' | 'completed' | 'canceled'
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
			client:clients(id, name, last_name, email)
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
 * @param supabaseClient - Optional SupabaseClient instance for server-side usage
 * @returns Promise<BookingWithClient[]> - Array of bookings in the date range
 * @throws Error if database operation fails
 */
export async function getBookingsForDateRange(
	userId: string,
	startDate: string,
	endDate: string,
	supabaseClient?: SupabaseClient
): Promise<BookingWithClient[]> {
	const client = supabaseClient || supabase
	const { data, error } = await client
		.from('bookings')
		.select(
			`
			*,
			client:clients(id, name, last_name, email)
		`
		)
		.eq('user_id', userId)
		.gte('start_time', startDate)
		.lte('start_time', endDate)
		.neq('status', 'canceled') // Exclude canceled bookings from time selection
		.order('start_time', { ascending: true })

	if (error) throw error
	return data || []
}

/**
 * Retrieves bookings across ALL users for a specific date window
 * Includes related client and practitioner profile information.
 *
 * WHY
 * ---
 * Cron tasks (like daily appointment reminders) need to process bookings
 * for every practitioner, not a single user. This helper runs with a
 * service role client and returns the minimal data the cron needs.
 *
 * FILTERS
 * -------
 * - start_time between [startDate, endDate]
 * - status != 'canceled'
 * - ordered by start_time ascending
 */
export async function getBookingsForDateRangeAllUsers(
	startDate: string,
	endDate: string,
	supabaseClient?: SupabaseClient
): Promise<
	Array<
		Booking & {
			client: {
				id: string
				name: string
				last_name: string | null
				email: string
			} | null
			user: { id: string; name: string | null; email: string } | null
		}
	>
> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('bookings')
		.select(
			`
            *,
            client:clients(id, name, last_name, email)
        `
		)
		.gte('start_time', startDate)
		.lte('start_time', endDate)
		.neq('status', 'canceled')
		.order('start_time', { ascending: true })

	if (error) throw error
	return (data as any) || []
}

/**
 * Paged variant: retrieves bookings across ALL users for a specific date window
 * using cursor-based pagination on (start_time, id) to ensure stable ordering.
 *
 * PARAMETERS
 * ----------
 * - startDate, endDate: ISO strings defining the window
 * - limit: max items to return per page (e.g., 100)
 * - cursorStartTime: ISO string of the last seen start_time
 * - cursorId: UUID of the last seen booking (tie-breaker for identical start_time)
 *
 * RETURNS
 * -------
 * { items, nextCursor }
 * - nextCursor is null when there are no more items
 */
export async function getBookingsForDateRangeAllUsersPaged(
	startDate: string,
	endDate: string,
	limit: number,
	cursorStartTime?: string | null,
	cursorId?: string | null,
	supabaseClient?: SupabaseClient
): Promise<{
	items: Array<
		Booking & {
			client: {
				id: string
				name: string
				last_name: string | null
				email: string
			} | null
			user: { id: string; name: string | null; email: string } | null
		}
	>
	nextCursor: { startTime: string; id: string } | null
}> {
	const client = supabaseClient || supabase

	// Base query with filters and relations
	let query = client
		.from('bookings')
		.select(
			`
            *,
            client:clients(id, name, last_name, email),
            reminders:email_communications!left(id,email_type,status)
        `
		)
		.gte('start_time', startDate)
		.lte('start_time', endDate)
		.neq('status', 'canceled')
		// Only allow bookings that have NO sent reminder rows
		.eq('reminders.email_type', 'appointment_reminder')
		.eq('reminders.status', 'sent')
		.is('reminders', null)
		.order('start_time', { ascending: true })
		.order('id', { ascending: true })

	// Apply cursor for stable pagination: (start_time > cursorStartTime) OR
	// (start_time = cursorStartTime AND id > cursorId)
	if (cursorStartTime) {
		query = query.or(
			`and(start_time.gt.${cursorStartTime}),and(start_time.eq.${cursorStartTime},id.gt.${cursorId})`
		) as any
	}

	const { data, error } = await query.limit(limit)
	if (error) throw error

	const items = (data as any) || []
	if (!items.length) {
		return { items: [], nextCursor: null }
	}

	const last = items[items.length - 1]
	return {
		items,
		nextCursor: { startTime: last.start_time, id: last.id }
	}
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
 * Common statuses: 'scheduled', 'completed', 'canceled', 'no-show'
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
 * Note: Consider using status updates ('canceled') instead of hard deletion for audit trails
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
			client:clients(id, name, last_name, email)
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
 * Retrieves a single booking by ID with user ownership validation
 * Used for operations that require confirming the user owns the booking
 *
 * @param bookingId - UUID of the booking to retrieve
 * @param userId - UUID of the user who should own the booking
 * @param supabaseClient - Optional SupabaseClient instance to use
 * @returns Promise<Booking | null> - The booking object, or null if not found or not owned by user
 * @throws Error if database operation fails
 */
export async function getBookingByIdAndUser(
	bookingId: string,
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<Booking | null> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('bookings')
		.select('*')
		.eq('id', bookingId)
		.eq('user_id', userId)
		.single()

	if (error) {
		if (error.code === 'PGRST116') {
			// No rows returned - either doesn't exist or user doesn't own it
			return null
		}
		throw error
	}

	return data
}

/**
 * Updates a booking's date and time (reschedule operation)
 * This function specifically handles rescheduling by updating start_time and end_time
 *
 * @param bookingId - UUID of the booking to reschedule
 * @param userId - UUID of the user who owns the booking (for ownership validation)
 * @param newStartTime - New start time in ISO string format
 * @param newEndTime - New end time in ISO string format
 * @param supabaseClient - Optional SupabaseClient instance to use
 * @returns Promise<Booking> - The updated booking object
 * @throws Error if update fails, booking not found, or user doesn't own booking
 */
export async function rescheduleBooking(
	bookingId: string,
	userId: string,
	newStartTime: string,
	newEndTime: string,
	supabaseClient?: SupabaseClient
): Promise<Booking> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('bookings')
		.update({
			start_time: newStartTime,
			end_time: newEndTime,
			updated_at: new Date().toISOString()
		})
		.eq('id', bookingId)
		.eq('user_id', userId)
		.select()
		.single()

	if (error) {
		console.log('Error rescheduling booking', error)
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
			client:clients(id, name, last_name, email, full_name_search),
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
		// Use computed full_name_search column for clean, reliable filtering
		// Supports "Hugo", "Sanchez", or "Hugo Sanchez" searches
		query = query
			.filter('client.full_name_search', 'ilike', `%${customerSearch}%`)
			.not('client', 'is', null)
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
				case 'refunded':
					billing_status = 'sent'
					payment_status = 'refunded'
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

/**
 * Returns bookings missing a linked calendar event for a given user.
 * - Uses a left relation to calendar_events and filters where the related
 *   google_event_id is null.
 * - Caller supplies limit to cap rows (e.g., threshold + 1 for overflow detection).
 */
export async function getBookingsMissingCalendarEvents(
	userId: string,
	limit: number,
	supabaseClient?: SupabaseClient
) {
	const client = supabaseClient || supabase

	// Only consider FUTURE bookings to avoid backfilling historical data
	const nowIso = new Date().toISOString()

	const { data, error } = await client
		.from('bookings')
		.select(`*, calendar_events:calendar_events(google_event_id)`)
		.eq('user_id', userId)
		.neq('status', 'canceled')
		.gte('start_time', nowIso)
		// Important: for 1:N embeds, filter the whole relation to be null
		// Using calendar_events.google_event_id may still match when any child is null
		// We want bookings with NO related calendar_events at all
		.is('calendar_events', null)
		.order('start_time', { ascending: true })
		.limit(limit)

	if (error) throw error

	// Defensive: ensure we only return bookings with zero related events
	return (data || []).filter(
		(b: any) => !b.calendar_events || b.calendar_events.length === 0
	)
}

/**
 * Returns true if a client has any non-canceled bookings with the given user.
 * Useful to determine whether a booking should default to "first" or "followup".
 */
export async function hasAnyNonCanceledBookings(
	userId: string,
	clientId: string,
	supabaseClient?: SupabaseClient
): Promise<boolean> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('bookings')
		.select('id')
		.eq('user_id', userId)
		.eq('client_id', clientId)
		.neq('status', 'canceled')
		.limit(1)

	if (error) throw error
	return (data || []).length > 0
}
