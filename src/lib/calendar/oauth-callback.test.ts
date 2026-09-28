import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { NextResponse } from 'next/server'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'

const callbackPath = resolve('src/app/(apis)/api/auth/callback/calendar/route.ts')

test('connecting and reconnecting Google only stores tokens and never imports event creation', async () => {
	const savedTokens: Array<Record<string, unknown>> = []
	let tokenRequests = 0
	const mocks: Record<string, unknown> = {
		'next/server': { NextResponse },
		googleapis: {
			google: {
				auth: {
					OAuth2: class {
						async getToken() {
							return { tokens: { access_token: 'test-access', expiry_date: 123 } }
						}
						setCredentials() {}
					}
				},
				oauth2: () => ({ userinfo: { get: async () => ({ data: { email: 'test@example.com' } }) } })
			}
		},
		'@supabase/supabase-js': { createClient: () => ({}) },
		'@/lib/db/profiles': {
			getProfileByEmail: async () => ({ data: { id: 'test-user' }, error: null })
		},
		'@/lib/db/calendar-tokens': {
			getExistingRefreshToken: async () => 'test-existing-refresh',
			upsertCalendarTokens: async (payload: Record<string, unknown>) => { savedTokens.push(payload) }
		}
	}
	const compiled = transpileModule(readFileSync(callbackPath, 'utf8'), {
		compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 }
	}).outputText
	const exports: { GET?: (request: unknown) => Promise<Response> } = {}
	runInNewContext(compiled, {
		exports,
		URL,
		console: { log() {}, warn() {}, error() {} },
		process: { env: { NEXT_PUBLIC_BASE_URL: 'http://localhost:3000' } },
		require(id: string) {
			// Event, booking and mail modules must never be loaded by this flow.
			assert.ok(Object.hasOwn(mocks, id), `Unexpected OAuth side-effect dependency: ${id}`)
			return mocks[id]
		},
		fetch: async (url: string) => {
			assert.equal(new URL(url).origin, 'https://oauth2.googleapis.com')
			tokenRequests += 1
			return { json: async () => ({ scope: 'https://www.googleapis.com/auth/calendar.events' }) }
		}
	}, { filename: callbackPath })
	for (const source of ['settings', 'settings', 'onboarding']) {
		const url = new URL('http://localhost:3000/api/auth/callback/calendar')
		url.searchParams.set('code', 'test-code')
		url.searchParams.set('state', JSON.stringify({ source }))
		const response = await exports.GET!({ url: url.href, nextUrl: url })
		assert.equal(response.status, 307)
		const location = new URL(response.headers.get('location')!)
		assert.equal(location.pathname, source === 'settings' ? '/settings' : '/onboarding')
		assert.equal(location.searchParams.get('calendar_connected'), 'true')
	}
	assert.equal(tokenRequests, 3)
	assert.equal(savedTokens.length, 3)
	for (const tokens of savedTokens) {
		assert.equal(tokens.user_id, 'test-user')
		assert.equal(tokens.refresh_token, 'test-existing-refresh')
	}
})
