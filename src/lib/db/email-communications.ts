/**
 * Email Communications Database Operations
 *
 * This module handles all database operations for email communications between
 * practitioners and their clients. It tracks emails sent for bills, reminders,
 * and other communication types with full status tracking and error handling.
 *
 * All functions support both client-side and server-side usage through optional
 * SupabaseClient parameters for maximum flexibility.
 */

import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabase = createSupabaseClient()

/**
 * Email communication record structure
 * Represents a single email communication tracked in the system
 */
export interface EmailCommunication {
	id: string
	user_id: string
	client_id: string | null
	email_type: string
	recipient_email: string
	recipient_name: string | null
	subject: string | null
	bill_id: string | null
	booking_id: string | null
	status: 'pending' | 'sent' | 'failed'
	sent_at: string | null
	error_message: string | null
	created_at: string
}

/**
 * Payload for creating a new email communication record
 */
export interface CreateEmailCommunicationPayload {
	user_id: string
	client_id?: string | null
	email_type: string
	recipient_email: string
	recipient_name?: string | null
	subject?: string | null
	bill_id?: string | null
	booking_id?: string | null
	status?: 'pending' | 'sent' | 'failed'
	error_message?: string | null
}

/**
 * Creates a new email communication record
 * Used to track when emails are sent or attempted to be sent
 *
 * @param payload - Email communication data to insert
 * @param supabaseClient - Optional SupabaseClient instance for server-side usage
 * @returns Promise<EmailCommunication> - The created email communication record
 * @throws Error if insertion fails
 */
export async function createEmailCommunication(
	payload: CreateEmailCommunicationPayload,
	supabaseClient?: SupabaseClient
): Promise<EmailCommunication> {
	const client = supabaseClient || supabase

	// Set sent_at timestamp if status is 'sent'
	const emailData = {
		...payload,
		sent_at: payload.status === 'sent' ? new Date().toISOString() : null
	}

	const { data, error } = await client
		.from('email_communications')
		.insert([emailData])
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Retrieves email communications for a specific user (practitioner)
 * Useful for dashboard views showing email history
 *
 * @param userId - UUID of the user whose email communications to fetch
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<EmailCommunication[]> - Array of email communications
 * @throws Error if database operation fails
 */
export async function getEmailCommunicationsForUser(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<EmailCommunication[]> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('email_communications')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })

	if (error) throw error
	return data || []
}

/**
 * Retrieves email communications for a specific client
 * Useful for viewing communication history with a particular client
 *
 * @param clientId - UUID of the client
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<EmailCommunication[]> - Array of email communications
 * @throws Error if database operation fails
 */
export async function getEmailCommunicationsForClient(
	clientId: string,
	supabaseClient?: SupabaseClient
): Promise<EmailCommunication[]> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('email_communications')
		.select('*')
		.eq('client_id', clientId)
		.order('created_at', { ascending: false })

	if (error) throw error
	return data || []
}

/**
 * Retrieves email communications for a specific bill
 * Useful for tracking all emails sent related to a particular bill
 *
 * @param billId - UUID of the bill
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<EmailCommunication[]> - Array of email communications
 * @throws Error if database operation fails
 */
export async function getEmailCommunicationsForBill(
	billId: string,
	supabaseClient?: SupabaseClient
): Promise<EmailCommunication[]> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('email_communications')
		.select('*')
		.eq('bill_id', billId)
		.order('created_at', { ascending: false })

	if (error) throw error
	return data || []
}

/**
 * Retrieves email communications by status
 * Useful for finding failed emails that need retry or monitoring email health
 *
 * @param status - Status to filter by ('pending', 'sent', 'failed')
 * @param userId - Optional user ID to filter by specific practitioner
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<EmailCommunication[]> - Array of email communications
 * @throws Error if database operation fails
 */
export async function getEmailCommunicationsByStatus(
	status: 'pending' | 'sent' | 'failed',
	userId?: string,
	supabaseClient?: SupabaseClient
): Promise<EmailCommunication[]> {
	const client = supabaseClient || supabase

	let query = client
		.from('email_communications')
		.select('*')
		.eq('status', status)

	if (userId) {
		query = query.eq('user_id', userId)
	}

	const { data, error } = await query.order('created_at', {
		ascending: false
	})

	if (error) throw error
	return data || []
}

/**
 * Updates the status of an email communication
 * Used to mark emails as sent/failed after attempting to send them
 *
 * @param emailId - UUID of the email communication to update
 * @param status - New status ('pending', 'sent', 'failed')
 * @param errorMessage - Optional error message if status is 'failed'
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<EmailCommunication> - The updated email communication record
 * @throws Error if update fails
 */
export async function updateEmailCommunicationStatus(
	emailId: string,
	status: 'pending' | 'sent' | 'failed',
	errorMessage?: string | null,
	supabaseClient?: SupabaseClient
): Promise<EmailCommunication> {
	const client = supabaseClient || supabase

	const updateData: any = { status }

	// Set sent_at timestamp if marking as sent
	if (status === 'sent') {
		updateData.sent_at = new Date().toISOString()
		updateData.error_message = null // Clear any previous error
	}

	// Set error message if marking as failed
	if (status === 'failed' && errorMessage) {
		updateData.error_message = errorMessage
	}

	const { data, error } = await client
		.from('email_communications')
		.update(updateData)
		.eq('id', emailId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Retrieves a single email communication by ID
 *
 * @param emailId - UUID of the email communication
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<EmailCommunication | null> - The email communication or null if not found
 * @throws Error if database operation fails
 */
export async function getEmailCommunicationById(
	emailId: string,
	supabaseClient?: SupabaseClient
): Promise<EmailCommunication | null> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('email_communications')
		.select('*')
		.eq('id', emailId)
		.single()

	if (error) {
		if (error.code === 'PGRST116') return null // Not found
		throw error
	}

	return data
}

/**
 * Deletes an email communication record
 * Note: Consider using status updates instead of hard deletion for audit trails
 *
 * @param emailId - UUID of the email communication to delete
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<void>
 * @throws Error if deletion fails
 */
export async function deleteEmailCommunication(
	emailId: string,
	supabaseClient?: SupabaseClient
): Promise<void> {
	const client = supabaseClient || supabase

	const { error } = await client
		.from('email_communications')
		.delete()
		.eq('id', emailId)

	if (error) throw error
}

/**
 * Gets recent failed emails for a user that might need retry
 * Useful for dashboard alerts or automated retry systems
 *
 * @param userId - UUID of the user
 * @param hoursBack - How many hours back to look (default: 24)
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<EmailCommunication[]> - Array of recent failed emails
 * @throws Error if database operation fails
 */
export async function getRecentFailedEmails(
	userId: string,
	hoursBack: number = 24,
	supabaseClient?: SupabaseClient
): Promise<EmailCommunication[]> {
	const client = supabaseClient || supabase

	const cutoffTime = new Date()
	cutoffTime.setHours(cutoffTime.getHours() - hoursBack)

	const { data, error } = await client
		.from('email_communications')
		.select('*')
		.eq('user_id', userId)
		.eq('status', 'failed')
		.gte('created_at', cutoffTime.toISOString())
		.order('created_at', { ascending: false })

	if (error) throw error
	return data || []
}

/**
 * Gets email statistics for a user
 * Useful for dashboard metrics and monitoring
 *
 * @param userId - UUID of the user
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise with email stats
 * @throws Error if database operation fails
 */
export async function getEmailStatsForUser(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<{
	total: number
	sent: number
	failed: number
	pending: number
}> {
	const client = supabaseClient || supabase

	// Get counts by status
	const { data, error } = await client
		.from('email_communications')
		.select('status')
		.eq('user_id', userId)

	if (error) throw error

	const stats = {
		total: data?.length || 0,
		sent: data?.filter((row) => row.status === 'sent').length || 0,
		failed: data?.filter((row) => row.status === 'failed').length || 0,
		pending: data?.filter((row) => row.status === 'pending').length || 0
	}

	return stats
}
