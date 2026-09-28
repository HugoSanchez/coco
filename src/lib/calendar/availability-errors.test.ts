import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { NextResponse } from 'next/server'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'
import * as dates from 'date-fns'
import * as timezones from 'date-fns-tz'
import { listAvailabilityEvents } from './list-availability-events'

// Exercise the real calendar, availability and HTTP handlers without live credentials.
function load(file: string, mocks: Record<string, unknown>): any {
	const exports = {}
	const compiled = transpileModule(readFileSync(file, 'utf8'), {
		compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 }
	}).outputText
	runInNewContext(compiled, {
		exports, URL,
		console: { log() {}, warn() {}, error() {} },
		require(id: string) {
			assert.ok(Object.hasOwn(mocks, id), `Unexpected dependency: ${id}`)
			return mocks[id]
		}
	}, { filename: file })
	return exports
}

function calendarService(failingCalendar?: string) {
	return load('src/lib/calendar/calendar.ts', {
		googleapis: {},
		'@/lib/supabase/client': { createClient: () => ({}) },
		'date-fns': dates,
		'date-fns-tz': timezones,
		'../db/profiles': {}, '../db/clients': {}, '../db/bookings': {}, '../db/calendar-events': {},
		'./calendar-event-builders': {},
		'./list-availability-events': { listAvailabilityEvents },
		'../db/calendar-tokens': { getUserCalendarId: async () => 'secondary' },
		'../google': { getAuthenticatedCalendar: async () => ({ events: {
			list: async ({ calendarId }: { calendarId: string }) => {
				if (calendarId === failingCalendar) throw new Error('Calendar unavailable')
				return { data: { items: calendarId === 'primary' ? [{
					id: 'busy', start: { dateTime: '2026-10-01T10:00:00Z' }, end: { dateTime: '2026-10-01T11:00:00Z' }
				}] : [] } }
			}
		} }) }
	})
}

for (const failingCalendar of ['primary', 'secondary']) {
	test(`a failed ${failingCalendar} read never becomes empty availability`, async () => {
		const service = calendarService(failingCalendar)
		await assert.rejects(service.getGoogleCalendarEventsForRange(
			'user', new Date('2026-10-01'), new Date('2026-11-01')
		), /Calendar unavailable/)
	})
}

test('successful reads still include occupied time', async () => {
	const events = await calendarService().getGoogleCalendarEventsForRange(
		'user', new Date('2026-10-01'), new Date('2026-11-01')
	)
	assert.equal(events.length, 1)
	assert.equal(events[0].start, '2026-10-01T10:00:00Z')
})

test('calendar failures stop public slot listing, booking creation and rescheduling before writes', async () => {
	const calendar = calendarService('secondary')
	const availability = load('src/lib/calendar/availability-orchestration.ts', {
		'date-fns': dates, 'date-fns-tz': timezones,
		'@/lib/db/bookings': { getBookingsForDateRange: async () => [] },
		'@/lib/db/calendar-events': { getSystemGoogleEventIds: async () => [] },
		'@/lib/db/availability': { getWeeklyAvailability: async () => [] },
		'@/lib/calendar/calendar': calendar
	})
	let writes = 0
	const write = async () => { writes += 1; throw new Error('Unexpected write') }
	const mocks = {
		'next/server': { NextResponse }, 'date-fns': dates, 'date-fns-tz': timezones,
		'@/lib/supabase/server': { createClient: () => ({}), createServiceRoleClient: () => ({}) },
		'@/lib/calendar/availability-orchestration': availability,
		'@/lib/calendar/calendar': { ...calendar, rescheduleCalendarEvent: write },
		'@/lib/db/profiles': { getUserIdByUsername: async () => 'user' },
		'@/lib/db/billing-settings': { getUserDefaultBillingSettings: async () => ({ meeting_duration_min: 60 }) },
		'@/lib/db/clients': { findOrCreateClientByEmail: write, getClientById: async () => ({ email: 'client@example.com' }) },
		'@/lib/db/bookings': {
			getBookingById: async () => ({ user_id: 'user', client_id: 'client', status: 'scheduled' }),
			rescheduleBooking: write
		},
		'@/lib/db/calendar-events': { getCalendarEventsForBooking: async () => [{ google_event_id: 'busy' }] },
		'@/lib/bookings/booking-orchestration-service': { orchestrateBookingCreation: write },
		'@/lib/crypto': { verifyManageSig: () => true },
		'@/lib/emails/email-service': { sendPractitionerBookingNotificationEmail: write },
		'@/lib/posthog/server': {}
	}
	const slots = load('src/app/(apis)/api/calendar/available-slots/route.ts', mocks)
	const response = await slots.GET({ url: 'http://localhost/api/calendar/available-slots?username=test&month=2026-10' })
	assert.equal(response.status, 500)
	assert.equal((await response.json()).slotsByDay, undefined)
	const request = { json: async () => ({
		username: 'test', start: '2026-10-01T10:00:00Z', end: '2026-10-01T11:00:00Z',
		patient: { name: 'Client', email: 'client@example.com' }, sig: 'test-signature'
	}) }
	const bookings = load('src/app/(apis)/api/public/bookings/route.ts', mocks)
	assert.equal((await bookings.POST(request)).status, 500)
	const reschedule = load('src/app/(apis)/api/public/bookings/[id]/reschedule/route.ts', mocks)
	assert.equal((await reschedule.POST(request, { params: { id: 'booking' } })).status, 500)
	assert.equal(writes, 0)
})
