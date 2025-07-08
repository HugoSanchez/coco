/**
 * Calendar Events Database Operations
 *
 * This module handles all database operations related to calendar events, including:
 * - Creating calendar event records after Google Calendar event creation
 * - Retrieving calendar events for bookings
 * - Managing calendar event status and updates
 *
 * The calendar events system integrates with:
 * - Bookings: Each calendar event is associated with a specific booking
 * - Google Calendar API: Events are created in practitioner's calendar
 * - Auth: All calendar events belong to authenticated users
 */

import { Tables, TablesInsert } from '@/types/database.types'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabase = createSupabaseClient()

/**
 * Type alias for the calendar_events table row structure
 * Provides type safety for calendar event data operations
 */
export type CalendarEvent = Tables<'calendar_events'>

/**
 * Type alias for calendar event insertion payload
 * Used when creating new calendar event records
 */
export type CalendarEventInsert = TablesInsert<'calendar_events'>

/**
 * Interface for creating a new calendar event record
 * Called after successfully creating an event in Google Calendar
 *
 * @interface CreateCalendarEventPayload
 * @property booking_id - UUID of the booking this event belongs to
 * @property user_id - UUID of the practitioner (auth.users.id)
 * @property google_event_id - Google Calendar event ID returned from API
 * @property google_meet_link - Google Meet conference link
 * @property event_status - Optional status (defaults to 'created')
 */
export interface CreateCalendarEventPayload {
	booking_id: string
	user_id: string
	google_event_id: string
	google_meet_link?: string
	event_status?: 'created' | 'updated' | 'cancelled'
	event_type?: 'pending' | 'confirmed'
}

/**
 * Creates a new calendar event record in the database
 * Called after successfully creating the event in Google Calendar
 *
 * @param payload - Calendar event data to insert
 * @param supabaseClient - Optional SupabaseClient instance to use for insertion
 * @returns Promise<CalendarEvent> - The created calendar event record with generated ID
 * @throws Error if insertion fails or validation errors occur
 */
export async function createCalendarEvent(
	payload: CreateCalendarEventPayload,
	supabaseClient?: SupabaseClient
): Promise<CalendarEvent> {
	// Set default values
	const calendarEventData = {
		...payload,
		event_status: payload.event_status || 'created',
		event_type: payload.event_type || 'pending'
	}

	// Use provided client or fall back to default
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('calendar_events')
		.insert([calendarEventData])
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Retrieves calendar events for a specific booking
 * Typically there should only be one event per booking
 *
 * @param bookingId - UUID of the booking
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<CalendarEvent[]> - Array of calendar events for the booking
 * @throws Error if database operation fails
 */
export async function getCalendarEventsForBooking(
	bookingId: string,
	supabaseClient?: SupabaseClient
): Promise<CalendarEvent[]> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('calendar_events')
		.select('*')
		.eq('booking_id', bookingId)
		.order('created_at', { ascending: false })

	if (error) throw error
	return data || []
}

/**
 * Retrieves a calendar event by Google event ID
 * Useful for webhook handling or event updates
 *
 * @param googleEventId - Google Calendar event ID
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<CalendarEvent | null> - The calendar event record or null if not found
 * @throws Error if database operation fails
 */
export async function getCalendarEventByGoogleId(
	googleEventId: string,
	supabaseClient?: SupabaseClient
): Promise<CalendarEvent | null> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('calendar_events')
		.select('*')
		.eq('google_event_id', googleEventId)
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
 * Updates a calendar event's status
 * Common statuses: 'created', 'updated', 'cancelled'
 *
 * @param calendarEventId - UUID of the calendar event to update
 * @param status - New status for the calendar event
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<CalendarEvent> - The updated calendar event record
 * @throws Error if update fails or calendar event not found
 */
export async function updateCalendarEventStatus(
	calendarEventId: string,
	status: 'created' | 'updated' | 'cancelled',
	supabaseClient?: SupabaseClient
): Promise<CalendarEvent> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('calendar_events')
		.update({
			event_status: status,
			updated_at: new Date().toISOString()
		})
		.eq('id', calendarEventId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Updates a calendar event's type (pending to confirmed)
 * Used when converting placeholder events to full appointments after payment
 *
 * @param calendarEventId - UUID of the calendar event to update
 * @param eventType - New event type ('pending' or 'confirmed')
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<CalendarEvent> - The updated calendar event record
 * @throws Error if update fails or calendar event not found
 */
export async function updateCalendarEventType(
	calendarEventId: string,
	eventType: 'pending' | 'confirmed',
	supabaseClient?: SupabaseClient
): Promise<CalendarEvent> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('calendar_events')
		.update({
			event_type: eventType,
			updated_at: new Date().toISOString()
		})
		.eq('id', calendarEventId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Deletes a calendar event record from the database
 * Note: This doesn't delete the Google Calendar event itself
 *
 * @param calendarEventId - UUID of the calendar event to delete
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<void>
 * @throws Error if deletion fails or calendar event not found
 */
export async function deleteCalendarEvent(
	calendarEventId: string,
	supabaseClient?: SupabaseClient
): Promise<void> {
	const client = supabaseClient || supabase

	const { error } = await client
		.from('calendar_events')
		.delete()
		.eq('id', calendarEventId)

	if (error) throw error
}

/**
 * Retrieves all calendar events for a specific user (practitioner)
 * Useful for debugging or admin purposes
 *
 * @param userId - UUID of the user (auth.users.id)
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<CalendarEvent[]> - Array of calendar events for the user
 * @throws Error if database operation fails
 */
export async function getCalendarEventsForUser(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<CalendarEvent[]> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('calendar_events')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })

	if (error) throw error
	return data || []
}
