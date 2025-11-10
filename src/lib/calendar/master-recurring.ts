/**
 * Master Recurring Calendar Events (Google)
 *
 * V1 SCOPE
 * - Create a single master recurring event with RRULE (weekly / bi-weekly)
 * - Delete the master event on cancel
 * - App is source of truth; no per-occurrence overrides here
 *
 * V2 SCOPE
 * - Update master event with EXDATE for canceled occurrences
 * - Create standalone events for rescheduled occurrences
 */

import { getAuthenticatedCalendar } from '@/lib/google'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatExdateRule } from '@/lib/dates/recurrence'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'

function weekdayToByDay(weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6): string {
	// 0=Sun..6=Sat → SU,MO,TU,WE,TH,FR,SA
	return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][weekday]
}

export type CreateMasterParams = {
	userId: string
	clientName: string
	clientEmail: string
	practitionerName?: string | null
	practitionerEmail?: string | null
	// Local wall time in the series timezone for the first occurrence
	dtstartLocal: string // 'YYYY-MM-DDTHH:mm:ss'
	timezone: string // e.g. 'Europe/Madrid'
	durationMin: number
	intervalWeeks: 1 | 2
	byWeekday: 0 | 1 | 2 | 3 | 4 | 5 | 6
	mode?: 'online' | 'in_person' | null
	locationText?: string | null
	supabaseClient?: SupabaseClient
}

export async function createMasterRecurringEvent(params: CreateMasterParams): Promise<{ googleEventId: string }> {
	////////////////////////////////////////////////////////////////
	// Step 0: Get authenticated Google Calendar client
	////////////////////////////////////////////////////////////////
	const calendar = await getAuthenticatedCalendar(params.userId, params.supabaseClient)

	////////////////////////////////////////////////////////////////
	// Step 1: Compute event end time and recurrence rule
	////////////////////////////////////////////////////////////////
	const endLocal = computeLocalEnd(params.dtstartLocal, params.durationMin)
	const byDay = weekdayToByDay(params.byWeekday)
	const rrule = `RRULE:FREQ=WEEKLY;INTERVAL=${params.intervalWeeks};BYDAY=${byDay}`

	////////////////////////////////////////////////////////////////
	// Step 2: Build event summary and attendees
	////////////////////////////////////////////////////////////////
	const summary =
		params.mode === 'in_person'
			? `${params.clientName} - ${params.practitionerName || 'Consulta'}`
			: `${params.clientName} - ${params.practitionerName || 'Consulta (Online)'}`

	const attendees = [{ email: params.clientEmail }]

	////////////////////////////////////////////////////////////////
	// Step 3: Build base event request body
	////////////////////////////////////////////////////////////////
	const requestBody: any = {
		summary,
		description: '',
		start: {
			dateTime: withSeconds(params.dtstartLocal),
			timeZone: params.timezone
		},
		end: {
			dateTime: withSeconds(endLocal),
			timeZone: params.timezone
		},
		recurrence: [rrule],
		attendees,
		// For in-person, set location; for online, we'll add Meet conference
		location: params.mode === 'in_person' ? params.locationText || undefined : undefined
	}

	////////////////////////////////////////////////////////////////
	// Step 4: Configure creation options
	////////////////////////////////////////////////////////////////
	const createOpts: any = {
		calendarId: 'primary',
		requestBody,
		sendUpdates: 'all' // Send email invitations to all attendees
	}

	////////////////////////////////////////////////////////////////
	// Step 5: Add Google Meet conference for online appointments
	////////////////////////////////////////////////////////////////
	if (params.mode !== 'in_person') {
		requestBody.conferenceData = {
			createRequest: {
				requestId: `series-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
			}
		}
		createOpts.conferenceDataVersion = 1
	}

	////////////////////////////////////////////////////////////////
	// Step 6: Create the recurring event in Google Calendar
	////////////////////////////////////////////////////////////////
	const res = await calendar.events.insert(createOpts)
	const id = res.data.id
	if (!id) throw new Error('Failed to create master recurring event')
	return { googleEventId: id }
}

export async function deleteMasterRecurringEvent(
	userId: string,
	googleEventId: string,
	supabaseClient?: SupabaseClient
) {
	////////////////////////////////////////////////////////////////
	// Step 0: Get authenticated Google Calendar client
	////////////////////////////////////////////////////////////////
	const calendar = await getAuthenticatedCalendar(userId, supabaseClient)

	////////////////////////////////////////////////////////////////
	// Step 1: Delete the master recurring event
	////////////////////////////////////////////////////////////////
	await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId })
}

/**
 * V2: Deletes a specific occurrence instance from a recurring event.
 * This is needed when rescheduling on the same day - we need to delete
 * the original occurrence before creating the standalone event.
 *
 * Strategy:
 * 1. Query Google Calendar's instances API to find the actual instance for the date/time
 * 2. If found, delete it using the real instance ID
 * 3. If not found, the instance hasn't been materialized yet - EXDATE should handle it
 */
export async function deleteOccurrenceInstance(params: {
	userId: string
	masterEventId: string
	occurrenceStartTimeUtc: string // ISO UTC string
	timezone: string // Event timezone (e.g., 'Europe/Madrid')
	supabaseClient?: SupabaseClient
}): Promise<{ success: boolean; error?: string }> {
	try {
		////////////////////////////////////////////////////////////////
		// Step 0: Get authenticated Google Calendar client
		////////////////////////////////////////////////////////////////
		const calendar = await getAuthenticatedCalendar(params.userId, params.supabaseClient)

		////////////////////////////////////////////////////////////////
		// Step 1: Create a time window around the occurrence for querying
		////////////////////////////////////////////////////////////////
		const startDateUtc = new Date(params.occurrenceStartTimeUtc)

		// Create a ±2 hour window around the occurrence to find it
		const windowStart = new Date(startDateUtc.getTime() - 2 * 60 * 60 * 1000) // 2 hours before
		const windowEnd = new Date(startDateUtc.getTime() + 2 * 60 * 60 * 1000) // 2 hours after

		////////////////////////////////////////////////////////////////
		// Step 2: Query instances API to find the actual instance
		////////////////////////////////////////////////////////////////
		const instancesResponse = await calendar.events.instances({
			calendarId: 'primary',
			eventId: params.masterEventId,
			timeMin: windowStart.toISOString(),
			timeMax: windowEnd.toISOString(),
			maxResults: 10
		})

		const instances = instancesResponse.data.items || []

		////////////////////////////////////////////////////////////////
		// Step 3: Find the instance that matches our occurrence time
		////////////////////////////////////////////////////////////////
		// Match by comparing start times (within 1 minute tolerance for rounding)
		const targetInstance = instances.find((instance) => {
			if (!instance.start?.dateTime) return false
			const instanceStart = new Date(instance.start.dateTime)
			const timeDiff = Math.abs(instanceStart.getTime() - startDateUtc.getTime())
			return timeDiff < 60000 // Within 1 minute
		})

		if (!targetInstance || !targetInstance.id) {
			////////////////////////////////////////////////////////////////
			// Instance not found - it hasn't been materialized yet
			// EXDATE should prevent it from appearing, but log a warning
			////////////////////////////////////////////////////////////////
			console.warn(
				`[master-recurring] Occurrence instance not found for ${params.occurrenceStartTimeUtc}. ` +
					`Instance may not be materialized yet. EXDATE should prevent it from appearing.`
			)
			return { success: true } // Not an error - EXDATE will handle it
		}

		////////////////////////////////////////////////////////////////
		// Step 4: Delete the found instance using its actual ID
		////////////////////////////////////////////////////////////////
		await calendar.events.delete({
			calendarId: 'primary',
			eventId: targetInstance.id,
			sendUpdates: 'all' // Notify attendees
		})

		console.log(
			`[master-recurring] Successfully deleted occurrence instance ${targetInstance.id} for ${params.occurrenceStartTimeUtc}`
		)

		return { success: true }
	} catch (error: any) {
		console.error('[master-recurring] Failed to delete occurrence instance', error)
		return { success: false, error: error.message || 'Unknown error' }
	}
}

/**
 * V2: Updates the master recurring event to add/remove EXDATE entries.
 * This excludes specific occurrences from the recurring series (for cancellations).
 */
export async function updateMasterRecurringEventWithExdates(params: {
	userId: string
	googleEventId: string
	excludedDates: string[] // ISO date strings (YYYY-MM-DD)
	timezone: string
	supabaseClient?: SupabaseClient
}): Promise<{ success: boolean; error?: string }> {
	try {
		////////////////////////////////////////////////////////////////
		// Step 0: Get authenticated Google Calendar client
		////////////////////////////////////////////////////////////////
		const calendar = await getAuthenticatedCalendar(params.userId, params.supabaseClient)

		////////////////////////////////////////////////////////////////
		// Step 1: Fetch current event to preserve existing data
		////////////////////////////////////////////////////////////////
		const currentEvent = await calendar.events.get({
			calendarId: 'primary',
			eventId: params.googleEventId
		})

		if (!currentEvent.data) {
			return { success: false, error: 'Event not found' }
		}

		////////////////////////////////////////////////////////////////
		// Step 2: Parse existing recurrence rules and extract RRULE
		////////////////////////////////////////////////////////////////
		const existingRecurrence = currentEvent.data.recurrence || []
		const rrule = existingRecurrence.find((r: string) => r.startsWith('RRULE:'))
		if (!rrule) {
			return { success: false, error: 'No RRULE found in master event' }
		}

		////////////////////////////////////////////////////////////////
		// Step 3: Build new recurrence array: RRULE + EXDATE
		////////////////////////////////////////////////////////////////
		const newRecurrence: string[] = [rrule]
		if (params.excludedDates.length > 0) {
			const exdateRule = formatExdateRule(params.excludedDates, params.timezone)
			if (exdateRule) {
				newRecurrence.push(exdateRule)
			}
		}

		////////////////////////////////////////////////////////////////
		// Step 4: Update event with new recurrence (preserves all other fields)
		////////////////////////////////////////////////////////////////
		await calendar.events.patch({
			calendarId: 'primary',
			eventId: params.googleEventId,
			requestBody: {
				recurrence: newRecurrence
			}
		})

		return { success: true }
	} catch (error: any) {
		console.error('[master-recurring] Failed to update with EXDATE', error)
		return { success: false, error: error.message || 'Unknown error' }
	}
}

/**
 * V2: Creates a standalone single Google Calendar event for a rescheduled occurrence.
 * This is used when a single occurrence is moved to a different time.
 */
export async function createStandaloneOccurrenceEvent(params: {
	userId: string
	seriesId: string
	occurrenceIndex: number
	clientName: string
	clientEmail: string
	practitionerName?: string | null
	newStartTime: string // ISO UTC
	newEndTime: string // ISO UTC
	timezone: string
	mode?: 'online' | 'in_person'
	locationText?: string | null
	supabaseClient?: SupabaseClient
}): Promise<{ googleEventId: string }> {
	////////////////////////////////////////////////////////////////
	// Step 0: Get authenticated Google Calendar client
	////////////////////////////////////////////////////////////////
	const calendar = await getAuthenticatedCalendar(params.userId, params.supabaseClient)

	////////////////////////////////////////////////////////////////
	// Step 1: Build event summary based on mode
	////////////////////////////////////////////////////////////////
	const summary =
		params.mode === 'in_person'
			? `${params.clientName} - ${params.practitionerName || 'Consulta'}`
			: `${params.clientName} - ${params.practitionerName || 'Consulta (Online)'}`

	////////////////////////////////////////////////////////////////
	// Step 2: Prepare attendees list
	////////////////////////////////////////////////////////////////
	const attendees = [{ email: params.clientEmail }]

	////////////////////////////////////////////////////////////////
	// Step 3: Convert UTC times to Date objects for formatting
	////////////////////////////////////////////////////////////////
	const startDate = new Date(params.newStartTime)
	const endDate = new Date(params.newEndTime)

	////////////////////////////////////////////////////////////////
	// Step 4: Build base event request body
	////////////////////////////////////////////////////////////////
	const requestBody: any = {
		summary,
		description: `Rescheduled occurrence from recurring series`,
		start: {
			dateTime: startDate.toISOString(),
			timeZone: params.timezone
		},
		end: {
			dateTime: endDate.toISOString(),
			timeZone: params.timezone
		},
		attendees,
		location: params.mode === 'in_person' ? params.locationText || undefined : undefined,
		// Link to series via extended properties for tracking
		extendedProperties: {
			private: {
				seriesId: params.seriesId,
				occurrenceIndex: String(params.occurrenceIndex)
			}
		}
	}

	////////////////////////////////////////////////////////////////
	// Step 5: Configure creation options
	////////////////////////////////////////////////////////////////
	const createOpts: any = {
		calendarId: 'primary',
		requestBody,
		sendUpdates: 'all' // Send email invitations to all attendees
	}

	////////////////////////////////////////////////////////////////
	// Step 6: Add Google Meet conference for online appointments
	////////////////////////////////////////////////////////////////
	if (params.mode !== 'in_person') {
		requestBody.conferenceData = {
			createRequest: {
				requestId: `standalone-${params.seriesId}-${params.occurrenceIndex}-${Date.now()}`
			}
		}
		createOpts.conferenceDataVersion = 1
	}

	////////////////////////////////////////////////////////////////
	// Step 7: Create the standalone event in Google Calendar
	////////////////////////////////////////////////////////////////
	const res = await calendar.events.insert(createOpts)
	const id = res.data.id
	if (!id) throw new Error('Failed to create standalone occurrence event')
	return { googleEventId: id }
}

function computeLocalEnd(dtstartLocal: string, durationMin: number): string {
	const d = new Date(dtstartLocal.replace('T', ' ') + 'Z') // temp base; we only add minutes on the wall time
	const endMs = d.getTime() + durationMin * 60 * 1000
	const end = new Date(endMs)
	return toLocalIso(end)
}

function toLocalIso(d: Date): string {
	// Return 'YYYY-MM-DDTHH:mm:ss' without timezone
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(
		d.getUTCMinutes()
	)}:${pad(d.getUTCSeconds())}`
}

function withSeconds(s: string): string {
	// Ensure the local ISO contains seconds
	return s.length === 16 ? `${s}:00` : s
}
