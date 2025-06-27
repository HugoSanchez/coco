import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// Optional: random amount helper
function randomAmount() {
	// random integer 50-200
	return Math.floor(50 + Math.random() * 150)
}

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function seedBookings(options: {
	count?: number
	clientId: string
	billingType?: 'recurring' | 'consultation_based' | 'project_based'
	billingTrigger?: 'after_consultation' | 'before_consultation'
}) {
	const {
		count = 5,
		clientId,
		billingType = 'recurring',
		billingTrigger
	} = options
	const userId = process.env.SEED_USER_ID
	if (!userId) throw new Error('SEED_USER_ID env var not set')
	if (!clientId) throw new Error('clientId is required')

	const now = new Date()
	for (let i = 0; i < count; i++) {
		const bookingId = randomUUID()
		const start = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000)
		const end = new Date(start.getTime() + 30 * 60 * 1000)

		// 1. Insert booking WITHOUT billing_settings_id yet
		const { error: bookingErr } = await supabase.from('bookings').insert({
			id: bookingId,
			client_id: clientId,
			user_id: userId,
			start_time: start.toISOString(),
			end_time: end.toISOString(),
			status: 'completed',
			billing_status: 'pending'
		})
		if (bookingErr) {
			throw new Error(`Booking insert failed: ${bookingErr.message}`)
		}

		// 2. Create billing_settings tied to this booking
		const billingSettingsId = randomUUID()
		const { error: bsErr } = await supabase
			.from('billing_settings')
			.insert({
				id: billingSettingsId,
				booking_id: bookingId,
				user_id: userId,
				billing_type: billingType,
				billing_trigger:
					billingType === 'consultation_based'
						? billingTrigger ?? 'after_consultation'
						: null,
				billing_amount: randomAmount(),
				should_bill: true,
				is_default: false,
				billing_frequency:
					billingType === 'recurring' ? 'monthly' : null
			})
		if (bsErr) {
			throw new Error(`Billing settings insert failed: ${bsErr.message}`)
		}

		// 3. Update booking with the newly created billing_settings_id
		const { error: updErr } = await supabase
			.from('bookings')
			.update({ billing_settings_id: billingSettingsId })
			.eq('id', bookingId)
		if (updErr) {
			throw new Error(`Booking update failed: ${updErr.message}`)
		}

		// 4. Insert billing_schedule row
		const dateStr = new Date().toISOString().slice(0, 10)
		const { error: schedErr } = await supabase
			.from('billing_schedule')
			.insert({
				booking_id: bookingId,
				action_type: 'send_bill',
				scheduled_date: dateStr,
				status: 'pending',
				retry_count: 0,
				max_retries: 3
			})
		if (schedErr) {
			throw new Error(`Schedule insert failed: ${schedErr.message}`)
		}
	}

	return { success: true, inserted: count }
}
