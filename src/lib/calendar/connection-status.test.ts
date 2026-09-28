import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { NextResponse } from 'next/server'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'
import { CalendarDisconnectedError, fetchCalendarConnectionStatus } from './connection-status'

const statusPath = resolve('src/app/(apis)/api/calendar/status/route.ts')
const compiled = transpileModule(readFileSync(statusPath, 'utf8'), {
	compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 }
}).outputText

function statusHandler(options: { authenticated?: boolean; calendarError?: Error; authError?: Error } = {}) {
	const mocks: Record<string, unknown> = {
		'next/server': { NextResponse },
		'@/lib/calendar/connection-status': { CalendarDisconnectedError },
		'@/lib/supabase/server': {
			createClient: () => ({ auth: { getUser: async () => {
				if (options.authError) throw options.authError
				return { data: { user: options.authenticated === false ? null : { id: 'test-user' } }, error: null }
			} } })
		},
		'@/lib/google': {
			getAuthenticatedCalendar: async () => {
				if (options.calendarError) throw options.calendarError
				return {}
			}
		}
	}
	const exports: { GET?: () => Promise<Response> } = {}
	runInNewContext(compiled, {
		exports,
		require(id: string) {
			assert.ok(Object.hasOwn(mocks, id), `Unexpected dependency: ${id}`)
			return mocks[id]
		}
	}, { filename: statusPath })
	return exports.GET!
}

test('confirmed credential failures prompt reconnection, while valid credentials stay connected', async () => {
	const connected = statusHandler()
	assert.equal(await fetchCalendarConnectionStatus(connected), true)
	const disconnected = statusHandler({ calendarError: new CalendarDisconnectedError('Calendar tokens not found') })
	const response = await disconnected()
	assert.equal(response.status, 200)
	assert.equal(await fetchCalendarConnectionStatus(disconnected), false)
})

test('database, Google and authentication service failures remain unknown instead of disconnected', async () => {
	for (const calendarError of [new Error('Database unavailable'), new Error('Google request timeout')]) {
		const handler = statusHandler({ calendarError })
		const response = await handler()
		assert.equal(response.status, 503)
		assert.equal((await response.json()).connected, null)
		assert.equal(await fetchCalendarConnectionStatus(handler), null)
	}
	const authFailure = statusHandler({ authError: new Error('Authentication service unavailable') })
	assert.equal((await authFailure()).status, 500)
	assert.equal(await fetchCalendarConnectionStatus(authFailure), null)
	assert.equal(await fetchCalendarConnectionStatus(statusHandler({ authenticated: false })), null)
})

test('HTTP errors, invalid responses and network failures never produce a reconnect warning', async () => {
	const fetchers: Array<typeof fetch> = [
		async () => new Response('Server error', { status: 500 }),
		async () => new Response('Invalid JSON'),
		async () => Response.json({}),
		async () => Response.json({ connected: 'false' }),
		async () => Response.json({ connected: null }),
		async () => { throw new Error('Network unavailable') }
	]
	for (const fetcher of fetchers) {
		assert.equal(await fetchCalendarConnectionStatus(fetcher), null)
	}
})
