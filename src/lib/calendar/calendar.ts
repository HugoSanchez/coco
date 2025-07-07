import { google } from 'googleapis'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import {
	updateUserCalendarTokens,
	getUserCalendarTokens
} from '../db/calendar-tokens'
import { oauth2Client } from '../google'
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

// Function to refresh the access token
// This function is used to refresh the access token when it expires
// It takes the user's ID and the refresh token as arguments
// It returns the new access token from Google.
async function refreshToken(
	userId: string,
	refreshToken: string,
	supabaseClient?: SupabaseClient
) {
	// Set the credentials to the refresh token
	oauth2Client.setCredentials({ refresh_token: refreshToken })

	try {
		// Ask Google for a new access token
		const tokenResponse = await oauth2Client.getAccessToken()
		// If unsuccessful, throw an error
		if (!tokenResponse.token)
			throw new Error('No access token returned after refresh')
		// Else,
		else {
			// Extract expiry duration (defaults to 1 hour if not provided)
			const expiryDuration = oauth2Client.credentials.expiry_date
				? oauth2Client.credentials.expiry_date - Date.now()
				: 3600 * 1000
			// update the token in the database
			await updateUserCalendarTokens(
				tokenResponse,
				userId,
				expiryDuration,
				supabaseClient
			)
			// and return token
			return tokenResponse.token
		}
	} catch (error: any) {
		throw error
	}
}

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

	// Fetch user's calendar tokens
	const { data: calendarTokens, error: tokensError } = await supabase
		.from('calendar_tokens')
		.select('*')
		.eq('user_id', userId)
		.single()

	if (tokensError) {
		throw new Error('Calendar tokens not found')
	}

	// Get the current time
	const now = Date.now()
	// Check if the access token is expired
	if (
		(calendarTokens.expiry_date && calendarTokens.expiry_date < now) ||
		true
	) {
		console.log('Access token expired, refreshing...')
		// Call the refreshToken function to get a new access token
		const newAccessToken = await refreshToken(
			userId,
			calendarTokens.refresh_token,
			undefined // No supabaseClient needed for public function
		)
		// Set the new access token
		oauth2Client.setCredentials({
			access_token: newAccessToken,
			refresh_token: calendarTokens.refresh_token
		})
	} else {
		// If tokens are not expired, just set the access token
		oauth2Client.setCredentials({
			access_token: calendarTokens.access_token,
			refresh_token: calendarTokens.refresh_token
		})
	}

	try {
		// Create a calendar instance with the OAuth2 client
		const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
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
 * Interface for creating a calendar event with booking details
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
		// Fetch user's calendar tokens
		const calendarTokens = await getUserCalendarTokens(
			userId,
			supabaseClient
		)

		if (!calendarTokens) {
			throw new Error('Calendar tokens not found')
		}

		// Non-null assertion since we've checked above
		const tokens = calendarTokens!

		// Check if the access token is expired and refresh if needed
		const now = Date.now()
		if (
			(tokens.expiry_date && tokens.expiry_date < now) ||
			true // Force refresh for now to ensure fresh tokens
		) {
			const newAccessToken = await refreshToken(
				userId,
				tokens.refresh_token,
				supabaseClient
			)
			oauth2Client.setCredentials({
				access_token: newAccessToken,
				refresh_token: tokens.refresh_token
			})
		} else {
			oauth2Client.setCredentials({
				access_token: tokens.access_token,
				refresh_token: tokens.refresh_token
			})
		}

		// Create calendar instance
		const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

		// Generate unique conference request ID
		const conferenceRequestId = `booking-${Date.now()}-${Math.random()
			.toString(36)
			.substring(2, 15)}`

		// Create the event object
		const eventData = {
			summary: `${clientName} - ${practitionerName}`,
			description: bookingNotes
				? `Consultation appointment.\n\nNotes: ${bookingNotes}`
				: 'Consultation appointment.',
			start: {
				dateTime: startTime,
				timeZone: 'UTC'
			},
			end: {
				dateTime: endTime,
				timeZone: 'UTC'
			},
			attendees: [
				{
					email: practitionerEmail,
					responseStatus: 'accepted'
				},
				{
					email: clientEmail,
					responseStatus: 'needsAction'
				}
			],
			conferenceData: {
				createRequest: {
					requestId: conferenceRequestId,
					conferenceSolutionKey: {
						type: 'hangoutsMeet'
					}
				}
			},
			reminders: {
				useDefault: false,
				overrides: [
					{ method: 'email', minutes: 24 * 60 }, // 24 hours before
					{ method: 'popup', minutes: 30 } // 30 minutes before
				]
			},
			guestsCanModify: false,
			guestsCanInviteOthers: false,
			guestsCanSeeOtherGuests: false
		}

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

		// Extract Google Meet link
		const googleMeetLink =
			createdEvent.conferenceData?.entryPoints?.find(
				(entry) => entry.entryPointType === 'video'
			)?.uri || null

		return {
			success: true,
			googleEventId: createdEvent.id,
			googleMeetLink: googleMeetLink || undefined
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
