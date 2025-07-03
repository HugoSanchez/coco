/**
 * Client Database Operations
 *
 * This module handles all database operations related to clients, including:
 * - Creating clients with optional billing settings
 * - Retrieving clients for a user
 * - Managing client-specific billing configurations
 *
 * The client system supports a flexible billing hierarchy:
 * - Clients can exist without any billing settings
 * - Clients can have specific billing settings that override user defaults
 * - Billing settings are stored separately in the billing_settings table
 */

import { Tables } from '@/types/database.types'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
const supabase = createSupabaseClient()

/**
 * Type alias for the Client table row structure
 * Provides type safety for client data operations
 */
export type Client = Tables<'clients'>

/**
 * Retrieves all clients for a specific user, ordered by creation date (newest first)
 *
 * @param userId - The UUID of the user whose clients to fetch
 * @returns Promise<Client[]> - Array of client objects
 * @throws Error if database operation fails
 */
export async function getClientsForUser(userId: string): Promise<Client[]> {
	const { data, error } = await supabase
		.from('clients')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
	if (error) throw error
	return data || []
}

/**
 * Retrieves a specific client by ID
 *
 * @param clientId - The UUID of the client to retrieve
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<Client | null> - The client object or null if not found
 * @throws Error if database operation fails
 */
export async function getClientById(
	clientId: string,
	supabaseClient?: SupabaseClient
): Promise<Client | null> {
	// Use provided client or fall back to default
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('clients')
		.select('*')
		.eq('id', clientId)
		.single()

	if (error) {
		if (error.code === 'PGRST116') return null // Not found
		throw error
	}
	return data
}

/**
 * Interface for client creation payload
 * Contains only the essential client information (no billing data)
 *
 * @interface CreateClientPayload
 * @property user_id - UUID of the user who owns this client
 * @property name - Full name of the client
 * @property email - Contact email for the client
 * @property description - Optional notes about the client
 */
export interface CreateClientPayload {
	user_id: string
	name: string
	email: string
	description?: string | null
}

/**
 * Interface for client-specific billing settings
 * Used when creating billing settings that are tied to a specific client
 *
 * @interface ClientBillingSettingsPayload
 * @property user_id - UUID of the user (for data isolation)
 * @property client_id - UUID of the client these settings apply to
 * @property should_bill - Whether billing is enabled for this client
 * @property billing_amount - Amount to charge per consultation/period
 * @property billing_type - Type of billing: 'recurring' or 'consultation_based'
 * @property billing_frequency - For recurring: 'weekly' or 'monthly'
 * @property billing_trigger - For consultation_based: 'before_consultation' or 'after_consultation'
 * @property billing_advance_days - Days before consultation to send invoice (if before_consultation)
 */
export interface ClientBillingSettingsPayload {
	user_id: string
	client_id: string
	should_bill: boolean
	billing_amount?: number | null
	billing_type?: string | null
	billing_frequency?: string | null
	billing_trigger?: string | null
	billing_advance_days?: number | null
}

/**
 * Creates a new client in the database
 * Only handles basic client information - no billing data
 *
 * @param payload - Client data to insert
 * @returns Promise<Client> - The created client object with generated ID
 * @throws Error if insertion fails or validation errors occur
 */
export async function createClient(
	payload: CreateClientPayload
): Promise<Client> {
	const { data, error } = await supabase
		.from('clients')
		.insert([payload])
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Creates client-specific billing settings in the billing_settings table
 * These settings will override any default user billing settings for this specific client
 *
 * The function sets:
 * - booking_id: null (client-specific, not booking-specific)
 * - is_default: false (not default settings, client-specific override)
 * - billing_advance_days: defaults to 0 if not provided
 *
 * @param payload - Billing settings data for the client
 * @returns Promise<any> - The created billing settings object
 * @throws Error if insertion fails or unique constraints are violated
 */
export async function createClientBillingSettings(
	payload: ClientBillingSettingsPayload
) {
	// Prepare the billing data with the correct structure for the billing_settings table
	const billingData = {
		user_id: payload.user_id,
		client_id: payload.client_id,
		booking_id: null, // Client-specific settings (not booking-specific)
		is_default: false, // Not default settings (client-specific override)
		should_bill: payload.should_bill,
		billing_amount: payload.billing_amount,
		billing_type: payload.billing_type,
		billing_frequency: payload.billing_frequency,
		billing_trigger: payload.billing_trigger,
		billing_advance_days: payload.billing_advance_days || 0 // Default to 0 if not specified
	}

	const { data, error } = await supabase
		.from('billing_settings')
		.insert([billingData])
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Combined function to create a client with optional billing settings
 * This is the main function used by the UI to create clients
 *
 * The process:
 * 1. Create the client first (always succeeds)
 * 2. If billing settings are provided and billing is enabled, create those separately
 * 3. Return the created client
 *
 * This approach ensures that:
 * - Clients can be created without billing settings
 * - Billing settings are only created when explicitly requested
 * - If billing creation fails, the client still exists
 *
 * @param clientPayload - Basic client information
 * @param billingPayload - Optional billing settings (omits user_id and client_id as they're derived)
 * @returns Promise<Client> - The created client object
 * @throws Error if client creation fails or billing settings creation fails
 */
export async function createClientWithBilling(
	clientPayload: CreateClientPayload,
	billingPayload?: Omit<ClientBillingSettingsPayload, 'user_id' | 'client_id'>
): Promise<Client> {
	// Create the client first - this establishes the client record
	const client = await createClient(clientPayload)

	// If billing settings are provided and billing is enabled, create them
	// We check should_bill to ensure we don't create billing records for disabled billing
	if (billingPayload && billingPayload.should_bill) {
		await createClientBillingSettings({
			user_id: clientPayload.user_id,
			client_id: client.id, // Use the newly created client's ID
			...billingPayload
		})
	}

	// Return the client - billing settings are created separately but linked
	return client
}
