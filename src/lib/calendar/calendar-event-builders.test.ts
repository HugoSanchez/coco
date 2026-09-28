import assert from 'node:assert/strict'
import test from 'node:test'
import {
	buildFullEventData,
	buildPendingEventData,
	buildConfirmedEventData,
	buildInternalConfirmedEventData
} from './calendar-event-builders'

const booking = {
	clientName: 'Client',
	clientEmail: 'client@example.com',
	practitionerName: 'Practitioner',
	startTime: '2026-10-01T10:00:00Z',
	endTime: '2026-10-01T11:00:00Z',
	bookingId: 'booking-1',
	conferenceRequestId: 'meet-1'
}

test('direct bookings invite only the client and keep Google Meet and booking metadata', () => {
	const event = buildFullEventData({ ...booking, includeMeet: true })
	assert.deepEqual(event.attendees, [{ email: booking.clientEmail, responseStatus: 'needsAction' }])
	assert.equal(event.conferenceData.createRequest.requestId, booking.conferenceRequestId)
	assert.equal(event.extendedProperties.private.bookingId, booking.bookingId)
	assert.equal(event.start.dateTime, booking.startTime)
	assert.equal(event.end.dateTime, booking.endTime)
})

test('confirming a pending booking invites only the client and preserves its time', () => {
	const pending = buildPendingEventData(booking)
	assert.equal(pending.attendees, undefined)
	const confirmed = buildConfirmedEventData({
		...booking,
		originalStart: pending.start,
		originalEnd: pending.end,
		includeMeet: true
	})
	assert.deepEqual(confirmed.attendees, [{ email: booking.clientEmail, responseStatus: 'needsAction' }])
	assert.deepEqual(confirmed.start, pending.start)
	assert.deepEqual(confirmed.end, pending.end)
	assert.equal(confirmed.conferenceData.createRequest.requestId, booking.conferenceRequestId)
})

test('historical bookings do not invite anyone or create a meeting', () => {
	const event = buildInternalConfirmedEventData(booking)
	assert.equal('attendees' in event, false)
	assert.equal('conferenceData' in event, false)
	assert.equal(event.extendedProperties?.private.bookingId, booking.bookingId)
})
