import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabase = createSupabaseClient()

/**
 * Returns the meeting_duration (in minutes) for a user's schedule.
 * Falls back to null if none is configured or not found.
 */
export async function getMeetingDuration(userId: string, supabaseClient?: SupabaseClient): Promise<number | null> {
	const client = supabaseClient || supabase
	const { data, error } = await client
		.from('schedules')
		.select('meeting_duration')
		.eq('user_id', userId)
		.maybeSingle()

	if (error) return null
	return (data as any)?.meeting_duration ?? null
}
