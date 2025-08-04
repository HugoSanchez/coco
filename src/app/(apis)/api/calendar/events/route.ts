import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleCalendarEventsForDay } from '@/lib/calendar/calendar'
import { getBookingsForDateRange } from '@/lib/db/bookings'
import { getSystemGoogleEventIds } from '@/lib/db/calendar-events'

// Force dynamic rendering since this route uses cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/events
 *
 * Fetches calendar events for a date range, combining:
 * - System bookings from our database
 * - External Google Calendar events (filtered to avoid duplicates)
 *
 * Query params: start, end (ISO date strings)
 * Returns: { events: Array<event> }
 */
export async function GET(request: NextRequest) {
	try {
		const supabase = createClient()

		// Check authentication
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()
		if (authError || !user) {
			return NextResponse.json(
				{ error: 'Authentication required' },
				{ status: 401 }
			)
		}

		// Parse query parameters
		const { searchParams } = new URL(request.url)
		const startParam = searchParams.get('start')
		const endParam = searchParams.get('end')

		if (!startParam || !endParam) {
			return NextResponse.json(
				{ error: 'Both start and end parameters required' },
				{ status: 400 }
			)
		}

		const startDate = new Date(startParam)
		const endDate = new Date(endParam)

		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
			return NextResponse.json(
				{ error: 'Invalid date format' },
				{ status: 400 }
			)
		}

		// Fetch system bookings first (this should always work)
		const systemBookings = await getBookingsForDateRange(
			user.id,
			startParam,
			endParam,
			supabase
		)

		// Try to fetch Google Calendar events and system event IDs, but don't fail if they error
		let googleEvents: any[] = []
		let systemEventIds: string[] = []

		try {
			systemEventIds = await getSystemGoogleEventIds(user.id, supabase)
		} catch (error) {
			console.log('Could not fetch system Google event IDs:', error)
		}

		try {
			console.log(
				'🗓️ [API] Attempting to fetch Google Calendar events for user:',
				user.id,
				'date:',
				startDate.toISOString()
			)
			googleEvents = await getGoogleCalendarEventsForDay(
				user.id,
				startDate,
				supabase
			)
			console.log(
				'✅ [API] Successfully fetched',
				googleEvents.length,
				'Google Calendar events for user:',
				user.id
			)
		} catch (error) {
			console.error(
				'❌ [API] Could not fetch Google Calendar events for user:',
				user.id,
				'Error:',
				error
			)
		}

		// Format system bookings
		const formattedSystemBookings = systemBookings.map((booking: any) => ({
			start: booking.start_time,
			end: booking.end_time,
			title: booking.client?.name || 'Cliente',
			type: 'system',
			status: booking.status,
			bookingId: booking.id
		}))

		// Filter out Google events that are actually our system bookings
		const systemEventIdSet = new Set(systemEventIds)
		const filteredGoogleEvents = googleEvents.filter(
			(event: any) => !systemEventIdSet.has(event.googleEventId)
		)

		// Format external events
		const formattedExternalEvents = filteredGoogleEvents.map(
			(event: any) => ({
				start: event.start,
				end: event.end,
				title: 'Busy',
				type: 'external'
			})
		)

		// Combine and sort by start time
		const allEvents = [
			...formattedSystemBookings,
			...formattedExternalEvents
		]
		allEvents.sort(
			(a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
		)

		console.log(
			'📊 [API] Final response for user:',
			user.id,
			'System bookings:',
			formattedSystemBookings.length,
			'External events:',
			formattedExternalEvents.length,
			'Total events:',
			allEvents.length
		)

		return NextResponse.json({ events: allEvents })
	} catch (error: any) {
		console.error('Calendar events API error:', error)
		return NextResponse.json(
			{ events: [], error: 'Failed to fetch calendar events' },
			{ status: 500 }
		)
	}
}
