import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { afterEach } from 'node:test'
import { runInNewContext } from 'node:vm'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer'
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript'
import * as dates from 'date-fns'
import * as timezones from 'date-fns-tz'
import { es } from 'date-fns/locale'

// Render the real forms and React hooks. Replace UI primitives and external services,
// following the VM module-loading pattern used by the calendar integration tests.
const compiled = new Map<string, string>()
function load(file: string, mocks: Record<string, unknown>, globals = {}): any {
	if (!compiled.has(file)) {
		compiled.set(file, transpileModule(readFileSync(file, 'utf8'), {
			compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020, jsx: JsxEmit.ReactJSX, esModuleInterop: true }
		}).outputText)
	}
	const exports = {}
	runInNewContext(compiled.get(file)!, {
		exports, Date, setTimeout, clearTimeout,
		console: { log() {}, error() {} },
		require(id: string) {
			assert.ok(Object.hasOwn(mocks, id), `Unexpected dependency: ${id}`)
			return mocks[id]
		},
		...globals
	}, { filename: file })
	return exports
}

const renderers: ReactTestRenderer[] = []
afterEach(async () => {
	await act(async () => { renderers.splice(0).forEach((renderer) => renderer.unmount()) })
})
async function render(Component: React.ComponentType<any>, props: any = {}) {
	let renderer!: ReactTestRenderer
	await act(async () => { renderer = create(React.createElement(Component, props)) })
	renderers.push(renderer)
	return renderer
}
function nodes(tree: ReactTestRenderer, type: string) {
	return tree.root.findAll((node) => node.type === type)
}
function modeSelect(tree: ReactTestRenderer): ReactTestInstance {
	const select = nodes(tree, 'Select').find((node) => ['online', 'in_person'].includes(node.props.value))
	assert.ok(select, 'The appointment format selector must be present')
	return select
}
async function chooseMode(tree: ReactTestRenderer, value: string) {
	await act(async () => { modeSelect(tree).props.onValueChange(value) })
}
async function submit(tree: ReactTestRenderer) {
	await act(async () => { await nodes(tree, 'form')[0].props.onSubmit({ preventDefault() {} }) })
}
const patient = (id: string, mode?: string | null) => ({ id, name: id, email: `${id}@example.com`, default_booking_mode: mode })

function setup(profileMode?: string) {
	const context: any = {
		user: { id: 'professional', email: 'professional@example.com' },
		profile: { default_booking_mode: profileMode, default_in_person_location_text: 'Calle Mayor 1' },
		refreshProfile: async () => { context.profile = { ...context.profile, ...profileWrites.at(-1) } }
	}
	const clientWrites: any[] = []
	const profileWrites: any[] = []
	const requests: Array<{ url: string; body: any }> = []
	const toasts: any[] = []
	const savedClients: any[] = []
	const billingSaves: any[] = []
	let failProfileSave = false
	const toast = (value: any) => toasts.push(value)
	const billing = {
		getClientBillingSettings: async () => null,
		getUserDefaultBillingSettings: async () => ({ billing_amount: 50 }),
		getBillingPreferences: async () => ({ billingType: 'in-advance', billingAmount: '50' }),
		saveBillingPreferences: async (_id: string, prefs: any) => { billingSaves.push(prefs) }
	}
	const mocks: Record<string, any> = {
		react: React, 'react/jsx-runtime': jsxRuntime,
		'date-fns': dates, 'date-fns-tz': timezones, 'date-fns/locale': { es },
		'@/contexts/UserContext': { useUser: () => context },
		'@/components/ui/use-toast': { useToast: () => ({ toast }) },
		'@/lib/db/billing-settings': billing,
		'@/lib/db/clients': {
			clientEmailExists: async () => ({ exists: false }),
			upsertClientWithBilling: async (payload: any) => {
				clientWrites.push(payload)
				const saved = { id: 'created-patient', ...payload }
				savedClients.push(saved)
				return saved
			}
		},
		// Exercise the real profile persistence code: a partial INSERT/UPSERT violates
		// profiles.email NOT NULL even when ON CONFLICT would update an existing row.
		'@/lib/db/profiles': load('src/lib/db/profiles.ts', {
			'@/lib/supabase/client': { createClient: () => ({
				from(table: string) {
					assert.equal(table, 'profiles')
					return {
						upsert: async () => ({ error: { code: '23502', message: 'null value in column email violates not-null constraint' } }),
						update(payload: any) {
							return { eq(column: string, id: string) {
								assert.equal(column, 'id')
								assert.equal(id, context.user.id)
								return { select: () => ({ single: async () => {
									if (failProfileSave) return { data: null, error: new Error('Save failed') }
									profileWrites.push(payload)
									return { data: { id }, error: null }
								} }) }
							} }
						}
					}
				}
			}) }
		}),
		'@/lib/db/bookings': { hasAnyNonCanceledBookings: async () => true },
		'@/lib/posthog/client': { captureOnboardingStep() {} },
		'@/components/ClientSearchSelect': { ClientSearchSelect: 'ClientSearchSelect' },
		'@/components/Calendar': { default: 'Calendar' },
		'@/components/DayViewTimeSelector': { DayViewTimeSelector: 'DayViewTimeSelector' },
		'lucide-react': Object.fromEntries(['UserPlus', 'Save', 'Calendar', 'Clock', 'User', 'ArrowLeft', 'ChevronRight', 'Check', 'Info'].map((name) => [name, name]))
	}
	for (const [module, exports] of Object.entries({
		button: ['Button'], input: ['Input'], label: ['Label'], textarea: ['Textarea'], checkbox: ['Checkbox'],
		spinner: ['Spinner'], 'collapsible-section': ['CollapsibleSection'],
		select: ['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue']
	})) {
		mocks[`@/components/ui/${module}`] = Object.fromEntries(exports.map((name) => [name, name]))
	}
	const globals = { fetch: async (url: string, options?: { body: string }) => {
		if (options?.body) requests.push({ url, body: JSON.parse(options.body) })
		return { ok: true, json: async () => ({ events: [] }) }
	} }
	const component = (name: string) => load(`src/components/${name}.tsx`, mocks, globals)[name]
	const ClientFormFields = component('ClientFormFields')
	mocks['@/components/ClientFormFields'] = { ClientFormFields }
	mocks['@/components/BillingPreferencesForm'] = { BillingPreferencesForm: component('BillingPreferencesForm') }
	return {
		context, clientWrites, profileWrites, requests, toasts, billingSaves, savedClients,
		ClientFormFields, BookingForm: component('BookingForm'), BillingPreferencesStep: component('BillingPreferencesStep'),
		failProfileSave: () => { failProfileSave = true }
	}
}

const bookingProps = {
	initialStep: 3,
	initialDate: new Date('2026-10-15T10:00:00Z'),
	initialSlot: { start: '2026-10-15T10:00:00Z', end: '2026-10-15T11:00:00Z' }
}

for (const mode of ['online', 'in_person', undefined]) {
	test(`new patients inherit the professional default without saving an override (${mode ?? 'legacy online'})`, async () => {
		const env = setup(mode)
		const tree = await render(env.ClientFormFields, { onSuccess() {} })
		assert.equal(modeSelect(tree).props.value, mode ?? 'online')
		const options = modeSelect(tree).findAll((node) => String(node.type) === 'SelectItem')
		assert.deepEqual(options.map((node) => node.props.value), ['online', 'in_person'])
		for (const option of options) {
			const label = option.children.join('')
			assert.equal(label.includes('(predeterminado)'), option.props.value === (mode ?? 'online'))
		}
		await submit(tree)
		assert.equal(env.clientWrites[0].default_booking_mode, null)
	})
}

test('late profile loading applies the default, but never overwrites a manual selection', async () => {
	const env = setup()
	env.context.profile = null
	const props = { onSuccess() {} }
	const tree = await render(env.ClientFormFields, props)
	env.context.profile = { default_booking_mode: 'in_person' }
	await act(async () => { tree.update(React.createElement(env.ClientFormFields, props)) })
	assert.equal(modeSelect(tree).props.value, 'in_person')
	assert.equal(nodes(tree, 'SelectItem').find((node) => node.props.value === 'in_person')!.children.join(''), 'Presencial (predeterminado)')
	await chooseMode(tree, 'online')
	env.context.profile = { default_booking_mode: 'in_person' }
	await act(async () => { tree.update(React.createElement(env.ClientFormFields, props)) })
	assert.equal(modeSelect(tree).props.value, 'online')
	await submit(tree)
	assert.equal(env.clientWrites[0].default_booking_mode, 'online')
})

for (const mode of ['online', 'in_person', null, undefined]) {
	test(`editing a patient preserves its preference (${mode ?? 'inherit'}) despite different Settings`, async () => {
		const env = setup(mode === 'in_person' ? 'online' : 'in_person')
		const tree = await render(env.ClientFormFields, { onSuccess() {}, editMode: true, initialData: patient('existing', mode) })
		assert.equal(modeSelect(tree).props.value, mode ?? 'in_person')
		await submit(tree)
		assert.equal(env.clientWrites[0].default_booking_mode, mode ?? null)
	})
}

test('editing the patient format saves it for subsequent appointments', async () => {
	const env = setup('online')
	const tree = await render(env.ClientFormFields, { onSuccess() {}, editMode: true, initialData: patient('existing', 'online') })
	await chooseMode(tree, 'in_person')
	await submit(tree)
	assert.equal(env.clientWrites[0].id, 'existing')
	const booking = await render(env.BookingForm, { ...bookingProps, clients: [env.savedClients[0]] })
	await act(async () => { nodes(booking, 'ClientSearchSelect')[0].props.onValueChange('existing') })
	assert.equal(modeSelect(booking).props.value, 'in_person')
})

test('a restored patient draft keeps its explicit format instead of the professional default', async () => {
	const env = setup('in_person')
	const tree = await render(env.ClientFormFields, {
		onSuccess() {}, persistKey: 'draft', loadDraft: () => ({ name: 'Draft', email: '', dateOfBirth: '', defaultBookingMode: 'online' })
	})
	assert.equal(modeSelect(tree).props.value, 'online')
	await submit(tree)
	assert.equal(env.clientWrites[0].default_booking_mode, 'online')
})

test('Settings saves the format together with billing preferences and new patients inherit it', async () => {
	const env = setup('online')
	const props = { onComplete() {}, showDefaultBookingMode: true, showSuccessToast: true }
	const tree = await render(env.BillingPreferencesStep, props)
	await chooseMode(tree, 'in_person')
	await submit(tree)
	assert.equal(env.profileWrites.length, 1, 'Saving Settings must update the existing profile')
	assert.equal(env.profileWrites[0].default_booking_mode, 'in_person')
	assert.equal(env.billingSaves[0].billingAmount, '50')
	assert.equal(env.toasts.at(-1).color, 'success')
	const reopened = await render(env.BillingPreferencesStep, props)
	assert.equal(modeSelect(reopened).props.value, 'in_person')
	const client = await render(env.ClientFormFields, { onSuccess() {} })
	assert.equal(modeSelect(client).props.value, 'in_person')
	const booking = await render(env.BookingForm, { ...bookingProps, clients: [] })
	assert.equal(modeSelect(booking).props.value, 'in_person')
	assert.equal(env.clientWrites.length, 0, 'Changing Settings must not update existing patients')
})

test('a failed Settings save reports an error and keeps the selected value for retry', async () => {
	const env = setup('online')
	env.failProfileSave()
	const tree = await render(env.BillingPreferencesStep, { onComplete() {}, showDefaultBookingMode: true, showSuccessToast: true })
	await chooseMode(tree, 'in_person')
	await submit(tree)
	assert.equal(env.profileWrites.length, 0)
	assert.equal(env.toasts.at(-1).color, 'error')
	assert.equal(modeSelect(tree).props.value, 'in_person')
})

test('onboarding billing does not change the professional appointment default', async () => {
	const env = setup('in_person')
	const tree = await render(env.BillingPreferencesStep, { onComplete() {} })
	assert.equal(nodes(tree, 'SelectTrigger').filter((node) => node.props.id === 'defaultBookingMode').length, 0)
	await submit(tree)
	assert.equal(env.profileWrites.length, 0)
})

test('switching patients applies each format, while a one-off change leaves their preferences untouched', async () => {
	const env = setup('in_person')
	const clients = [patient('presencial', 'in_person'), patient('online', 'online'), patient('legacy')]
	const tree = await render(env.BookingForm, { ...bookingProps, clients })
	const selectPatient = async (id: string) => {
		await act(async () => { nodes(tree, 'ClientSearchSelect')[0].props.onValueChange(id) })
	}
	await selectPatient('presencial')
	assert.equal(modeSelect(tree).props.value, 'in_person')
	await chooseMode(tree, 'online')
	await submit(tree)
	assert.equal(env.requests.at(-1)!.body.booking.mode, 'online')
	assert.equal(env.requests.at(-1)!.body.booking.locationText, null)
	assert.equal(clients[0].default_booking_mode, 'in_person')
	assert.equal(env.clientWrites.length, 0)
	await selectPatient('online')
	assert.equal(modeSelect(tree).props.value, 'online')
	await selectPatient('presencial')
	assert.equal(modeSelect(tree).props.value, 'in_person')
	await selectPatient('legacy')
	assert.equal(modeSelect(tree).props.value, 'in_person')
})

for (const recurring of [false, true]) {
	test(`${recurring ? 'recurring' : 'single'} appointments submit the patient format and saved location`, async () => {
		const env = setup('online')
		const tree = await render(env.BookingForm, { ...bookingProps, clients: [patient('presencial', 'in_person')] })
		await act(async () => { nodes(tree, 'ClientSearchSelect')[0].props.onValueChange('presencial') })
		if (recurring) {
			await act(async () => { nodes(tree, 'CollapsibleSection').find((node) => node.props.title === 'Programar recurrencia')!.props.onOpenChange(true) })
		}
		await submit(tree)
		const request = env.requests.at(-1)!
		assert.equal(request.url, recurring ? '/api/booking-series/create' : '/api/bookings/create')
		assert.equal(recurring ? request.body.mode : request.body.booking.mode, 'in_person')
		assert.equal(recurring ? request.body.location_text : request.body.booking.locationText, 'Calle Mayor 1')
	})
}

test('a patient created inside an appointment is selected with its saved format', async () => {
	const env = setup('in_person')
	const tree = await render(env.BookingForm, { ...bookingProps, clients: [] })
	await act(async () => { nodes(tree, 'button').find((node) => node.children.includes('+ Nuevo paciente'))!.props.onClick() })
	assert.equal(modeSelect(tree).props.value, 'in_person')
	await submit(tree)
	assert.equal(nodes(tree, 'ClientSearchSelect')[0].props.value, 'created-patient')
	assert.equal(modeSelect(tree).props.value, 'in_person')
	await submit(tree)
	assert.equal(env.requests.at(-1)!.body.booking.mode, 'in_person')
})

for (const preference of [null, undefined]) {
	test(`appointments inherit Settings before selection and for patients without a preference (${preference})`, async () => {
		const env = setup('in_person')
		const props = { ...bookingProps, clients: [patient('existing', preference)] }
		const tree = await render(env.BookingForm, props)
		assert.equal(modeSelect(tree).props.value, 'in_person')
		await act(async () => { nodes(tree, 'ClientSearchSelect')[0].props.onValueChange('existing') })
		assert.equal(modeSelect(tree).props.value, 'in_person')
		await submit(tree)
		assert.equal(env.requests.at(-1)!.body.booking.mode, 'in_person')
		env.context.profile = { default_booking_mode: 'online' }
		await act(async () => { tree.update(React.createElement(env.BookingForm, props)) })
		assert.equal(modeSelect(tree).props.value, 'online')
		assert.equal(env.clientWrites.length, 0)
	})
}

test('appointment defaults follow a late profile load without overwriting a one-off choice', async () => {
	const env = setup()
	env.context.profile = null
	const props = { ...bookingProps, clients: [patient('existing', null)] }
	const tree = await render(env.BookingForm, props)
	await act(async () => { nodes(tree, 'ClientSearchSelect')[0].props.onValueChange('existing') })
	assert.equal(modeSelect(tree).props.value, 'online')
	env.context.profile = { default_booking_mode: 'in_person' }
	await act(async () => { tree.update(React.createElement(env.BookingForm, props)) })
	assert.equal(modeSelect(tree).props.value, 'in_person')
	await chooseMode(tree, 'online')
	env.context.profile = { default_booking_mode: 'in_person' }
	await act(async () => { tree.update(React.createElement(env.BookingForm, props)) })
	assert.equal(modeSelect(tree).props.value, 'online')
	await submit(tree)
	assert.equal(env.requests.at(-1)!.body.booking.mode, 'online')
})

test('an explicit Online patient preference takes precedence over Presencial in Settings', async () => {
	const env = setup('in_person')
	const tree = await render(env.BookingForm, { ...bookingProps, clients: [patient('online', 'online')] })
	await act(async () => { nodes(tree, 'ClientSearchSelect')[0].props.onValueChange('online') })
	assert.equal(modeSelect(tree).props.value, 'online')
	await submit(tree)
	assert.equal(env.requests.at(-1)!.body.booking.mode, 'online')
})

test('a patient can return to inheriting Settings after having its own preference', async () => {
	const env = setup('in_person')
	const tree = await render(env.ClientFormFields, { onSuccess() {}, editMode: true, initialData: patient('existing', 'online') })
	await chooseMode(tree, 'in_person')
	await submit(tree)
	assert.equal(env.clientWrites[0].default_booking_mode, null)
	const booking = await render(env.BookingForm, { ...bookingProps, clients: [env.savedClients[0]] })
	await act(async () => { nodes(booking, 'ClientSearchSelect')[0].props.onValueChange('existing') })
	assert.equal(modeSelect(booking).props.value, 'in_person')
})
