import type { calendar_v3 } from 'googleapis'

/** Read personal and selected-calendar events, including every page of results. */
export async function listAvailabilityEvents(
	calendar: calendar_v3.Calendar,
	selectedCalendarId: string,
	timeMin: string,
	timeMax: string
): Promise<calendar_v3.Schema$Event[]> {
	const calendarIds = selectedCalendarId === 'primary' ? ['primary'] : ['primary', selectedCalendarId]
	const results = await Promise.all(
		calendarIds.map(async (calendarId) => {
			const events: calendar_v3.Schema$Event[] = []
			let pageToken: string | undefined
			do {
				const { data } = await calendar.events.list({
					calendarId,
					timeMin,
					timeMax,
					singleEvents: true,
					orderBy: 'startTime',
					pageToken
				})
				events.push(...(data.items || []))
				pageToken = data.nextPageToken || undefined
			} while (pageToken)
			return events
		})
	)

	// An invitation can expose the same event in both calendars. Prefer the selected copy.
	const eventsById = new Map<string, calendar_v3.Schema$Event>()
	for (const event of results.flat()) {
		if (event.id) eventsById.set(event.id, event)
	}
	return Array.from(eventsById.values())
}
