/**
 * Google Calendar Integration Service
 *
 * This module provides comprehensive Google Calendar integration for booking appointments
 * with a two-phase calendar event system:
 *
 * PHASE 1 - PENDING EVENTS (during payment processing):
 * - Creates placeholder events to prevent double-booking
 * - Light green color, no client invitations, no Google Meet
 * - Title format: "[Client Name] - Pending"
 *
 * PHASE 2 - CONFIRMED EVENTS (after successful payment):
 * - Converts pending events to full appointments
 * - Dark green color, client invitations, Google Meet links
 * - Title format: "[Client Name] - [Practitioner Name]"
 *
 * FEATURES:
 * - Automatic Google Calendar OAuth token refresh
 * - Google Meet conference room generation
 * - Email invitations and reminders
 * - Professional appointment formatting
 * - Availability slot calculation
 * - Two-way calendar synchronization
 *
 * USAGE PATTERNS:
 * 1. Booking creation → createPendingCalendarEvent()
 * 2. Payment success → updatePendingToConfirmed()
 * 3. Direct booking → createCalendarEventWithInvite() (skip pending)
 */

import { google } from 'googleapis'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { getUserEmail } from '../db/profiles'
import { getAuthenticatedCalendar } from '../google'
import {
	buildFullEventData,
	buildPendingEventData,
	buildConfirmedEventData,
	generateConferenceRequestId
} from './calendar-event-builders'
import {
	parseISO,
	isWithinInterval,
	setHours,
	setMinutes,
	addMinutes,
	parse,
	isBefore,
	isAfter,
	areIntervalsOverlapping,
	startOfMonth,
	endOfMonth,
	eachDayOfInterval,
	format,
	addHours,
	addDays
} from 'date-fns'

export interface TimeSlot {
	start: string
	end: string
}

interface DayAvailability {
	timeSlots: TimeSlot[]
	isAvailable: boolean
}

interface AvailabilitySettings {
	weekly_availability: DayAvailability[]
	time_zone: string
	meeting_duration: number
	meeting_price: number
	currency: string
}

const supabase = createSupabaseClient()

function calculateAvailableSlots(
	availabilitySettings: AvailabilitySettings,
	calendarEvents: any[],
	date: Date,
	calendarTimeZone: string
): { [day: string]: TimeSlot[] } {
	const availableSlots: { [day: string]: TimeSlot[] } = {}
	const { weekly_availability, meeting_duration, time_zone } =
		availabilitySettings

	const monthStart = startOfMonth(date)
	const monthEnd = endOfMonth(date)
	const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

	daysInMonth.forEach((day) => {
		const dayOfWeek = day.getDay()
		const dayAvailability = weekly_availability[dayOfWeek]

		if (dayAvailability.isAvailable) {
			const dayKey = format(day, 'yyyy-MM-dd')
			availableSlots[dayKey] = []

			for (const slot of dayAvailability.timeSlots) {
				const [startHour, startMinute] = slot.start
					.split(':')
					.map(Number)
				const [endHour, endMinute] = slot.end.split(':').map(Number)

				let slotStart = fromZonedTime(
					setMinutes(setHours(day, startHour), startMinute),
					time_zone
				)
				const slotEnd = fromZonedTime(
					setMinutes(setHours(day, endHour), endMinute),
					time_zone
				)

				while (isBefore(slotStart, slotEnd)) {
					const potentialEndTime = addMinutes(
						slotStart,
						meeting_duration
					)

					if (isAfter(potentialEndTime, slotEnd)) {
						break
					}

					const isOverlapping = calendarEvents.some((event) => {
						let eventStartUTC: Date, eventEndUTC: Date

						if (event.start.dateTime) {
							eventStartUTC = parseISO(event.start.dateTime)
							eventEndUTC = event.end.dateTime
								? parseISO(event.end.dateTime)
								: addHours(eventStartUTC, 1)
						} else if (event.start.date) {
							eventStartUTC = parseISO(event.start.date)
							eventEndUTC = event.end.date
								? parseISO(event.end.date)
								: addDays(eventStartUTC, 1)
						} else {
							return false
						}

						return (
							isWithinInterval(slotStart, {
								start: eventStartUTC,
								end: eventEndUTC
							}) ||
							isWithinInterval(potentialEndTime, {
								start: eventStartUTC,
								end: eventEndUTC
							}) ||
							(isBefore(slotStart, eventStartUTC) &&
								isAfter(potentialEndTime, eventEndUTC))
						)
					})

					if (!isOverlapping) {
						availableSlots[dayKey].push({
							start: slotStart.toISOString(),
							end: potentialEndTime.toISOString()
						})
					}

					slotStart = potentialEndTime
				}
			}
		}
	})

	return availableSlots
}

export async function getAvailableSlots(username: string, month: Date) {
	// Fetch user's ID from the username
	const { data: userData, error: userError } = await supabase
		.from('profiles')
		.select('*')
		.eq('username', username.toLowerCase())
		.single()

	if (userError || !userData) {
		throw new Error('User not found')
	}

	const userId = userData.id

	// Fetch user's availability settings
	const { data: availabilitySettings, error: settingsError } = await supabase
		.from('schedules')
		.select('*')
		.eq('user_id', userId)
		.single()

	if (settingsError) {
		throw new Error('Availability settings not found')
	}

	try {
		// Get authenticated calendar client using the new helper
		const calendar = await getAuthenticatedCalendar(userId)
		// Now proceed with the calendar events fetch
		const monthStart = startOfMonth(month)
		const monthEnd = endOfMonth(month)
		const { data: events } = await calendar.events.list({
			calendarId: 'primary',
			timeMin: monthStart.toISOString(),
			timeMax: monthEnd.toISOString(),
			singleEvents: true,
			orderBy: 'startTime'
		})

		// Calculate available slots for the entire month
		const availableSlots = calculateAvailableSlots(
			availabilitySettings,
			events.items || [],
			month,
			events.timeZone || 'UTC'
		)
		// Return the available slots
		return availableSlots
		// If there is an error, throw an error
	} catch (error: any) {
		console.error('Calendar access error:', error)
		throw new Error(
			'Calendar access failed. Please reconnect your Google Calendar.'
		)
	}
}

/**
 * Interface for creating a full calendar event with booking details
 * Used for confirmed appointments with client invitations
 */
export interface CreateCalendarEventPayload {
	userId: string // Practitioner's auth user ID
	clientName: string
	clientEmail: string
	practitionerName: string
	practitionerEmail: string
	startTime: string // ISO string
	endTime: string // ISO string
	bookingNotes?: string
}

/**
 * Interface for creating a pending calendar event (placeholder)
 * Used for temporary calendar blocking before payment confirmation
 */
export interface CreatePendingCalendarEventPayload {
	userId: string // Practitioner's auth user ID
	clientName: string
	practitionerEmail: string // Practitioner's email for calendar attendee
	startTime: string // ISO string
	endTime: string // ISO string
}

/**
 * Interface for updating a pending event to confirmed status
 * Used to convert placeholder events to full appointments after payment
 */
export interface UpdatePendingToConfirmedPayload {
	googleEventId: string // Existing Google Calendar event ID
	userId: string // Practitioner's auth user ID
	clientEmail: string
	practitionerName: string
	practitionerEmail: string
}

/**
 * Result of calendar event creation
 */
export interface CalendarEventResult {
	success: boolean
	googleEventId?: string
	googleMeetLink?: string
	error?: string
}

/**
 * Creates a Google Calendar event with client invite and Google Meet link
 * This function handles the complete flow of creating an event in the practitioner's calendar
 * and automatically sending an invitation to the client.
 *
 * @param payload - Event creation data including user, client, and booking details
 * @returns Promise<CalendarEventResult> - Result containing event ID and Meet link or error
 */
export async function createCalendarEventWithInvite(
	payload: CreateCalendarEventPayload,
	supabaseClient?: SupabaseClient
): Promise<CalendarEventResult> {
	const {
		userId,
		clientName,
		clientEmail,
		practitionerName,
		practitionerEmail,
		startTime,
		endTime,
		bookingNotes
	} = payload

	try {
		// Get authenticated calendar client using the new helper
		const calendar = await getAuthenticatedCalendar(userId, supabaseClient)

		// Generate unique conference request ID
		const conferenceRequestId = generateConferenceRequestId('booking')

		// Create the event object using the builder
		const eventData = buildFullEventData({
			clientName,
			clientEmail,
			practitionerName,
			practitionerEmail,
			startTime,
			endTime,
			bookingNotes,
			conferenceRequestId
		})

		// Create the event
		const response = await calendar.events.insert({
			calendarId: 'primary',
			requestBody: eventData,
			conferenceDataVersion: 1, // Required for conference creation
			sendUpdates: 'all' // Send invitations to all attendees
		})

		const createdEvent = response.data

		if (!createdEvent.id) {
			throw new Error(
				'Failed to create calendar event: No event ID returned'
			)
		}

		return {
			success: true,
			googleEventId: createdEvent.id
		}
	} catch (error: any) {
		console.error('Calendar event creation error:', {
			message: error.message,
			code: error.code,
			status: error.status,
			userId
		})

		return {
			success: false,
			error: `Failed to create calendar event: ${error.message}`
		}
	}
}

/**
 * Creates a pending (placeholder) Google Calendar event for booking reservation
 *
 * This function creates a temporary calendar event that reserves the time slot
 * while payment is being processed. The event serves as a visual indicator
 * to prevent double-booking and shows pending status to the practitioner.
 *
 * Event characteristics:
 * - Light green color (Google Calendar Color ID 2)
 * - Only practitioner as attendee (no client invitation)
 * - No Google Meet link
 * - Title format: "[Client Name] - Pending"
 * - No email notifications sent
 *
 * @param payload - Pending event creation data
 * @param supabaseClient - Optional SupabaseClient for backend operations
 * @returns Promise<CalendarEventResult> - Result with Google event ID or error
 */
export async function createPendingCalendarEvent(
	payload: CreatePendingCalendarEventPayload,
	supabaseClient?: SupabaseClient
): Promise<CalendarEventResult> {
	const { userId, clientName, practitionerEmail, startTime, endTime } =
		payload

	try {
		// Get authenticated calendar client using the new helper
		const calendar = await getAuthenticatedCalendar(userId, supabaseClient)

		// Create the pending event object using the builder
		const eventData = buildPendingEventData({
			clientName,
			practitionerEmail,
			startTime,
			endTime
		})

		console.log(
			'🗓️ [Calendar API] Attempting to create pending event in Google Calendar for user:',
			userId
		)

		// Create the pending event in Google Calendar
		const response = await calendar.events.insert({
			calendarId: 'primary',
			requestBody: eventData,
			sendUpdates: 'none' // Don't send any notifications for pending events
		})

		const createdEvent = response.data
		console.log(
			'✅ [Calendar API] Google Calendar event created successfully for user:',
			userId,
			'Event ID:',
			createdEvent.id
		)

		if (!createdEvent.id) {
			console.error(
				'❌ [Calendar API] Google returned event without ID for user:',
				userId
			)
			throw new Error(
				'Failed to create pending calendar event: No event ID returned'
			)
		}

		return {
			success: true,
			googleEventId: createdEvent.id,
			googleMeetLink: undefined // No meet link for pending events
		}
	} catch (error: any) {
		console.error(
			'❌ [Calendar API] Pending calendar event creation error for user:',
			userId,
			{
				message: error.message,
				code: error.code,
				status: error.status,
				userId
			}
		)

		return {
			success: false,
			error: `Failed to create pending calendar event: ${error.message}`
		}
	}
}

/**
 * Updates a pending calendar event to confirmed status after successful payment
 *
 * This function takes an existing placeholder event and transforms it into
 * a full appointment with client invitation, Google Meet link, and updated
 * visual styling. This provides a seamless transition from pending to confirmed.
 *
 * Updates applied:
 * - Title: Remove "- Pending", add practitioner name
 * - Color: Change to dark green (Google Calendar Color ID 10)
 * - Attendees: Add client email with invitation
 * - Conference: Add Google Meet link
 * - Notifications: Send invitation emails to client
 *
 * @param payload - Event update data including Google event ID and attendee info
 * @param supabaseClient - Optional SupabaseClient for backend operations
 * @returns Promise<CalendarEventResult> - Result with updated event details or error
 */
export async function updatePendingToConfirmed(
	payload: UpdatePendingToConfirmedPayload,
	supabaseClient?: SupabaseClient
): Promise<CalendarEventResult> {
	const {
		googleEventId,
		userId,
		clientEmail,
		practitionerName,
		practitionerEmail
	} = payload

	try {
		// Get authenticated calendar client using the new helper
		const calendar = await getAuthenticatedCalendar(userId, supabaseClient)

		// First, get the current event to extract client name from title
		const currentEvent = await calendar.events.get({
			calendarId: 'primary',
			eventId: googleEventId
		})

		// Extract client name by removing " - Pending" from the current title
		const currentTitle = currentEvent.data.summary || ''
		const clientName = currentTitle.replace(' - Pending', '')

		// Preserve the original start and end times from the existing event
		const originalStart = currentEvent.data.start
		const originalEnd = currentEvent.data.end

		if (!originalStart || !originalEnd) {
			throw new Error('Original event missing start or end time')
		}

		// Generate unique conference request ID for Google Meet
		const conferenceRequestId = generateConferenceRequestId('confirmed')

		// Prepare the updated event data using the builder
		const updatedEventData = buildConfirmedEventData({
			clientName,
			clientEmail,
			practitionerName,
			practitionerEmail,
			originalStart,
			originalEnd,
			conferenceRequestId
		})

		// Update the existing event in Google Calendar
		const response = await calendar.events.update({
			calendarId: 'primary',
			eventId: googleEventId,
			requestBody: updatedEventData,
			conferenceDataVersion: 1, // Required for Google Meet creation
			sendUpdates: 'all' // Send invitations to all attendees
		})

		const updatedEvent = response.data

		// Extract Google Meet link from the updated event
		const googleMeetLink =
			updatedEvent.conferenceData?.entryPoints?.find(
				(entry) => entry.entryPointType === 'video'
			)?.uri || undefined

		return {
			success: true,
			googleEventId: updatedEvent.id!,
			googleMeetLink
		}
	} catch (error: any) {
		console.error('Calendar event update error:', {
			message: error.message,
			code: error.code,
			status: error.status,
			googleEventId,
			userId
		})

		return {
			success: false,
			error: `Failed to update calendar event: ${error.message}`
		}
	}
}

/**
 * Deletes a Google Calendar event completely
 * Used for pending bookings where the event is just a placeholder
 *
 * This function completely removes the event from Google Calendar,
 * as if it never existed. Best used for pending bookings that were
 * never confirmed or paid for.
 *
 * @param googleEventId - Google Calendar event ID to delete
 * @param userId - Practitioner's user ID for authentication
 * @param supabaseClient - Optional SupabaseClient for backend operations
 * @returns Promise<CalendarEventResult> - Result with success status or error
 */
export async function deleteCalendarEvent(
	googleEventId: string,
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<CalendarEventResult> {
	try {
		// Get authenticated calendar client
		const calendar = await getAuthenticatedCalendar(userId, supabaseClient)

		// Delete the event from Google Calendar
		await calendar.events.delete({
			calendarId: 'primary',
			eventId: googleEventId
		})

		return {
			success: true,
			googleEventId
		}
	} catch (error: any) {
		console.error('Calendar event deletion error:', {
			message: error.message,
			code: error.code,
			status: error.status,
			googleEventId,
			userId
		})

		return {
			success: false,
			error: `Failed to delete calendar event: ${error.message}`
		}
	}
}

/**
 * Cancels a Google Calendar event with proper notifications
 * Used for confirmed bookings that need to be cancelled
 *
 * This function updates the event to show cancelled status and sends
 * cancellation notifications to attendees. The event remains in calendar
 * history for audit purposes.
 *
 * @param googleEventId - Google Calendar event ID to cancel
 * @param userId - Practitioner's user ID for authentication
 * @param supabaseClient - Optional SupabaseClient for backend operations
 * @returns Promise<CalendarEventResult> - Result with success status or error
 */
export async function cancelCalendarEvent(
	googleEventId: string,
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<CalendarEventResult> {
	try {
		// Get authenticated calendar client
		const calendar = await getAuthenticatedCalendar(userId, supabaseClient)

		// First, get the current event to preserve important details
		const currentEvent = await calendar.events.get({
			calendarId: 'primary',
			eventId: googleEventId
		})

		if (!currentEvent.data) {
			throw new Error('Event not found')
		}

		// Update the event to show cancelled status
		const cancelledEventData = {
			...currentEvent.data,
			summary: `CANCELLED - ${currentEvent.data.summary}`,
			description: `This appointment has been cancelled.\n\nOriginal description: ${currentEvent.data.description || 'No description'}`,
			status: 'cancelled', // Google Calendar cancelled status
			colorId: '8' // Gray color for cancelled events
		}

		// Update the event in Google Calendar
		const response = await calendar.events.update({
			calendarId: 'primary',
			eventId: googleEventId,
			requestBody: cancelledEventData,
			sendUpdates: 'all' // Send cancellation notifications to all attendees
		})

		return {
			success: true,
			googleEventId: response.data.id!
		}
	} catch (error: any) {
		console.error('Calendar event cancellation error:', {
			message: error.message,
			code: error.code,
			status: error.status,
			googleEventId,
			userId
		})

		return {
			success: false,
			error: `Failed to cancel calendar event: ${error.message}`
		}
	}
}

/**
 * Interface for reschedule calendar event payload
 */
export interface RescheduleCalendarEventPayload {
	googleEventId: string // Existing Google Calendar event ID
	userId: string // Practitioner's auth user ID
	newStartTime: string // New start time in ISO string format
	newEndTime: string // New end time in ISO string format
}

/**
 * Reschedules a Google Calendar event (updates start and end times)
 * Used for moving an existing booking to a different time slot
 *
 * This function updates the event's start and end times while preserving
 * all other event properties like attendees, description, and meeting links.
 * Notifications are sent to all attendees about the time change.
 *
 * @param payload - The reschedule payload containing event ID and new times
 * @param supabaseClient - Optional SupabaseClient instance to use
 * @returns Promise<CalendarEventResult> - Success status and any error messages
 */
export async function rescheduleCalendarEvent(
	payload: RescheduleCalendarEventPayload,
	supabaseClient?: SupabaseClient
): Promise<CalendarEventResult> {
	try {
		// Get authenticated calendar client
		const calendar = await getAuthenticatedCalendar(
			payload.userId,
			supabaseClient
		)

		// First, get the existing event to preserve its properties
		const existingEvent = await calendar.events.get({
			calendarId: 'primary',
			eventId: payload.googleEventId
		})

		if (!existingEvent.data) {
			return {
				success: false,
				error: 'Event not found'
			}
		}

		// Update the event with new start and end times
		const updatedEvent = await calendar.events.update({
			calendarId: 'primary',
			eventId: payload.googleEventId,
			requestBody: {
				...existingEvent.data,
				start: {
					dateTime: payload.newStartTime,
					timeZone: 'UTC'
				},
				end: {
					dateTime: payload.newEndTime,
					timeZone: 'UTC'
				}
			},
			sendUpdates: 'all' // Send notifications to all attendees about the time change
		})

		return {
			success: true,
			googleEventId: updatedEvent.data.id || payload.googleEventId
		}
	} catch (error: any) {
		console.error('Calendar event reschedule error:', {
			message: error.message,
			code: error.code,
			status: error.status,
			googleEventId: payload.googleEventId,
			userId: payload.userId
		})

		return {
			success: false,
			error: `Failed to reschedule calendar event: ${error.message}`
		}
	}
}

/**
 * Fetches Google Calendar events for a specific day
 * Returns external calendar events (meetings, appointments, etc.) to show as "busy" time
 *
 * @param userId - Practitioner's user ID
 * @param date - Date to fetch events for
 * @param supabaseClient - Optional Supabase client for backend operations
 * @returns Promise<Array> - Array of events formatted for DayViewTimeSelector
 */
/**
 * Gets the user's time zone from their schedule settings
 */
async function getUserTimeZone(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<string> {
	try {
		const client = supabaseClient || supabase
		const { data, error } = await client
			.from('schedules')
			.select('time_zone')
			.eq('user_id', userId)
			.single()

		if (error || !data?.time_zone) {
			console.log(
				'🗓️ [Calendar Events] No time zone found for user:',
				userId,
				'using UTC'
			)
			return 'UTC' // Default to UTC if no time zone found
		}

		console.log(
			'🗓️ [Calendar Events] Using time zone for user:',
			userId,
			'time zone:',
			data.time_zone
		)
		return data.time_zone
	} catch (error) {
		console.log(
			'🗓️ [Calendar Events] Error getting time zone for user:',
			userId,
			'using UTC'
		)
		return 'UTC'
	}
}

export async function getGoogleCalendarEventsForDay(
	userId: string,
	date: Date,
	supabaseClient?: SupabaseClient
): Promise<
	Array<{
		start: string
		end: string
		title: string
		type: string
		googleEventId: string
	}>
> {
	console.log(
		'🗓️ [Calendar Events] Fetching Google Calendar events for user:',
		userId,
		'date:',
		date.toISOString()
	)

	try {
		// Get authenticated calendar client
		console.log(
			'🗓️ [Calendar Events] Getting authenticated calendar for user:',
			userId
		)
		const calendar = await getAuthenticatedCalendar(userId, supabaseClient)
		console.log(
			'✅ [Calendar Events] Got authenticated calendar for user:',
			userId
		)

		// Get user's time zone and set up date range for the specific day
		const userTimeZone = await getUserTimeZone(userId, supabaseClient)
		console.log(
			'🗓️ [Calendar Events] Input date for user:',
			userId,
			'Raw date:',
			date,
			'Date string:',
			date.toString(),
			'ISO:',
			date.toISOString(),
			'User time zone:',
			userTimeZone
		)

		// Convert the input date to the user's time zone for proper day boundaries
		const userDate = fromZonedTime(date, userTimeZone)
		const startOfDay = fromZonedTime(
			new Date(
				userDate.getFullYear(),
				userDate.getMonth(),
				userDate.getDate(),
				0,
				0,
				0,
				0
			),
			userTimeZone
		)
		const endOfDay = fromZonedTime(
			new Date(
				userDate.getFullYear(),
				userDate.getMonth(),
				userDate.getDate(),
				23,
				59,
				59,
				999
			),
			userTimeZone
		)

		console.log(
			'🗓️ [Calendar Events] Date range calculation for user:',
			userId,
			'User time zone:',
			userTimeZone,
			'Start:',
			startOfDay.toISOString(),
			'End:',
			endOfDay.toISOString()
		)

		console.log(
			'🗓️ [Calendar Events] Fetching events from Google API for user:',
			userId,
			'range:',
			startOfDay.toISOString(),
			'to',
			endOfDay.toISOString()
		)

		// Fetch events for the day
		const response = await calendar.events.list({
			calendarId: 'primary',
			timeMin: startOfDay.toISOString(),
			timeMax: endOfDay.toISOString(),
			singleEvents: true,
			orderBy: 'startTime'
		})

		const events = response.data.items || []
		console.log(
			'✅ [Calendar Events] Got',
			events.length,
			'raw events from Google for user:',
			userId
		)

		// Transform events to the format expected by DayViewTimeSelector
		const filteredEvents = events
			.filter((event) => {
				// Only include events with time data (skip all-day events)
				return event.start?.dateTime && event.end?.dateTime && event.id
			})
			.map((event) => ({
				start: event.start!.dateTime!,
				end: event.end!.dateTime!,
				title: 'Busy', // Generic title for privacy
				type: 'external', // Mark as external calendar event
				googleEventId: event.id! // Include Google event ID for filtering
			}))

		console.log(
			'✅ [Calendar Events] Returning',
			filteredEvents.length,
			'filtered events for user:',
			userId
		)
		return filteredEvents
	} catch (error: any) {
		// Silent failure - if Google Calendar access fails, just return empty array
		console.error(
			'❌ [Calendar Events] Failed to fetch Google Calendar events for user:',
			userId,
			'Error:',
			error.message,
			'Full error:',
			error
		)
		return []
	}
}
