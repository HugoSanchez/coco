import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client with service role key for admin operations
 * This bypasses RLS (Row Level Security) policies
 */
const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/dev/seed-consultations
 *
 * DEV ENDPOINT: Creates test data for consultation-based billing
 *
 * Purpose:
 * - Creates 2 consultation bookings that reference existing billing_settings
 * - Creates billing_schedule entries with TODAY'S date so they appear in consultation API
 * - Uses hardcoded IDs to avoid creating duplicate clients/billing_settings
 *
 * Why this endpoint exists:
 * - Our consultation API was returning empty results because existing billing_schedule
 *   entries had future dates (2025-07-31)
 * - We need test data with today's date to verify the consultation API works
 *
 * What it creates:
 * 1. Two bookings with future consultation dates (tomorrow & day after)
 * 2. Two billing_schedule entries with TODAY'S date (so they're "due now")
 *
 * Database flow:
 * bookings (new) → billing_settings (existing) ← billing_schedule (new, due today)
 */
export async function GET() {
	// =========================================================================
	// HARDCODED VALUES (to avoid creating duplicate data)
	// =========================================================================

	/**
	 * These IDs already exist in the database:
	 * - clientId: Dummy client for testing
	 * - billingSettingsId: consultation_based billing config ($80, before_consultation, 7 days advance)
	 * - userId: The profile/user who owns these bookings
	 */
	const clientId = '701f7e1b-a60b-4643-8ef2-3852f7c891a3' // Existing client
	const billingSettingsId = 'bf480261-ae87-4edf-b322-91928c66706f' // Existing consultation_based billing
	const userId = 'dd803ea2-01da-4c6a-bbcd-16849dcfc3a4' // Your profile ID

	/**
	 * TODAY'S DATE - this is the key!
	 * The consultation API filters for billing_schedule.scheduled_date <= today
	 * By using today's date, these entries will appear in the API results
	 */
	const todayStr = new Date().toISOString().slice(0, 10) // Format: YYYY-MM-DD

	try {
		const createdBookings = []

		// =====================================================================
		// CREATE 2 CONSULTATION BOOKINGS
		// =====================================================================

		for (let i = 0; i < 2; i++) {
			const now = new Date()

			// Create consultation dates in the future (tomorrow, day after tomorrow)
			const start = new Date(
				now.getTime() + (i + 1) * 24 * 60 * 60 * 1000
			) // Future dates
			const end = new Date(start.getTime() + 60 * 60 * 1000) // 1 hour duration

			// =================================================================
			// STEP 1: CREATE BOOKING
			// =================================================================

			/**
			 * Insert booking and get the auto-generated ID
			 * - Uses existing client_id and billing_settings_id (no new records created)
			 * - Sets status to 'scheduled' (future appointment)
			 * - Sets billing_status to 'pending' (needs to be billed)
			 */
			const { data: bookingData, error: bookingError } = await supabase
				.from('bookings')
				.insert({
					client_id: clientId, // → links to existing client
					user_id: userId, // → links to existing user/profile
					billing_settings_id: billingSettingsId, // → links to existing billing config
					start_time: start.toISOString(), // → consultation appointment time
					end_time: end.toISOString(), // → consultation end time
					status: 'scheduled', // → future appointment
					billing_status: 'pending' // → needs billing
				})
				.select('id') // Get the auto-generated booking ID
				.single() // Expect exactly one result

			if (bookingError || !bookingData) {
				throw new Error(
					`Booking ${i + 1} failed: ${bookingError?.message}`
				)
			}

			const bookingId = bookingData.id // This is the auto-generated UUID

			// =================================================================
			// STEP 2: CREATE BILLING SCHEDULE ENTRY
			// =================================================================

			/**
			 * Create billing_schedule entry with TODAY'S date
			 *
			 * This is the crucial part! The billing_schedule table acts as a "task queue"
			 * for billing operations. By setting scheduled_date = TODAY, these entries
			 * will be picked up by the consultation API.
			 *
			 * In a real system, this date would be calculated based on:
			 * - billing_settings.billing_trigger ('before_consultation' or 'after_consultation')
			 * - billing_settings.billing_advance_days (how many days before/after)
			 * - booking.start_time (the consultation date)
			 *
			 * For testing, we just use today's date so it appears immediately.
			 */
			const { error: scheduleError } = await supabase
				.from('billing_schedule')
				.insert({
					booking_id: bookingId, // → links to the booking we just created
					action_type: 'send_bill', // → what action to take (send invoice)
					scheduled_date: todayStr, // → when to bill (TODAY = due now)
					status: 'pending', // → not processed yet
					retry_count: 0, // → no retries yet
					max_retries: 3 // → max retry attempts
				})

			if (scheduleError) {
				throw new Error(
					`Schedule ${i + 1} failed: ${scheduleError.message}`
				)
			}

			// Track what we created for the response
			createdBookings.push({
				booking_id: bookingId,
				start_time: start.toISOString(),
				billing_due_date: todayStr
			})
		}

		// =====================================================================
		// SUCCESS RESPONSE
		// =====================================================================

		return NextResponse.json({
			success: true,
			count: createdBookings.length,
			bookings: createdBookings
		})
	} catch (error: any) {
		// =====================================================================
		// ERROR RESPONSE
		// =====================================================================

		return NextResponse.json(
			{
				success: false,
				error: error.message,
				context: 'Failed to create consultation test data'
			},
			{ status: 500 }
		)
	}
}
