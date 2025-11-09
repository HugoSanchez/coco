/**
 * Booking Series DB Helpers (minimal)
 *
 * PURPOSE
 * - CRUD-lite helpers for the new `booking_series` table used by recurring bookings.
 * - Kept small and explicit to keep V1 simple and maintainable.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Row shape for booking_series (mirrors migration 20251107120000_recurring_bookings.sql)
 */
export interface BookingSeriesRow {
	id: string
	user_id: string
	client_id: string
	timezone: string
	dtstart_local: string // timestamp without time zone, serialized as 'YYYY-MM-DDTHH:mm:ss'
	duration_min: number
	recurrence_kind: 'WEEKLY'
	interval_weeks: 1 | 2
	by_weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6
	mode: string | null
	location_text: string | null
	consultation_type: string | null
	status: 'active' | 'paused' | 'ended'
	until: string | null
	created_at: string
	updated_at: string
}

export interface CreateBookingSeriesInput {
	user_id: string
	client_id: string
	timezone: string
	dtstart_local: string
	duration_min: number
	interval_weeks: 1 | 2
	by_weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6
	mode?: string | null
	location_text?: string | null
	consultation_type?: string | null
}

/**
 * Inserts a new booking series and returns its id.
 */
export async function createBookingSeries(
	client: SupabaseClient,
	input: CreateBookingSeriesInput
): Promise<{ id: string }> {
	const payload = {
		user_id: input.user_id,
		client_id: input.client_id,
		timezone: input.timezone,
		dtstart_local: input.dtstart_local,
		duration_min: input.duration_min,
		recurrence_kind: 'WEEKLY' as const,
		interval_weeks: input.interval_weeks,
		by_weekday: input.by_weekday,
		mode: input.mode ?? null,
		location_text: input.location_text ?? null,
		consultation_type: input.consultation_type ?? null
	}

	const { data, error } = await client.from('booking_series').insert([payload]).select('id').single()
	if (error) throw error
	return { id: (data as any).id as string }
}

/**
 * Fetches a series by id (or null if not found).
 */
export async function getBookingSeriesById(client: SupabaseClient, id: string): Promise<BookingSeriesRow | null> {
	const { data, error } = await client.from('booking_series').select('*').eq('id', id).single()
	if (error) {
		if ((error as any).code === 'PGRST116') return null
		throw error
	}
	return data as BookingSeriesRow
}

/**
 * Lists active series for a user (used by cron to extend horizons).
 */
export async function listActiveSeriesForUser(
	client: SupabaseClient,
	userId: string
): Promise<BookingSeriesRow[]> {
	const { data, error } = await client
		.from('booking_series')
		.select('*')
		.eq('user_id', userId)
		.eq('status', 'active')
		.order('dtstart_local', { ascending: true })

	if (error) throw error
	return (data as BookingSeriesRow[]) || []
}

/**
 * Lists all active series across users (for cron extension).
 */
export async function listAllActiveSeries(client: SupabaseClient): Promise<BookingSeriesRow[]> {
    const { data, error } = await client
        .from('booking_series')
        .select('*')
        .eq('status', 'active')
        .order('dtstart_local', { ascending: true })

    if (error) throw error
    return (data as BookingSeriesRow[]) || []
}

/**
 * Sets series status and optional until date.
 */
export async function setBookingSeriesStatus(
    client: SupabaseClient,
    id: string,
    status: 'active' | 'paused' | 'ended',
    untilLocal?: string | null
): Promise<void> {
    const { error } = await client
        .from('booking_series')
        .update({ status, until: untilLocal ?? null })
        .eq('id', id)
    if (error) throw error
}


