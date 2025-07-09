/**
 * Payment Sessions Database Operations
 *
 * This module handles all database operations related to payment sessions, including:
 * - Creating payment sessions when checkout is initiated
 * - Updating payment sessions when payments are completed
 * - Retrieving payment sessions for bookings and analysis
 * - Managing payment session status transitions
 *
 * The payment session system integrates with:
 * - Bookings: Each payment session is associated with a specific booking
 * - Stripe: Payment sessions track Stripe checkout sessions and payment intents
 * - Billing: Payment sessions represent the payment execution of billing settings
 */

import { Tables, TablesInsert, TablesUpdate } from '@/types/database.types'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
const supabase = createSupabaseClient()

/**
 * Type alias for the PaymentSession table row structure
 * Provides type safety for payment session data operations
 */
export type PaymentSession = Tables<'payment_sessions'>

/**
 * Type alias for payment session insertion payload
 * Used when creating new payment sessions
 */
export type PaymentSessionInsert = TablesInsert<'payment_sessions'>

/**
 * Type alias for payment session update payload
 * Used when updating existing payment sessions
 */
export type PaymentSessionUpdate = TablesUpdate<'payment_sessions'>

/**
 * Interface for creating a new payment session
 * Contains the essential information needed to track a payment
 *
 * @interface CreatePaymentSessionPayload
 * @property booking_id - UUID of the booking this payment is for
 * @property stripe_session_id - Stripe checkout session ID
 * @property amount - Payment amount in cents
 * @property status - Payment status (defaults to 'pending')
 * @property stripe_payment_intent_id - Stripe payment intent ID (optional)
 * @property completed_at - Timestamp when payment was completed (optional)
 */
export interface CreatePaymentSessionPayload {
	booking_id: string
	stripe_session_id: string
	amount: number
	status?: string
	stripe_payment_intent_id?: string | null
	completed_at?: string | null
}

/**
 * Interface for updating payment session status
 * Used when payment status changes (e.g., completed, failed)
 *
 * @interface UpdatePaymentSessionStatusPayload
 * @property status - New payment status
 * @property stripe_payment_intent_id - Stripe payment intent ID (when completed)
 * @property completed_at - Timestamp when payment was completed (when completed)
 */
export interface UpdatePaymentSessionStatusPayload {
	status?: string
	stripe_payment_intent_id?: string | null
	completed_at?: string | null
}

/**
 * Interface for payment session with booking information
 * Used when retrieving payment sessions with related booking data
 */
export interface PaymentSessionWithBooking extends PaymentSession {
	booking: {
		id: string
		user_id: string
		client_id: string
		start_time: string
		end_time: string
		status: string
		client: {
			id: string
			name: string
			email: string
		}
	}
}

/**
 * Creates a new payment session in the database
 * Typically called when a Stripe checkout session is created
 *
 * @param payload - Payment session data to insert
 * @param supabaseClient - Optional SupabaseClient instance for server-side usage
 * @returns Promise<PaymentSession> - The created payment session object with generated ID
 * @throws Error if insertion fails or validation errors occur
 */
export async function createPaymentSession(
	payload: CreatePaymentSessionPayload,
	supabaseClient?: SupabaseClient
): Promise<PaymentSession> {
	const client = supabaseClient || supabase
	const paymentSessionData = {
		booking_id: payload.booking_id,
		stripe_session_id: payload.stripe_session_id,
		amount: payload.amount,
		status: payload.status || 'pending',
		stripe_payment_intent_id: payload.stripe_payment_intent_id || null,
		completed_at: payload.completed_at || null
	}

	const { data, error } = await client
		.from('payment_sessions')
		.insert([paymentSessionData])
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Retrieves a payment session by its ID
 *
 * @param paymentSessionId - The UUID of the payment session to fetch
 * @returns Promise<PaymentSession | null> - The payment session object or null if not found
 * @throws Error if database operation fails
 */
export async function getPaymentSessionById(
	paymentSessionId: string
): Promise<PaymentSession | null> {
	const { data, error } = await supabase
		.from('payment_sessions')
		.select('*')
		.eq('id', paymentSessionId)
		.single()

	if (error) {
		if (error.code === 'PGRST116') return null // Not found
		throw error
	}
	return data
}

/**
 * Retrieves a payment session by Stripe session ID
 * Commonly used in webhooks to update payment status
 *
 * @param stripeSessionId - The Stripe checkout session ID
 * @returns Promise<PaymentSession | null> - The payment session object or null if not found
 * @throws Error if database operation fails
 */
export async function getPaymentSessionByStripeSessionId(
	stripeSessionId: string
): Promise<PaymentSession | null> {
	const { data, error } = await supabase
		.from('payment_sessions')
		.select('*')
		.eq('stripe_session_id', stripeSessionId)
		.single()

	if (error) {
		if (error.code === 'PGRST116') return null // Not found
		throw error
	}
	return data
}

/**
 * Retrieves payment sessions for a specific booking
 * A booking may have multiple payment sessions (retries, refunds, etc.)
 *
 * @param bookingId - The UUID of the booking
 * @returns Promise<PaymentSession[]> - Array of payment sessions for the booking
 * @throws Error if database operation fails
 */
export async function getPaymentSessionsForBooking(
	bookingId: string
): Promise<PaymentSession[]> {
	const { data, error } = await supabase
		.from('payment_sessions')
		.select('*')
		.eq('booking_id', bookingId)
		.order('created_at', { ascending: false })

	if (error) throw error
	return data || []
}

/**
 * Retrieves payment sessions for a specific user
 * Includes related booking and client information
 *
 * @param userId - The UUID of the user whose payment sessions to fetch
 * @returns Promise<PaymentSessionWithBooking[]> - Array of payment sessions with booking data
 * @throws Error if database operation fails
 */
export async function getPaymentSessionsForUser(
	userId: string
): Promise<PaymentSessionWithBooking[]> {
	const { data, error } = await supabase
		.from('payment_sessions')
		.select(
			`
			*,
			booking:bookings(
				id,
				user_id,
				client_id,
				start_time,
				end_time,
				status,
				client:clients(id, name, email)
			)
		`
		)
		.eq('booking.user_id', userId)
		.order('created_at', { ascending: false })

	if (error) throw error
	return data || []
}

/**
 * Updates a payment session status and related fields
 * Commonly used when payment status changes (completed, failed, etc.)
 *
 * @param paymentSessionId - The UUID of the payment session to update
 * @param updatePayload - Data to update
 * @returns Promise<PaymentSession> - The updated payment session object
 * @throws Error if update fails or payment session not found
 */
export async function updatePaymentSessionStatus(
	paymentSessionId: string,
	updatePayload: UpdatePaymentSessionStatusPayload
): Promise<PaymentSession> {
	const { data, error } = await supabase
		.from('payment_sessions')
		.update(updatePayload)
		.eq('id', paymentSessionId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Updates a payment session by Stripe session ID
 * Commonly used in webhooks where we have the Stripe session ID but not our internal ID
 *
 * @param stripeSessionId - The Stripe checkout session ID
 * @param updatePayload - Data to update
 * @param supabaseClient - Optional SupabaseClient instance for server-side usage
 * @returns Promise<PaymentSession> - The updated payment session object
 * @throws Error if update fails or payment session not found
 */
export async function updatePaymentSessionByStripeSessionId(
	stripeSessionId: string,
	updatePayload: UpdatePaymentSessionStatusPayload,
	supabaseClient?: SupabaseClient
): Promise<PaymentSession> {
	const client = supabaseClient || supabase
	const { data, error } = await client
		.from('payment_sessions')
		.update(updatePayload)
		.eq('stripe_session_id', stripeSessionId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Marks a payment session as completed
 * Helper function that sets status to 'completed' and completed_at timestamp
 *
 * @param stripeSessionId - The Stripe checkout session ID
 * @param stripePaymentIntentId - The Stripe payment intent ID
 * @param supabaseClient - Optional SupabaseClient instance for server-side usage
 * @returns Promise<PaymentSession> - The updated payment session object
 * @throws Error if update fails or payment session not found
 */
export async function markPaymentSessionCompleted(
	stripeSessionId: string,
	stripePaymentIntentId: string,
	supabaseClient?: SupabaseClient
): Promise<PaymentSession> {
	return updatePaymentSessionByStripeSessionId(
		stripeSessionId,
		{
			status: 'completed',
			stripe_payment_intent_id: stripePaymentIntentId,
			completed_at: new Date().toISOString()
		},
		supabaseClient
	)
}

/**
 * Marks a payment session as failed
 * Helper function that sets status to 'failed'
 *
 * @param stripeSessionId - The Stripe checkout session ID
 * @returns Promise<PaymentSession> - The updated payment session object
 * @throws Error if update fails or payment session not found
 */
export async function markPaymentSessionFailed(
	stripeSessionId: string
): Promise<PaymentSession> {
	return updatePaymentSessionByStripeSessionId(stripeSessionId, {
		status: 'failed'
	})
}

/**
 * Deletes a payment session from the database
 * Use with caution - typically payment sessions should be marked as canceled rather than deleted
 *
 * @param paymentSessionId - The UUID of the payment session to delete
 * @returns Promise<void>
 * @throws Error if deletion fails or payment session not found
 */
export async function deletePaymentSession(
	paymentSessionId: string
): Promise<void> {
	const { error } = await supabase
		.from('payment_sessions')
		.delete()
		.eq('id', paymentSessionId)

	if (error) throw error
}

/**
 * Retrieves payment sessions by status
 * Useful for monitoring and analytics
 *
 * @param status - The payment status to filter by
 * @param userId - Optional user ID to filter by user
 * @returns Promise<PaymentSession[]> - Array of payment sessions with the specified status
 * @throws Error if database operation fails
 */
export async function getPaymentSessionsByStatus(
	status: string,
	userId?: string
): Promise<PaymentSession[]> {
	let query = supabase
		.from('payment_sessions')
		.select('*')
		.eq('status', status)
		.order('created_at', { ascending: false })

	if (userId) {
		query = query.eq('booking.user_id', userId)
	}

	const { data, error } = await query

	if (error) throw error
	return data || []
}
