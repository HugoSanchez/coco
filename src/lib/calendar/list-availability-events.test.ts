import assert from 'node:assert/strict'
import test from 'node:test'
import type { calendar_v3 } from 'googleapis'
import { listAvailabilityEvents } from './list-availability-events'

const timeMin = '2026-10-01T00:00:00Z'
const timeMax = '2026-11-01T00:00:00Z'
const secondaryId = 'coco@group.calendar.google.com'

function mockCalendar(respond: (params: calendar_v3.Params$Resource$Events$List) => calendar_v3.Schema$Events) {
	const calls: calendar_v3.Params$Resource$Events$List[] = []
	const calendar = {
		events: {
			list: async (params: calendar_v3.Params$Resource$Events$List) => {
				calls.push(params)
				return { data: respond(params) }
			}
		}
	} as unknown as calendar_v3.Calendar
	return { calendar, calls }
}

test('primary-calendar users require only one calendar query', async () => {
	const { calendar, calls } = mockCalendar(() => ({ items: [{ id: 'personal' }] }))
	const events = await listAvailabilityEvents(calendar, 'primary', timeMin, timeMax)
	assert.deepEqual(events.map((event) => event.id), ['personal'])
	assert.equal(calls.length, 1)
	assert.equal(calls[0].calendarId, 'primary')
})

test('includes blocks from both calendars and keeps one copy of shared events', async () => {
	const { calendar, calls } = mockCalendar(({ calendarId }) => ({
		items: calendarId === 'primary'
			? [{ id: 'personal' }, { id: 'shared', summary: 'Invitation' }]
			: [{ id: 'manual-block' }, { id: 'shared', summary: 'Original' }]
	}))
	const events = await listAvailabilityEvents(calendar, secondaryId, timeMin, timeMax)
	assert.deepEqual(calls.map((call) => call.calendarId), ['primary', secondaryId])
	assert.deepEqual(events.map((event) => event.id).sort(), ['manual-block', 'personal', 'shared'])
	assert.equal(events.find((event) => event.id === 'shared')?.summary, 'Original')
	for (const call of calls) {
		assert.equal(call.timeMin, timeMin)
		assert.equal(call.timeMax, timeMax)
		assert.equal(call.singleEvents, true)
	}
})

test('includes later pages from each calendar without sharing page tokens', async () => {
	const { calendar, calls } = mockCalendar(({ calendarId, pageToken }) => {
		if (!pageToken) return { items: [{ id: `${calendarId}-1` }], nextPageToken: `${calendarId}-next` }
		assert.equal(pageToken, `${calendarId}-next`)
		return { items: [{ id: `${calendarId}-2` }] }
	})
	const events = await listAvailabilityEvents(calendar, secondaryId, timeMin, timeMax)
	assert.equal(calls.length, 4)
	assert.deepEqual(events.map((event) => event.id).sort(), [
		`${secondaryId}-1`, `${secondaryId}-2`, 'primary-1', 'primary-2'
	].sort())
})

test('empty calendars return no events', async () => {
	const { calendar } = mockCalendar(() => ({}))
	assert.deepEqual(await listAvailabilityEvents(calendar, secondaryId, timeMin, timeMax), [])
})

test('calendar errors reach the caller instead of returning incomplete availability', async () => {
	const { calendar } = mockCalendar(({ calendarId }) => {
		if (calendarId === secondaryId) throw new Error('Calendar unavailable')
		return { items: [{ id: 'personal' }] }
	})
	await assert.rejects(listAvailabilityEvents(calendar, secondaryId, timeMin, timeMax), /Calendar unavailable/)
})
