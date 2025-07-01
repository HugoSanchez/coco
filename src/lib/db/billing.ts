/**
 * Billing Settings Database Operations
 *
 * This module handles all database operations related to billing settings, which form
 * a flexible hierarchy to support different billing scenarios:
 *
 * BILLING HIERARCHY (from most specific to least specific):
 * 1. Booking-specific settings (booking_id IS NOT NULL)
 * 2. Client-specific settings (client_id IS NOT NULL, booking_id IS NULL)
 * 3. User default settings (client_id IS NULL, booking_id IS NULL, is_default = true)
 *
 * UNIQUE CONSTRAINTS:
 * - Only one default setting per user
 * - Only one setting per (user, client) combination
 * - Only one setting per booking
 *
 * The system allows users to:
 * - Set global default billing settings
 * - Override settings for specific clients
 * - Override settings for specific bookings
 */

import { createClient as createSupabaseClient } from '@/lib/supabase/client'
const supabase = createSupabaseClient()

/**
 * Billing types supported by the system
 */
export type BillingType = 'in-advance' | 'right-after' | 'monthly'

/**
 * Interface for billing settings
 */
export interface BillingSettings {
	id: string
	user_id: string
	client_id: string | null
	booking_id: string | null
	billing_type: BillingType
	billing_amount: number | null
	currency: string
	is_default: boolean
	created_at: string
	updated_at: string
}

/**
 * Interface for simplified billing preferences (form format)
 */
export interface BillingPreferences {
	billingType: BillingType
	billingAmount: string
}

/**
 * Retrieves the user's default billing configuration
 *
 * Default settings are identified by:
 * - client_id IS NULL (not client-specific)
 * - booking_id IS NULL (not booking-specific)
 * - is_default = true (explicitly marked as default)
 *
 * @param userId - UUID of the user whose default settings to fetch
 * @returns Promise<BillingPreferences|null> - Billing preferences in form format, or null if none exist
 */
export async function getBillingPreferences(
	userId: string
): Promise<BillingPreferences | null> {
	try {
		// Query for user's default billing settings with specific criteria
		const { data, error } = await supabase
			.from('billing_settings')
			.select('*')
			.eq('user_id', userId)
			.is('client_id', null) // Not client-specific
			.is('booking_id', null) // Not booking-specific
			.eq('is_default', true) // Explicitly marked as default
			.single()

		if (error) {
			// If no record found, return null (this is normal for new users)
			if (error.code === 'PGRST116') {
				return null
			}
			console.error('Error fetching billing preferences:', error)
			return null
		}

		// Transform database format to form-friendly format
		return {
			billingType: data.billing_type,
			billingAmount: data.billing_amount?.toString() || ''
		}
	} catch (error) {
		console.error('Error in getBillingPreferences:', error)
		return null
	}
}

/**
 * Saves or updates the user's default billing configuration
 *
 * Uses an update-then-insert pattern to handle both scenarios:
 * 1. User has existing default settings → update them
 * 2. User has no default settings → create new ones
 *
 * This approach ensures we respect the unique constraint while providing
 * a seamless experience for both new and existing users.
 *
 * @param userId - UUID of the user whose settings to save
 * @param preferences - Billing preferences object with form data
 * @returns Promise<BillingSettings[]> - The created or updated billing settings
 * @throws Error if the operation fails
 */
export async function saveBillingPreferences(
	userId: string,
	preferences: BillingPreferences
): Promise<BillingSettings[]> {
	try {
		// Convert form data to database format
		const billingData = {
			billing_amount: parseFloat(preferences.billingAmount) || null,
			billing_type: preferences.billingType,
			currency: 'EUR' // Default currency
		}

		// First, attempt to update existing default settings
		const { data: updateData, error: updateError } = await supabase
			.from('billing_settings')
			.update(billingData)
			.eq('user_id', userId)
			.is('client_id', null) // Only update default settings
			.is('booking_id', null) // Only update default settings
			.eq('is_default', true) // Only update default settings
			.select()

		// If update was successful and found a record, we're done
		if (updateData && updateData.length > 0) {
			return updateData
		}

		// If no record was found to update, create new default settings
		const insertData = {
			user_id: userId,
			client_id: null, // Default settings are not client-specific
			booking_id: null, // Default settings are not booking-specific
			is_default: true, // Explicitly mark as default
			...billingData
		}

		const { data: insertResult, error: insertError } = await supabase
			.from('billing_settings')
			.insert(insertData)
			.select()

		if (insertError) {
			console.error('Error inserting billing preferences:', insertError)
			throw new Error('Failed to save billing preferences')
		}

		return insertResult
	} catch (error) {
		console.error('Error in saveBillingPreferences:', error)
		throw error
	}
}

/**
 * Retrieves billing settings for a specific client
 *
 * Client-specific settings override user defaults for that particular client.
 * These settings are identified by:
 * - user_id matches (data isolation)
 * - client_id matches the specific client
 * - booking_id IS NULL (not booking-specific)
 *
 * @param userId - UUID of the user (for data isolation)
 * @param clientId - UUID of the client whose settings to fetch
 * @returns Promise<BillingSettings|null> - Client billing settings, or null if none exist
 */
export async function getClientBillingSettings(
	userId: string,
	clientId: string
): Promise<BillingSettings | null> {
	try {
		const { data, error } = await supabase
			.from('billing_settings')
			.select('*')
			.eq('user_id', userId) // Ensure data isolation
			.eq('client_id', clientId) // Specific to this client
			.is('booking_id', null) // Not booking-specific
			.single()

		// PGRST116 means no rows found, which is normal
		if (error && error.code !== 'PGRST116') {
			console.error('Error fetching client billing settings:', error)
			return null
		}

		return data
	} catch (error) {
		console.error('Error in getClientBillingSettings:', error)
		return null
	}
}

/**
 * Retrieves billing settings for a specific booking
 *
 * Booking-specific settings are the highest priority in the billing hierarchy.
 * They override both client-specific and user default settings.
 * These settings are identified by:
 * - booking_id matches the specific booking
 *
 * Note: booking_id is globally unique, so we don't need to filter by user_id
 *
 * @param bookingId - UUID of the booking whose settings to fetch
 * @returns Promise<BillingSettings|null> - Booking billing settings, or null if none exist
 */
export async function getBookingBillingSettings(
	bookingId: string
): Promise<BillingSettings | null> {
	try {
		const { data, error } = await supabase
			.from('billing_settings')
			.select('*')
			.eq('booking_id', bookingId) // Specific to this booking
			.single()

		// PGRST116 means no rows found, which is normal
		if (error && error.code !== 'PGRST116') {
			console.error('Error fetching booking billing settings:', error)
			return null
		}

		return data
	} catch (error) {
		console.error('Error in getBookingBillingSettings:', error)
		return null
	}
}

/**
 * Creates or updates billing settings for a specific client
 *
 * @param userId - UUID of the user (for data isolation)
 * @param clientId - UUID of the client
 * @param billingType - The billing type to set
 * @param billingAmount - The amount to charge
 * @param currency - Currency code (defaults to EUR)
 * @returns Promise<BillingSettings> - The created or updated billing settings
 */
export async function upsertClientBillingSettings(
	userId: string,
	clientId: string,
	billingType: BillingType,
	billingAmount: number,
	currency: string = 'EUR'
): Promise<BillingSettings> {
	const { data, error } = await supabase
		.from('billing_settings')
		.upsert(
			{
				user_id: userId,
				client_id: clientId,
				booking_id: null,
				billing_type: billingType,
				billing_amount: billingAmount,
				currency: currency,
				is_default: false
			},
			{
				onConflict: 'user_id,client_id',
				ignoreDuplicates: false
			}
		)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Creates billing settings for a specific booking
 *
 * @param bookingId - UUID of the booking
 * @param userId - UUID of the user (for reference)
 * @param billingType - The billing type to set
 * @param billingAmount - The amount to charge
 * @param currency - Currency code (defaults to EUR)
 * @returns Promise<BillingSettings> - The created billing settings
 */
export async function createBookingBillingSettings(
	bookingId: string,
	userId: string,
	billingType: BillingType,
	billingAmount: number,
	currency: string = 'EUR'
): Promise<BillingSettings> {
	const { data, error } = await supabase
		.from('billing_settings')
		.insert({
			user_id: userId,
			client_id: null,
			booking_id: bookingId,
			billing_type: billingType,
			billing_amount: billingAmount,
			currency: currency,
			is_default: false
		})
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Resolves billing settings using the hierarchy: booking > client > user default
 *
 * @param userId - UUID of the user
 * @param clientId - Optional UUID of the client
 * @param bookingId - Optional UUID of the booking
 * @returns Promise<BillingSettings|null> - The resolved billing settings
 */
export async function resolveBillingSettings(
	userId: string,
	clientId?: string,
	bookingId?: string
): Promise<BillingSettings | null> {
	// 1. Check for booking-specific settings (highest priority)
	if (bookingId) {
		const bookingSettings = await getBookingBillingSettings(bookingId)
		if (bookingSettings) return bookingSettings
	}

	// 2. Check for client-specific settings (medium priority)
	if (clientId) {
		const clientSettings = await getClientBillingSettings(userId, clientId)
		if (clientSettings) return clientSettings
	}

	// 3. Fall back to user default settings (lowest priority)
	const { data, error } = await supabase
		.from('billing_settings')
		.select('*')
		.eq('user_id', userId)
		.is('client_id', null)
		.is('booking_id', null)
		.eq('is_default', true)
		.single()

	if (error && error.code !== 'PGRST116') {
		console.error('Error fetching user default billing settings:', error)
		return null
	}

	return data || null
}
