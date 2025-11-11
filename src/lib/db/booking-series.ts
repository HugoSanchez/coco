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
	google_master_event_id?: string | null
	excluded_dates?: string[] | null // Array of ISO date strings (YYYY-MM-DD) for EXDATE
	standalone_event_ids?: Record<string, string> | null // Map of occurrence_index -> google_event_id
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
 * Sets/updates the google_master_event_id on booking_series.
 */
export async function setBookingSeriesMasterEventId(
	client: SupabaseClient,
	id: string,
	googleEventId: string | null
): Promise<void> {
	const { error } = await client.from('booking_series').update({ google_master_event_id: googleEventId }).eq('id', id)
	if (error) throw error
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

/**
 * V2: Adds an excluded date to a series (for cancellation).
 * The date should be in ISO format (YYYY-MM-DD) in the series timezone.
 */
export async function addExcludedDateToSeries(
	client: SupabaseClient,
	seriesId: string,
	excludedDate: string // ISO YYYY-MM-DD
): Promise<void> {
	// Get current excluded dates
	const series = await getBookingSeriesById(client, seriesId)
	if (!series) throw new Error(`Series ${seriesId} not found`)

	const currentExcluded = series.excluded_dates || []
	// Avoid duplicates
	if (currentExcluded.includes(excludedDate)) return

	const updatedExcluded = [...currentExcluded, excludedDate].sort()

	const { error } = await client
		.from('booking_series')
		.update({ excluded_dates: updatedExcluded })
		.eq('id', seriesId)

	if (error) throw error
}

/**
 * V2: Gets all excluded dates for a series.
 */
export async function getExcludedDatesForSeries(
	client: SupabaseClient,
	seriesId: string
): Promise<string[]> {
	const series = await getBookingSeriesById(client, seriesId)
	if (!series) throw new Error(`Series ${seriesId} not found`)
	return series.excluded_dates || []
}

/**
 * V2: Records a standalone event ID for a rescheduled occurrence.
 */
export async function recordStandaloneEventForOccurrence(
	client: SupabaseClient,
	seriesId: string,
	occurrenceIndex: number,
	googleEventId: string
): Promise<void> {
	const series = await getBookingSeriesById(client, seriesId)
	if (!series) throw new Error(`Series ${seriesId} not found`)

	const currentStandalone = series.standalone_event_ids || {}
	const updatedStandalone = {
		...currentStandalone,
		[String(occurrenceIndex)]: googleEventId
	}

	const { error } = await client
		.from('booking_series')
		.update({ standalone_event_ids: updatedStandalone })
		.eq('id', seriesId)

	if (error) throw error
}

/**
 * V2: Gets standalone event ID for a specific occurrence.
 */
export async function getStandaloneEventIdForOccurrence(
	client: SupabaseClient,
	seriesId: string,
	occurrenceIndex: number
): Promise<string | null> {
	const series = await getBookingSeriesById(client, seriesId)
	if (!series) return null

	const standaloneMap = series.standalone_event_ids || {}
	return standaloneMap[String(occurrenceIndex)] || null
}

/**
 * V2: Gets all standalone event IDs for a series (for cleanup on series cancellation).
 */
export async function getAllStandaloneEventIdsForSeries(
	client: SupabaseClient,
	seriesId: string
): Promise<string[]> {
	const series = await getBookingSeriesById(client, seriesId)
	if (!series) return []

	const standaloneMap = series.standalone_event_ids || {}
	return Object.values(standaloneMap).filter((id): id is string => typeof id === 'string')
}


