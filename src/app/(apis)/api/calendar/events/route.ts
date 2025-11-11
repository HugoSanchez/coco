import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleCalendarEventsForRange } from '@/lib/calendar/calendar'
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
			return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
		}

		// Parse query parameters
		const { searchParams } = new URL(request.url)
		const startParam = searchParams.get('start')
		const endParam = searchParams.get('end')

		if (!startParam || !endParam) {
			return NextResponse.json({ error: 'Both start and end parameters required' }, { status: 400 })
		}

		const startDate = new Date(startParam)
		const endDate = new Date(endParam)

		// Parsed dates validated below; remove verbose logging

		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
			return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
		}

		// Fetch system bookings with bill data for payment status
		const { data: bookingsData, error: bookingsError } = await supabase
			.from('bookings')
			.select(
				`
				*,
				client:clients(id, name, last_name, email),
				bill:bills(id, status)
			`
			)
			.eq('user_id', user.id)
			.gte('start_time', startParam)
			.lte('start_time', endParam)
			.neq('status', 'canceled')
			.order('start_time', { ascending: true })

		if (bookingsError) {
			throw bookingsError
		}

		const systemBookings = bookingsData || []

		// Try to fetch Google Calendar events and system event IDs, but don't fail if they error
		let googleEvents: any[] = []
		let systemEventIds: string[] = []

		try {
			systemEventIds = await getSystemGoogleEventIds(user.id, supabase)
		} catch (error) {
			// Non-fatal: proceed without system IDs if lookup fails
		}

		try {
			googleEvents = await getGoogleCalendarEventsForRange(user.id, startDate, endDate, supabase)
		} catch (error) {
			// Non-fatal: external calendar may be disconnected
		}

		// Format system bookings with patient's full name, consultation type, and payment status
		const formattedSystemBookings = systemBookings.map((booking: any) => {
			const fullName = [booking.client?.name, booking.client?.last_name].filter(Boolean).join(' ').trim()
			const bill = Array.isArray(booking.bill) ? booking.bill[0] : booking.bill

			// Derive billing and payment statuses from bill status (similar to getBookingsWithBills logic)
			let billing_status: 'not_generated' | 'pending' | 'sent' | 'canceled' = 'not_generated'
			let payment_status: 'not_applicable' | 'pending' | 'paid' | 'disputed' | 'canceled' | 'refunded' =
				'not_applicable'

			if (bill) {
				switch (bill.status) {
					case 'scheduled':
						billing_status = 'pending'
						payment_status = 'not_applicable'
						break
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
				start: booking.start_time,
				end: booking.end_time,
				title: fullName || 'Cliente',
				type: 'system',
				status: booking.status,
				bookingId: booking.id,
				consultation_type: booking.consultation_type || null,
				payment_status,
				billing_status
			}
		})

		// Filter out Google events that are actually our system bookings
		const systemEventIdSet = new Set(systemEventIds)
		const filteredGoogleEvents = googleEvents.filter((event: any) => !systemEventIdSet.has(event.googleEventId))

		// Format external events
		const formattedExternalEvents = filteredGoogleEvents.map((event: any) => ({
			start: event.start,
			end: event.end,
			title: 'Busy',
			type: 'external'
		}))

		// Filter out external events that overlap with bookings
		// This ensures bookings always take precedence over calendar events
		const eventsWithoutConflicts = formattedExternalEvents.filter((externalEvent) => {
			const eventStart = new Date(externalEvent.start)
			const eventEnd = new Date(externalEvent.end)

			// Check if this external event overlaps with any booking
			const overlapsWithBooking = formattedSystemBookings.some((booking) => {
				const bookingStart = new Date(booking.start)
				const bookingEnd = new Date(booking.end)

				// Check for overlap: events overlap if one starts before the other ends
				return eventStart < bookingEnd && eventEnd > bookingStart
			})

			// Keep the event only if it doesn't overlap with any booking
			return !overlapsWithBooking
		})

		// Combine and sort by start time
		const allEvents = [...formattedSystemBookings, ...eventsWithoutConflicts]
		allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

		// Return combined busy view (system + external)

		return NextResponse.json({ events: allEvents })
	} catch (error: any) {
		console.error('Calendar events API error:', error)
		return NextResponse.json({ events: [], error: 'Failed to fetch calendar events' }, { status: 500 })
	}
}
