/**
 * Master Recurring Calendar Events (Google)
 *
 * V1 SCOPE
 * - Create a single master recurring event with RRULE (weekly / bi-weekly)
 * - Delete the master event on cancel
 * - App is source of truth; no per-occurrence overrides here
 */

import { getAuthenticatedCalendar } from '@/lib/google'
import type { SupabaseClient } from '@supabase/supabase-js'

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
	const calendar = await getAuthenticatedCalendar(params.userId, params.supabaseClient)

	const endLocal = computeLocalEnd(params.dtstartLocal, params.durationMin)
	const byDay = weekdayToByDay(params.byWeekday)
	const rrule = `RRULE:FREQ=WEEKLY;INTERVAL=${params.intervalWeeks};BYDAY=${byDay}`
	const summary =
		params.mode === 'in_person'
			? `${params.clientName} - ${params.practitionerName || 'Consulta'}`
			: `${params.clientName} - ${params.practitionerName || 'Consulta (Online)'}`

	const attendees = [{ email: params.clientEmail }]

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

	const createOpts: any = {
		calendarId: 'primary',
		requestBody,
		sendUpdates: 'all' // Send email invitations to all attendees
	}

	// Include Meet only for online
	if (params.mode !== 'in_person') {
		requestBody.conferenceData = {
			createRequest: {
				requestId: `series-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
			}
		}
		createOpts.conferenceDataVersion = 1
	}

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
	const calendar = await getAuthenticatedCalendar(userId, supabaseClient)
	await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId })
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
