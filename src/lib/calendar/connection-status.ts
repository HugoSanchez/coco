/** Only confirmed credential failures should prompt the user to reconnect. */
export class CalendarDisconnectedError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'CalendarDisconnectedError'
	}
}

/** null means the connection could not be checked, rather than disconnected. */
export async function fetchCalendarConnectionStatus(fetcher: typeof fetch = fetch): Promise<boolean | null> {
	try {
		const response = await fetcher('/api/calendar/status', { cache: 'no-store' })
		if (!response.ok) return null
		const data = await response.json()
		return typeof data?.connected === 'boolean' ? data.connected : null
	} catch {
		return null
	}
}
