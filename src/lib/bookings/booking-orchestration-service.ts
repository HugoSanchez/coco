/**
 * Simple Booking Creation Service
 *
 * Creates bookings with a simple billing hierarchy:
 * 1. Client-specific billing settings (if they exist)
 * 2. User default billing settings (fallback)
 * 3. Auto-created default settings (if none exist)
 *
 * Bookings reference billing_settings via billing_settings_id for:
 * - Proper normalization (no duplicate billing data)
 * - Referential integrity (clear audit trail)
 * - Consistency (billing details stored in one place)
 *
 * Based on billing type, calls the appropriate creation function.
 */

import { createBooking, CreateBookingPayload, Booking } from '@/lib/db/bookings'
import {
	getClientBillingSettings,
	getBillingPreferences
} from '@/lib/db/billing'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
const supabase = createSupabaseClient()

/**
 * Interface for creating a booking
 */
export interface CreateBookingRequest {
	userId: string
	clientId: string
	startTime: string
	endTime: string
	notes?: string
	status?: 'pending' | 'scheduled' | 'completed' | 'canceled'
}

/**
 * Result of booking creation
 */
export interface CreateBookingResult {
	booking: Booking
	requiresPayment: boolean
	paymentUrl?: string
}

/**
 * Gets billing settings for a booking (client-specific or user default)
 * Returns the full billing settings record including ID for proper referential integrity
 * If no billing settings exist, creates default ones automatically
 */
async function getBillingForBooking(userId: string, clientId: string) {
	// Check if client has specific billing settings
	const clientBilling = await getClientBillingSettings(userId, clientId)
	if (clientBilling) {
		return {
			id: clientBilling.id,
			type: clientBilling.billing_type,
			amount: clientBilling.billing_amount || 0,
			currency: clientBilling.currency
		}
	}

	// Fall back to user default - we need to get the full record, not just preferences
	const { data: userDefaultSettings, error } = await supabase
		.from('billing_settings')
		.select('*')
		.eq('user_id', userId)
		.is('client_id', null)
		.is('booking_id', null)
		.eq('is_default', true)
		.single()

	if (userDefaultSettings && !error) {
		return {
			id: userDefaultSettings.id,
			type: userDefaultSettings.billing_type,
			amount: userDefaultSettings.billing_amount || 0,
			currency: userDefaultSettings.currency
		}
	}

	// No billing settings found - create default ones automatically
	// This ensures billing_settings_id is never null
	console.log('No billing settings found for user, creating defaults...')

	const { data: newDefaultSettings, error: createError } = await supabase
		.from('billing_settings')
		.insert({
			user_id: userId,
			client_id: null,
			booking_id: null,
			billing_type: 'right-after',
			billing_amount: 0,
			currency: 'EUR',
			is_default: true
		})
		.select()
		.single()

	if (createError) {
		throw new Error(
			`Failed to create default billing settings: ${createError.message}`
		)
	}

	return {
		id: newDefaultSettings.id,
		type: newDefaultSettings.billing_type,
		amount: newDefaultSettings.billing_amount || 0,
		currency: newDefaultSettings.currency
	}
}

/**
 * Creates a booking with in-advance payment
 */
async function createInAdvanceBooking(
	request: CreateBookingRequest,
	billing: any
): Promise<CreateBookingResult> {
	const bookingPayload: CreateBookingPayload = {
		user_id: request.userId,
		client_id: request.clientId,
		start_time: request.startTime,
		end_time: request.endTime,
		status: 'pending', // Pending until payment
		billing_settings_id: billing.id
	}

	const booking = await createBooking(bookingPayload)

	// If amount > 0, requires payment
	const requiresPayment = billing.amount > 0

	return {
		booking,
		requiresPayment,
		paymentUrl: requiresPayment
			? `/payment/checkout/${booking.id}`
			: undefined
	}
}

/**
 * Creates a booking with right-after billing
 */
async function createRightAfterBooking(
	request: CreateBookingRequest,
	billing: any
): Promise<CreateBookingResult> {
	const bookingPayload: CreateBookingPayload = {
		user_id: request.userId,
		client_id: request.clientId,
		start_time: request.startTime,
		end_time: request.endTime,
		status: request.status || 'scheduled', // Confirmed immediately
		billing_settings_id: billing.id
	}

	const booking = await createBooking(bookingPayload)

	// No immediate payment required
	return {
		booking,
		requiresPayment: false
	}
}

/**
 * Creates a booking with monthly billing
 */
async function createMonthlyBooking(
	request: CreateBookingRequest,
	billing: any
): Promise<CreateBookingResult> {
	const bookingPayload: CreateBookingPayload = {
		user_id: request.userId,
		client_id: request.clientId,
		start_time: request.startTime,
		end_time: request.endTime,
		status: request.status || 'scheduled', // Confirmed immediately
		billing_settings_id: billing.id
	}

	const booking = await createBooking(bookingPayload)

	// No immediate payment required
	return {
		booking,
		requiresPayment: false
	}
}

/**
 * Main function: creates a booking based on billing type
 *
 * This function ensures proper referential integrity by:
 * 1. Resolving the specific billing settings record used (client-specific or user default)
 * 2. Linking the booking to that billing settings record via billing_settings_id
 * 3. This creates an audit trail showing exactly which billing configuration was used
 */
export async function createBookingSimple(
	request: CreateBookingRequest
): Promise<CreateBookingResult> {
	try {
		// Get billing settings (client-specific or user default)
		// This returns the full record including ID for proper referential integrity
		const billing = await getBillingForBooking(
			request.userId,
			request.clientId
		)

		// Call appropriate function based on billing type
		switch (billing.type) {
			case 'in-advance':
				return await createInAdvanceBooking(request, billing)

			case 'right-after':
				return await createRightAfterBooking(request, billing)

			case 'monthly':
				return await createMonthlyBooking(request, billing)

			default:
				throw new Error(`Unknown billing type: ${billing.type}`)
		}
	} catch (error) {
		console.error('Error creating booking:', error)
		throw error
	}
}
