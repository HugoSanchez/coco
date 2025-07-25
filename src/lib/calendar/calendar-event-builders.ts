/**
 * Google Calendar Event Data Builders
 *
 * This module contains builder functions for constructing Google Calendar event data objects.
 * Each builder creates a properly structured event object for different appointment types:
 *
 * - buildFullEventData: Complete appointment with client invitation and Google Meet
 * - buildPendingEventData: Placeholder event for payment processing
 * - buildConfirmedEventData: Updated event data for converting pending to confirmed
 */

/**
 * Builds event data for a complete appointment with client invitation and Google Meet
 * Used for direct bookings or confirmed appointments
 */
export function buildFullEventData({
	clientName,
	clientEmail,
	practitionerName,
	practitionerEmail,
	startTime,
	endTime,
	bookingNotes,
	conferenceRequestId
}: {
	clientName: string
	clientEmail: string
	practitionerName: string
	practitionerEmail: string
	startTime: string
	endTime: string
	bookingNotes?: string
	conferenceRequestId: string
}) {
	return {
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
		guestsCanModify: false,
		guestsCanInviteOthers: false,
		guestsCanSeeOtherGuests: false
	}
}

/**
 * Builds event data for a pending (placeholder) appointment
 * Used during payment processing to reserve time slots
 */
export function buildPendingEventData({
	clientName,
	practitionerEmail,
	startTime,
	endTime
}: {
	clientName: string
	practitionerEmail: string
	startTime: string
	endTime: string
}) {
	return {
		summary: `${clientName} - Pending`, // Clear pending status in title
		description:
			'Pending payment confirmation. This appointment is not yet confirmed.',
		start: {
			dateTime: startTime,
			timeZone: 'UTC'
		},
		end: {
			dateTime: endTime,
			timeZone: 'UTC'
		},
		// Color ID 2 = Light green for pending status
		colorId: '2',
		// Only practitioner as attendee - no client invitation yet
		attendees: [
			{
				email: practitionerEmail, // Fallback if email not found
				responseStatus: 'accepted'
			}
		],
		// Restrict guest permissions since this is just a placeholder
		guestsCanModify: false,
		guestsCanInviteOthers: false,
		guestsCanSeeOtherGuests: false
	}
}

/**
 * Builds event data for converting a pending event to confirmed status
 * Used after successful payment to transform placeholder into full appointment
 */
export function buildConfirmedEventData({
	clientName,
	clientEmail,
	practitionerName,
	practitionerEmail,
	originalStart,
	originalEnd,
	conferenceRequestId
}: {
	clientName: string
	clientEmail: string
	practitionerName: string
	practitionerEmail: string
	originalStart: any // Google Calendar start object
	originalEnd: any // Google Calendar end object
	conferenceRequestId: string
}) {
	return {
		summary: `${clientName} - ${practitionerName}`, // New confirmed title format
		description: 'Consultation appointment confirmed. Payment received.',
		// Preserve original timing
		start: originalStart,
		end: originalEnd,
		// Color ID 10 = Dark green for confirmed appointments
		colorId: '10',
		// Add both practitioner and client as attendees
		attendees: [
			{
				email: practitionerEmail,
				responseStatus: 'accepted'
			},
			{
				email: clientEmail,
				responseStatus: 'accepted' // Client needs to respond to invitation
			}
		],
		// Add Google Meet conference for confirmed appointments
		conferenceData: {
			createRequest: {
				requestId: conferenceRequestId,
				conferenceSolutionKey: {
					type: 'hangoutsMeet'
				}
			}
		},
		// Guest permissions for confirmed appointments
		guestsCanModify: false,
		guestsCanInviteOthers: false,
		guestsCanSeeOtherGuests: false
	}
}

/**
 * Generates a unique conference request ID for Google Meet
 * Each booking needs a unique ID to avoid conflicts
 */
export function generateConferenceRequestId(
	prefix: string = 'booking'
): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}
