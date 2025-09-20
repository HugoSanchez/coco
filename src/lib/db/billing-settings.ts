/**
 * Billing Settings Database Operations
 *
 * Simplified billing system with two levels:
 * 1. Client-specific settings (client_id IS NOT NULL)
 * 2. User default settings (client_id IS NULL, is_default = true)
 *
 * UNIQUE CONSTRAINTS:
 * - Only one default setting per user
 * - Only one setting per (user, client) combination
 */

import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
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
	first_consultation_amount?: number | null
}

/**
 * Interface for simplified billing preferences (form format)
 */
export interface BillingPreferences {
	billingType: BillingType
	billingAmount: string
	firstConsultationAmount?: string
}

/**
 * Retrieves the user's default billing configuration
 *
 * @param userId - UUID of the user whose default settings to fetch
 * @returns Promise<BillingPreferences|null> - Billing preferences in form format, or null if none exist
 */
export async function getBillingPreferences(
	userId: string
): Promise<BillingPreferences | null> {
	try {
		const { data, error } = await supabase
			.from('billing_settings')
			.select('*')
			.eq('user_id', userId)
			.is('client_id', null) // Not client-specific
			.is('booking_id', null) // Not booking-specific
			.eq('is_default', true) // Explicitly marked as default
			.maybeSingle()

		if (error) {
			if (error.code === 'PGRST116') {
				return null
			}
			console.error('Error fetching billing preferences:', error)
			return null
		}

		return {
			billingType: data.billing_type,
			billingAmount: data.billing_amount?.toString() || '',
			firstConsultationAmount:
				data.first_consultation_amount?.toString() || ''
		}
	} catch (error) {
		console.error('Error in getBillingPreferences:', error)
		return null
	}
}

/**
 * Saves or updates the user's default billing configuration
 *
 * @param userId - UUID of the user whose settings to save
 * @param preferences - Billing preferences object with form data
 * @returns Promise<BillingSettings[]> - The created or updated billing settings
 */
export async function saveBillingPreferences(
	userId: string,
	preferences: BillingPreferences
): Promise<BillingSettings[]> {
	try {
		const billingData: any = {
			billing_amount: parseFloat(preferences.billingAmount) || null,
			billing_type: preferences.billingType,
			currency: 'EUR'
		}

		// Optional first consultation amount
		if (
			preferences.firstConsultationAmount != null &&
			preferences.firstConsultationAmount !== ''
		) {
			const parsed = parseFloat(preferences.firstConsultationAmount)
			billingData.first_consultation_amount = isNaN(parsed)
				? null
				: parsed
		} else {
			billingData.first_consultation_amount = null
		}

		// First, attempt to update existing default settings
		const { data: updateData, error: updateError } = await supabase
			.from('billing_settings')
			.update(billingData)
			.eq('user_id', userId)
			.is('client_id', null)
			.is('booking_id', null)
			.eq('is_default', true)
			.select()

		if (updateData && updateData.length > 0) {
			return updateData
		}

		// Create new default settings if none exist
		const insertData = {
			user_id: userId,
			client_id: null,
			booking_id: null,
			is_default: true,
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
 * @param userId - UUID of the user (for data isolation)
 * @param clientId - UUID of the client whose settings to fetch
 * @returns Promise<BillingSettings|null> - Client billing settings, or null if none exist
 */
export async function getClientBillingSettings(
	userId: string,
	clientId: string,
	supabaseClient?: SupabaseClient
): Promise<BillingSettings | null> {
	try {
		// Use provided client or fall back to default
		const client = supabaseClient || supabase

		const { data, error } = await client
			.from('billing_settings')
			.select('*')
			.eq('user_id', userId)
			.eq('client_id', clientId)
			.is('booking_id', null)
			.maybeSingle() // Use maybeSingle() instead of single() to handle no results gracefully

		if (error) {
			console.error('❌ Error fetching client billing settings:', error)
			return null
		}

		return data
	} catch (error) {
		console.error('❌ Exception in getClientBillingSettings:', error)
		return null
	}
}

/**
 * Retrieves user default billing settings (for booking orchestration)
 * Returns the full billing settings record including ID for proper referential integrity
 *
 * @param userId - The UUID of the user whose default billing settings to fetch
 * @returns Promise<BillingSettings | null> - The billing settings object or null if not found
 * @throws Error if database operation fails
 */
export async function getUserDefaultBillingSettings(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<BillingSettings | null> {
	try {
		// Use provided client or fall back to default
		const client = supabaseClient || supabase

		const { data, error } = await client
			.from('billing_settings')
			.select('*')
			.eq('user_id', userId)
			.is('client_id', null)
			.is('booking_id', null)
			.eq('is_default', true)
			.single()

		if (error) {
			if (error.code === 'PGRST116') {
				return null // Not found
			}
			console.error(
				'❌ Error fetching user default billing settings:',
				error
			)
			return null
		}

		return data
	} catch (error) {
		console.error('❌ Exception in getUserDefaultBillingSettings:', error)
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
