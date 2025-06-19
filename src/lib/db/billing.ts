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

import { supabase } from '../supabase'

/**
 * Retrieves the user's default billing configuration
 *
 * Default settings are identified by:
 * - client_id IS NULL (not client-specific)
 * - booking_id IS NULL (not booking-specific)
 * - is_default = true (explicitly marked as default)
 *
 * @param userId - UUID of the user whose default settings to fetch
 * @returns Promise<Object|null> - Billing preferences in form format, or null if none exist
 */
export async function getBillingPreferences(userId: string) {
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
		// Convert numbers to strings for form inputs and provide defaults
		return {
			shouldBill: data.should_bill || false,
			billingAmount: data.billing_amount?.toString() || '',
			billingType: data.billing_type || '',
			billingFrequency: data.billing_frequency || '',
			billingTrigger: data.billing_trigger || '',
			billingAdvanceDays: data.billing_advance_days?.toString() || '0'
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
 * @returns Promise<Array> - The created or updated billing settings
 * @throws Error if the operation fails
 */
export async function saveBillingPreferences(userId: string, preferences: any) {
	try {
		// Convert form data to database format
		// Parse strings to appropriate types and handle null values
		const billingData = {
			should_bill: preferences.shouldBill || false,
			billing_amount: parseFloat(preferences.billingAmount) || null,
			billing_type: preferences.billingType || null,
			billing_frequency: preferences.billingFrequency || null,
			billing_trigger: preferences.billingTrigger || null,
			billing_advance_days: parseInt(preferences.billingAdvanceDays) || 0
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
 * @returns Promise<Object|null> - Client billing settings, or null if none exist
 */
export async function getClientBillingSettings(
	userId: string,
	clientId: string
) {
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
 * @returns Promise<Object|null> - Booking billing settings, or null if none exist
 */
export async function getBookingBillingSettings(bookingId: string) {
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
