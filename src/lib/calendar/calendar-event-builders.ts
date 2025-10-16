/**
 * Google Calendar Event Data Builders
 *
 * This module contains builder functions for constructing Google Calendar event data objects.
 * Each builder creates a properly structured event object for different appointment types:
 *
 * - buildFullEventData: Complete appointment with client invitation and Google Meet
 * - buildPendingEventData: Placeholder event for payment processing
 * - buildConfirmedEventData: Updated event data for converting pending to confirmed
 * - buildInternalConfirmedEventData: Confirmed appointment stored only in practitioner's calendar (no client invite, no Meet)
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
	conferenceRequestId,
	bookingId,
	location,
	includeMeet
}: {
	clientName: string
	clientEmail: string
	practitionerName: string
	practitionerEmail: string
	startTime: string
	endTime: string
	bookingNotes?: string
	conferenceRequestId: string
	bookingId?: string
	location?: string | null
	includeMeet?: boolean
}) {
	const base: any = {
		summary: `${clientName} - ${practitionerName}`,
		description: bookingNotes ? `Consultation appointment.\n\nNotes: ${bookingNotes}` : 'Consultation appointment.',
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
		guestsCanModify: false,
		guestsCanInviteOthers: false,
		guestsCanSeeOtherGuests: false,
		...(bookingId ? { extendedProperties: { private: { bookingId } } } : {})
	}
	if (location) base.location = location
	if (includeMeet) {
		base.conferenceData = {
			createRequest: {
				requestId: conferenceRequestId,
				conferenceSolutionKey: { type: 'hangoutsMeet' }
			}
		}
	}
	return base
}

/**
 * Builds event data for a pending (placeholder) appointment
 * Used during payment processing to reserve time slots
 */
export function buildPendingEventData({
	clientName,
	practitionerEmail,
	startTime,
	endTime,
	bookingId,
	location,
	extraDescription
}: {
	clientName: string
	practitionerEmail: string
	startTime: string
	endTime: string
	bookingId?: string
	location?: string | null
	extraDescription?: string
}) {
	const base: any = {
		summary: `${clientName} - Pending`, // Clear pending status in title
		description:
			'Pending payment confirmation. This appointment is not yet confirmed.' +
			(extraDescription ? `\n\n${extraDescription}` : ''),
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
		// No attendees to avoid any email notifications to practitioner
		transparency: 'opaque',
		// Restrict guest permissions since this is just a placeholder
		guestsCanModify: false,
		guestsCanInviteOthers: false,
		guestsCanSeeOtherGuests: false,
		...(bookingId ? { extendedProperties: { private: { bookingId } } } : {})
	}
	if (location) base.location = location
	return base
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
	conferenceRequestId,
	bookingId,
	location,
	includeMeet,
	extraDescription
}: {
	clientName: string
	clientEmail: string
	practitionerName: string
	practitionerEmail: string
	originalStart: any // Google Calendar start object
	originalEnd: any // Google Calendar end object
	conferenceRequestId: string
	bookingId?: string
	location?: string | null
	includeMeet?: boolean
	extraDescription?: string
}) {
	const base: any = {
		summary: `${clientName} - ${practitionerName}`, // New confirmed title format
		description: 'Cita confirmada.' + (extraDescription ? `\n\n${extraDescription}` : ''),
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
				responseStatus: 'needsAction' // Client needs to respond to invitation
			}
		],
		// Guest permissions for confirmed appointments
		guestsCanModify: false,
		guestsCanInviteOthers: false,
		guestsCanSeeOtherGuests: false,
		...(bookingId ? { extendedProperties: { private: { bookingId } } } : {})
	}
	if (location) base.location = location
	if (includeMeet) {
		base.conferenceData = {
			createRequest: {
				requestId: conferenceRequestId,
				conferenceSolutionKey: { type: 'hangoutsMeet' }
			}
		}
	}
	return base
}

/**
 * Builds event data for a confirmed appointment without inviting the client
 * Used for historical (past) bookings to avoid sending notifications
 */
export function buildInternalConfirmedEventData({
	clientName,
	practitionerName,
	practitionerEmail,
	startTime,
	endTime,
	bookingNotes,
	bookingId
}: {
	clientName: string
	practitionerName: string
	practitionerEmail: string
	startTime: string
	endTime: string
	bookingNotes?: string
	bookingId?: string
}) {
	return {
		summary: `${clientName} - ${practitionerName}`,
		description: bookingNotes
			? `Consultation (historical).
\nNotes: ${bookingNotes}`
			: 'Consultation (historical).',
		start: {
			dateTime: startTime,
			timeZone: 'UTC'
		},
		end: {
			dateTime: endTime,
			timeZone: 'UTC'
		},
		// Only practitioner as attendee; no client invite, no conference
		attendees: [
			{
				email: practitionerEmail,
				responseStatus: 'accepted'
			}
		],
		colorId: '10',
		guestsCanModify: false,
		guestsCanInviteOthers: false,
		guestsCanSeeOtherGuests: false,
		...(bookingId ? { extendedProperties: { private: { bookingId } } } : {})
	}
}

/**
 * Generates a unique conference request ID for Google Meet
 * Each booking needs a unique ID to avoid conflicts
 */
export function generateConferenceRequestId(prefix: string = 'booking'): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}
