/**
 * Stripe Accounts Database Operations
 *
 * This module handles all database operations related to Stripe Connect accounts, including:
 * - Creating Stripe account records when users connect to Stripe
 * - Retrieving Stripe account information for payment processing
 * - Updating account status when onboarding is completed
 * - Managing Stripe account configurations
 *
 * The Stripe accounts system integrates with:
 * - Users: Each Stripe account belongs to a specific user/practitioner
 * - Payments: Stripe accounts are required for payment processing
 * - Onboarding: Tracks the completion status of Stripe onboarding
 */

import { Tables, TablesInsert, TablesUpdate } from '@/types/database.types'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
const supabase = createSupabaseClient()

/**
 * Type alias for the StripeAccount table row structure
 * Provides type safety for Stripe account data operations
 */
export type StripeAccount = Tables<'stripe_accounts'>

/**
 * Type alias for Stripe account insertion payload
 * Used when creating new Stripe account records
 */
export type StripeAccountInsert = TablesInsert<'stripe_accounts'>

/**
 * Type alias for Stripe account update payload
 * Used when updating existing Stripe account records
 */
export type StripeAccountUpdate = TablesUpdate<'stripe_accounts'>

/**
 * Interface for creating a new Stripe account record
 * Contains the essential information needed to link a user to their Stripe account
 *
 * @interface CreateStripeAccountPayload
 * @property user_id - UUID of the user/practitioner who owns this Stripe account
 * @property stripe_account_id - The Stripe Connect account ID from Stripe
 * @property onboarding_completed - Whether the Stripe onboarding process is complete
 * @property payments_enabled - Whether payments are enabled for this account
 */
export interface CreateStripeAccountPayload {
	user_id: string
	stripe_account_id: string
	onboarding_completed?: boolean
	payments_enabled?: boolean
}

/**
 * Interface for updating Stripe account status
 * Used when onboarding status or payment capabilities change
 *
 * @interface UpdateStripeAccountStatusPayload
 * @property onboarding_completed - Whether onboarding is complete
 * @property payments_enabled - Whether payments are enabled
 */
export interface UpdateStripeAccountStatusPayload {
	onboarding_completed?: boolean
	payments_enabled?: boolean
}

/**
 * Interface for Stripe account information needed for payments
 * Returns only the fields needed by payment processing
 */
export interface StripeAccountForPayments {
	stripe_account_id: string
	onboarding_completed: boolean | null
	payments_enabled: boolean | null
}

/**
 * Creates a new Stripe account record in the database
 * Typically called after successfully creating a Stripe Connect account
 *
 * @param payload - Stripe account data to insert
 * @returns Promise<StripeAccount> - The created Stripe account object with generated ID
 * @throws Error if insertion fails or validation errors occur
 */
export async function createStripeAccount(
	payload: CreateStripeAccountPayload,
	supabaseClient?: SupabaseClient
): Promise<StripeAccount> {
	const client = supabaseClient || supabase

	const stripeAccountData = {
		user_id: payload.user_id,
		stripe_account_id: payload.stripe_account_id,
		onboarding_completed: payload.onboarding_completed || false,
		payments_enabled: payload.payments_enabled || false
	}

	const { data, error } = await client
		.from('stripe_accounts')
		.insert([stripeAccountData])
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Retrieves a Stripe account by its internal ID
 *
 * @param stripeAccountId - The UUID of the Stripe account record to fetch
 * @returns Promise<StripeAccount | null> - The Stripe account object or null if not found
 * @throws Error if database operation fails
 */
export async function getStripeAccountById(
	stripeAccountId: string
): Promise<StripeAccount | null> {
	const { data, error } = await supabase
		.from('stripe_accounts')
		.select('*')
		.eq('id', stripeAccountId)
		.single()

	if (error) {
		if (error.code === 'PGRST116') return null // Not found
		throw error
	}
	return data
}

/**
 * Retrieves a Stripe account by user ID
 * Most commonly used function - gets the Stripe account for a specific user
 *
 * @param userId - The UUID of the user whose Stripe account to fetch
 * @returns Promise<StripeAccount | null> - The Stripe account object or null if not found
 * @throws Error if database operation fails
 */
export async function getStripeAccountByUserId(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<StripeAccount | null> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('stripe_accounts')
		.select('*')
		.eq('user_id', userId)
		.single()

	if (error) {
		if (error.code === 'PGRST116') return null // Not found
		throw error
	}
	return data
}

/**
 * Retrieves Stripe account information needed for payment processing
 * Returns only the fields required by the payment orchestration service
 *
 * @param userId - The UUID of the user whose Stripe account to fetch
 * @returns Promise<StripeAccountForPayments | null> - Stripe account payment info or null if not found
 * @throws Error if database operation fails
 */
export async function getStripeAccountForPayments(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<StripeAccountForPayments | null> {
	// Use provided client or fall back to default
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('stripe_accounts')
		.select('stripe_account_id, onboarding_completed, payments_enabled')
		.eq('user_id', userId)

	if (error) {
		console.error('Error fetching Stripe account for payments:', error)
		throw error
	}

	// Return first result or null if no results
	return data && data.length > 0 ? data[0] : null
}

/**
 * Retrieves a Stripe account by Stripe account ID
 * Useful when working with Stripe webhooks that provide the Stripe account ID
 *
 * @param stripeAccountId - The Stripe Connect account ID
 * @returns Promise<StripeAccount | null> - The Stripe account object or null if not found
 * @throws Error if database operation fails
 */
export async function getStripeAccountByStripeId(
	stripeAccountId: string
): Promise<StripeAccount | null> {
	const { data, error } = await supabase
		.from('stripe_accounts')
		.select('*')
		.eq('stripe_account_id', stripeAccountId)
		.single()

	if (error) {
		if (error.code === 'PGRST116') return null // Not found
		throw error
	}
	return data
}

/**
 * Updates a Stripe account's status
 * Commonly used to update onboarding completion and payment enablement status
 *
 * @param userId - The UUID of the user whose Stripe account to update
 * @param updatePayload - Data to update
 * @returns Promise<StripeAccount> - The updated Stripe account object
 * @throws Error if update fails or Stripe account not found
 */
export async function updateStripeAccountStatus(
	userId: string,
	updatePayload: UpdateStripeAccountStatusPayload,
	supabaseClient?: SupabaseClient
): Promise<StripeAccount> {
	const client = supabaseClient || supabase
	const { data, error } = await client
		.from('stripe_accounts')
		.update(updatePayload)
		.eq('user_id', userId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Updates a Stripe account by Stripe account ID
 * Useful when working with Stripe webhooks
 *
 * @param stripeAccountId - The Stripe Connect account ID
 * @param updatePayload - Data to update
 * @returns Promise<StripeAccount> - The updated Stripe account object
 * @throws Error if update fails or Stripe account not found
 */
export async function updateStripeAccountByStripeId(
	stripeAccountId: string,
	updatePayload: UpdateStripeAccountStatusPayload
): Promise<StripeAccount> {
	const { data, error } = await supabase
		.from('stripe_accounts')
		.update(updatePayload)
		.eq('stripe_account_id', stripeAccountId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Marks a Stripe account as onboarding completed
 * Helper function for when Stripe onboarding is successfully completed
 *
 * @param userId - The UUID of the user whose Stripe account to update
 * @returns Promise<StripeAccount> - The updated Stripe account object
 * @throws Error if update fails or Stripe account not found
 */
export async function markOnboardingCompleted(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<StripeAccount> {
	return updateStripeAccountStatus(
		userId,
		{
			onboarding_completed: true
		},
		supabaseClient
	)
}

/**
 * Enables payments for a Stripe account
 * Helper function for when Stripe confirms payment capabilities are enabled
 *
 * @param userId - The UUID of the user whose Stripe account to update
 * @returns Promise<StripeAccount> - The updated Stripe account object
 * @throws Error if update fails or Stripe account not found
 */
export async function enablePayments(userId: string): Promise<StripeAccount> {
	return updateStripeAccountStatus(userId, {
		payments_enabled: true
	})
}

/**
 * Marks onboarding as completed and enables payments
 * Helper function for when both onboarding and payments are ready
 *
 * @param userId - The UUID of the user whose Stripe account to update
 * @returns Promise<StripeAccount> - The updated Stripe account object
 * @throws Error if update fails or Stripe account not found
 */
export async function markAccountReady(userId: string): Promise<StripeAccount> {
	return updateStripeAccountStatus(userId, {
		onboarding_completed: true,
		payments_enabled: true
	})
}

/**
 * Deletes a Stripe account record from the database
 * Use with caution - typically accounts should be deactivated rather than deleted
 *
 * @param userId - The UUID of the user whose Stripe account to delete
 * @returns Promise<void>
 * @throws Error if deletion fails or Stripe account not found
 */
export async function deleteStripeAccount(userId: string): Promise<void> {
	const { error } = await supabase
		.from('stripe_accounts')
		.delete()
		.eq('user_id', userId)

	if (error) throw error
}

/**
 * Checks if a user has a Stripe account
 * Simple utility function to check account existence
 *
 * @param userId - The UUID of the user to check
 * @returns Promise<boolean> - True if the user has a Stripe account, false otherwise
 * @throws Error if database operation fails
 */
export async function hasStripeAccount(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<boolean> {
	const client = supabaseClient || supabase
	const { data, error } = await client
		.from('stripe_accounts')
		.select('id')
		.eq('user_id', userId)
		.single()

	if (error && error.code === 'PGRST116') return false // Not found
	if (error) throw error
	return !!data
}

/**
 * Checks if a user's Stripe account is ready for payments
 * Utility function to verify both onboarding completion and payment enablement
 *
 * @param userId - The UUID of the user to check
 * @returns Promise<boolean> - True if the account is ready for payments, false otherwise
 * @throws Error if database operation fails
 */
export async function isAccountReadyForPayments(
	userId: string
): Promise<boolean> {
	const account = await getStripeAccountForPayments(userId)
	if (!account) return false

	return !!(account.onboarding_completed && account.payments_enabled)
}
