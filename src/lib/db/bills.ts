/**
 * Bills Database Operations
 *
 * This module handles all database operations related to bills, including:
 * - Creating bills for consultation bookings
 * - Managing bill status transitions (pending → sent → paid)
 * - Retrieving bills for users, clients, and bookings
 * - Tracking bill lifecycle and due dates
 *
 * The bills system integrates with:
 * - Bookings: Each bill is associated with a specific booking
 * - Payment Sessions: Bills link to payment attempts
 * - Email Communications: Bills trigger email notifications
 * - Invoices: Bills can be aggregated into invoices
 */

import { Tables, TablesInsert, TablesUpdate } from '@/types/database.types'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
const supabase = createSupabaseClient()

/**
 * Type alias for the Bill table row structure
 * Provides type safety for bill data operations
 */
export type Bill = Tables<'bills'>

/**
 * Type alias for bill insertion payload
 * Used when creating new bills
 */
export type BillInsert = TablesInsert<'bills'>

/**
 * Type alias for bill update payload
 * Used when updating existing bills
 */
export type BillUpdate = TablesUpdate<'bills'>

/**
 * Interface for creating a new bill
 * Contains the essential information needed to track a consultation charge
 *
 * @interface CreateBillPayload
 * @property booking_id - UUID of the booking this bill is for
 * @property user_id - UUID of the practitioner who owns this bill
 * @property client_id - UUID of the client being billed (optional)
 * @property amount - Bill amount in euros
 * @property currency - Currency code (defaults to 'EUR')
 * @property client_name - Client name (snapshot at bill creation)
 * @property client_email - Client email (snapshot at bill creation)
 * @property billing_type - Type of billing (snapshot from booking)
 * @property notes - Optional notes or description
 */
export interface CreateBillPayload {
	booking_id: string
	user_id: string
	client_id?: string | null
	amount: number
	currency?: string
	client_name: string
	client_email: string
	billing_type: 'per_booking' | 'monthly'
	email_scheduled_at?: string | null
	notes?: string
}

/**
 * Interface for bill with booking information
 * Used when retrieving bills with related booking data
 */
export interface BillWithBooking extends Bill {
	booking: {
		id: string
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
 * Creates a new bill in the database
 *
 * @param payload - Bill data to insert
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<Bill> - The created bill object with generated ID
 * @throws Error if insertion fails or validation errors occur
 */
export async function createBill(payload: CreateBillPayload, supabaseClient?: SupabaseClient): Promise<Bill> {
	// Decide initial status:
	// - monthly => scheduled
	// - per-booking with future email_scheduled_at => scheduled
	// - otherwise => pending
	const nowIso = new Date().toISOString()
	const shouldStartScheduled =
		payload.billing_type === 'monthly' ||
		(!!payload.email_scheduled_at && payload.email_scheduled_at > nowIso && (payload.amount || 0) > 0)

	const billData = {
		booking_id: payload.booking_id,
		user_id: payload.user_id,
		client_id: payload.client_id || null,
		amount: payload.amount,
		currency: payload.currency || 'EUR',
		client_name: payload.client_name,
		client_email: payload.client_email,
		billing_type: payload.billing_type,
		email_scheduled_at: payload.email_scheduled_at || null,
		notes: payload.notes || null,
		status: (shouldStartScheduled ? 'scheduled' : 'pending') as 'scheduled' | 'pending'
	}

	// Use provided client or fall back to default
	const client = supabaseClient || supabase

	const { data, error } = await client.from('bills').insert([billData]).select().single()

	if (error) throw error
	return data
}

/**
 * Retrieves a bill by its ID
 *
 * @param billId - The UUID of the bill to retrieve
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<Bill | null> - The bill object or null if not found
 * @throws Error if database operation fails
 */
export async function getBillById(billId: string, supabaseClient?: SupabaseClient): Promise<Bill | null> {
	const client = supabaseClient || supabase

	const { data, error } = await client.from('bills').select('*').eq('id', billId).single()

	if (error) {
		if (error.code === 'PGRST116') return null // Not found
		throw error
	}
	return data
}

/**
 * Retrieves bills for a specific booking
 * A booking typically has one bill, but could have multiple in edge cases
 *
 * @param bookingId - The UUID of the booking
 * @returns Promise<Bill[]> - Array of bills for the booking
 * @throws Error if database operation fails
 */
export async function getBillsForBooking(bookingId: string, supabaseClient?: SupabaseClient): Promise<Bill[]> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('bills')
		.select('*')
		.eq('booking_id', bookingId)
		.order('created_at', { ascending: false })

	if (error) throw error
	return data || []
}

/**
 * Retrieves bills for a specific user (practitioner)
 * Optionally filtered by status
 *
 * @param userId - The UUID of the user whose bills to fetch
 * @param status - Optional status filter
 * @returns Promise<Bill[]> - Array of bills for the user
 * @throws Error if database operation fails
 */
export async function getBillsForUser(
	userId: string,
	status?: 'scheduled' | 'pending' | 'sent' | 'paid' | 'disputed' | 'canceled' | 'refunded'
): Promise<Bill[]> {
	let query = supabase.from('bills').select('*').eq('user_id', userId).order('created_at', { ascending: false })

	if (status) {
		query = query.eq('status', status)
	}

	const { data, error } = await query

	if (error) throw error
	return data || []
}

/**
 * Retrieves bills for a specific client
 * Optionally filtered by status
 *
 * @param clientId - The UUID of the client
 * @param status - Optional status filter
 * @returns Promise<Bill[]> - Array of bills for the client
 * @throws Error if database operation fails
 */
export async function getBillsForClient(
	clientId: string,
	status?: 'scheduled' | 'pending' | 'sent' | 'paid' | 'disputed' | 'canceled' | 'refunded'
): Promise<Bill[]> {
	let query = supabase.from('bills').select('*').eq('client_id', clientId).order('created_at', { ascending: false })

	if (status) {
		query = query.eq('status', status)
	}

	const { data, error } = await query

	if (error) throw error
	return data || []
}

/**
 * Helper used by monthly orchestration:
 * Returns monthly bills for a given (user, client) that are not yet linked to an invoice.
 * Embeds the booking start_time to allow period filtering by the caller.
 */
export async function getUnlinkedMonthlyBillsForUserClient(
	userId: string,
	clientId: string | null,
	supabaseClient?: SupabaseClient
): Promise<
	Array<{ id: string; amount: number; user_id: string; client_id: string | null; booking?: { start_time: string } }>
> {
	const client = supabaseClient || supabase
	let query = client
		.from('bills')
		.select(`id, amount, user_id, client_id, invoice_id, billing_type, booking:bookings(start_time)`)
		.eq('user_id', userId)
		.eq('billing_type', 'monthly')
		.is('invoice_id', null) as any

	query = clientId == null ? query.is('client_id', null) : query.eq('client_id', clientId)

	const { data, error } = await query

	if (error) throw error
	return (data as any[]) || []
}

/**
 * Links a set of bills to an invoice (sets invoice_id on those bills).
 */
export async function linkBillsToInvoice(
	billIds: string[],
	invoiceId: string,
	supabaseClient?: SupabaseClient
): Promise<void> {
	if (!billIds || billIds.length === 0) return
	const client = supabaseClient || supabase
	const { error } = await client.from('bills').update({ invoice_id: invoiceId }).in('id', billIds)
	if (error) throw error
}

/**
 * Returns bills linked to a specific invoice, including booking start_time for display purposes.
 */
export async function getBillsForInvoice(
	invoiceId: string,
	supabaseClient?: SupabaseClient
): Promise<Array<{ id: string; amount: number; currency?: string | null; booking?: { start_time: string } }>> {
	const client = supabaseClient || supabase
	const { data, error } = await client
		.from('bills')
		.select(`id, amount, currency, booking:bookings(start_time)`)
		.eq('invoice_id', invoiceId)

	if (error) throw error
	return (data as any[]) || []
}

/**
 * Retrieves bills with related booking information
 * Useful for dashboard views and comprehensive bill displays
 *
 * @param userId - The UUID of the user whose bills to fetch
 * @param status - Optional status filter
 * @returns Promise<BillWithBooking[]> - Array of bills with booking data
 * @throws Error if database operation fails
 */
export async function getBillsWithBookings(
	userId: string,
	status?: 'scheduled' | 'pending' | 'sent' | 'paid' | 'disputed' | 'canceled' | 'refunded'
): Promise<BillWithBooking[]> {
	let query = supabase
		.from('bills')
		.select(
			`
			*,
			booking:bookings(
				id,
				start_time,
				end_time,
				status,
				client:clients(id, name, email)
			)
		`
		)
		.eq('user_id', userId)
		.order('created_at', { ascending: false })

	if (status) {
		query = query.eq('status', status)
	}

	const { data, error } = await query

	if (error) throw error
	return data || []
}

/**
 * Retrieves overdue bills for a user
 * Bills are considered overdue if status is 'sent' and due_date has passed
 *
 * @param userId - Optional user ID to filter by (if not provided, gets all overdue bills)
 * @returns Promise<Bill[]> - Array of overdue bills
 * @throws Error if database operation fails
 */
export async function getOverdueBills(userId?: string): Promise<Bill[]> {
	let query = supabase
		.from('bills')
		.select('*')
		.eq('status', 'sent')
		.lt('due_date', new Date().toISOString())
		.order('due_date', { ascending: true })

	if (userId) {
		query = query.eq('user_id', userId)
	}

	const { data, error } = await query

	if (error) throw error
	return data || []
}

/**
 * Retrieves bills by status across all users
 * Useful for administrative operations and analytics
 *
 * @param status - The bill status to filter by
 * @param userId - Optional user ID to filter by specific user
 * @returns Promise<Bill[]> - Array of bills with the specified status
 * @throws Error if database operation fails
 */
export async function getBillsByStatus(
	status: 'scheduled' | 'pending' | 'sent' | 'paid' | 'disputed' | 'canceled' | 'refunded',
	userId?: string
): Promise<Bill[]> {
	let query = supabase.from('bills').select('*').eq('status', status).order('created_at', { ascending: false })

	if (userId) {
		query = query.eq('user_id', userId)
	}

	const { data, error } = await query

	if (error) throw error
	return data || []
}

/**
 * Updates a bill's status
 *
 * @param billId - The UUID of the bill to update
 * @param status - The new status for the bill
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<Bill> - The updated bill object
 * @throws Error if update fails or bill not found
 */
export async function updateBillStatus(
	billId: string,
	status: 'scheduled' | 'pending' | 'sent' | 'paid' | 'disputed' | 'canceled' | 'refunded',
	supabaseClient?: SupabaseClient
): Promise<Bill> {
	const updateData: any = { status }

	// Set timestamps based on status
	if (status === 'sent' && !updateData.sent_at) {
		updateData.sent_at = new Date().toISOString()
	} else if (status === 'paid' && !updateData.paid_at) {
		updateData.paid_at = new Date().toISOString()
	}

	// Use provided client or fall back to default
	const client = supabaseClient || supabase

	const { data, error } = await client.from('bills').update(updateData).eq('id', billId).select().single()

	if (error) throw error
	return data
}

/**
 * Marks a bill as sent to the client
 * Sets the sent_at timestamp and updates status to 'sent'
 *
 * @param billId - The UUID of the bill to mark as sent
 * @returns Promise<Bill> - The updated bill object
 * @throws Error if update fails or bill not found
 */
export async function markBillAsSent(billId: string): Promise<Bill> {
	const { data, error } = await supabase
		.from('bills')
		.update({
			status: 'sent',
			sent_at: new Date().toISOString()
		})
		.eq('id', billId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Marks a bill as paid
 * Sets the paid_at timestamp and updates status to 'paid'
 *
 * @param billId - The UUID of the bill to mark as paid
 * @returns Promise<Bill> - The updated bill object
 * @throws Error if update fails or bill not found
 */
export async function markBillAsPaid(billId: string, supabaseClient?: SupabaseClient): Promise<Bill> {
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('bills')
		.update({
			status: 'paid',
			paid_at: new Date().toISOString()
		})
		.eq('id', billId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Marks a bill as refunded
 * Sets refund tracking fields and updates status to 'refunded'
 *
 * @param billId - The UUID of the bill to mark as refunded
 * @param stripeRefundId - The Stripe refund ID for tracking
 * @param reason - Optional reason for the refund
 * @param supabaseClient - Optional SupabaseClient instance
 * @returns Promise<Bill> - The updated bill object
 * @throws Error if update fails or bill not found
 */
export async function markBillAsRefunded(
	billId: string,
	stripeRefundId: string,
	reason?: string,
	supabaseClient?: SupabaseClient
): Promise<Bill> {
	const client = supabaseClient || supabase

	// First, get the bill to set refunded_amount equal to the bill amount
	const bill = await getBillById(billId, supabaseClient)
	if (!bill) {
		throw new Error(`Bill with ID ${billId} not found`)
	}

	const { data, error } = await client
		.from('bills')
		.update({
			status: 'refunded',
			refunded_amount: bill.amount, // Full refund
			stripe_refund_id: stripeRefundId,
			refunded_at: new Date().toISOString(),
			refund_reason: reason || null
		})
		.eq('id', billId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Marks a bill as disputed
 * Updates status to 'disputed' for tracking payment disputes
 *
 * @param billId - The UUID of the bill to mark as disputed
 * @param notes - Optional notes about the dispute
 * @returns Promise<Bill> - The updated bill object
 * @throws Error if update fails or bill not found
 */
export async function markBillAsDisputed(billId: string, notes?: string): Promise<Bill> {
	const updateData: any = { status: 'disputed' }
	if (notes) {
		updateData.notes = notes
	}

	const { data, error } = await supabase.from('bills').update(updateData).eq('id', billId).select().single()

	if (error) throw error
	return data
}

/**
 * Cancels a bill
 * Updates status to 'canceled' for bills that should not be paid
 *
 * @param billId - The UUID of the bill to cancel
 * @param notes - Optional notes about the cancellation
 * @returns Promise<Bill> - The updated bill object
 * @throws Error if update fails or bill not found
 */
export async function cancelBill(billId: string, notes?: string): Promise<Bill> {
	const updateData: any = { status: 'canceled' }
	if (notes) {
		updateData.notes = notes
	}

	const { data, error } = await supabase.from('bills').update(updateData).eq('id', billId).select().single()

	if (error) throw error
	return data
}

/**
 * Cancels all bills for one or more bookings
 * Only cancels bills that aren't already paid or canceled (best-effort, non-throwing)
 * Used when cancelling bookings to ensure payment status is properly updated
 *
 * @param bookingIds - Single booking ID or array of booking IDs
 * @param supabaseClient - Optional Supabase client for database operations
 * @returns Promise<{ cancelled: number; skipped: number }> - Count of cancelled and skipped bills
 */
export async function cancelBillsForBookings(
	bookingIds: string | string[],
	supabaseClient?: SupabaseClient
): Promise<{ cancelled: number; skipped: number }> {
	const client = supabaseClient || supabase
	const ids = Array.isArray(bookingIds) ? bookingIds : [bookingIds]

	let cancelled = 0
	let skipped = 0

	try {
		// Get all bills for the given booking IDs
		const { data: bills, error } = await client
			.from('bills')
			.select('id, status')
			.in('booking_id', ids)

		if (error) {
			console.error(`Failed to fetch bills for bookings:`, error)
			return { cancelled, skipped }
		}

		if (!bills || bills.length === 0) {
			return { cancelled, skipped }
		}

		// Cancel bills that aren't already paid or canceled
		for (const bill of bills) {
			if (bill.status !== 'paid' && bill.status !== 'canceled') {
				try {
					await updateBillStatus(bill.id, 'canceled', supabaseClient)
					cancelled++
				} catch (updateError) {
					console.error(`Failed to cancel bill ${bill.id}:`, updateError)
					// Continue with other bills even if one fails
				}
			} else {
				skipped++
			}
		}
	} catch (error) {
		console.error(`Failed to cancel bills for bookings:`, error)
		// Return partial results even if there was an error
	}

	return { cancelled, skipped }
}

/**
 * Updates bill notes
 *
 * @param billId - The UUID of the bill to update
 * @param notes - The notes to add or update
 * @returns Promise<Bill> - The updated bill object
 * @throws Error if update fails or bill not found
 */
export async function updateBillNotes(billId: string, notes: string): Promise<Bill> {
	const { data, error } = await supabase.from('bills').update({ notes }).eq('id', billId).select().single()

	if (error) throw error
	return data
}

/**
 * Deletes a bill from the database
 * Note: Consider using status updates ('canceled') instead of hard deletion for audit trails
 *
 * @param billId - The UUID of the bill to delete
 * @returns Promise<void>
 * @throws Error if deletion fails or bill not found
 */
export async function deleteBill(billId: string, supabaseClient?: SupabaseClient): Promise<void> {
	const client = supabaseClient || supabase

	const { error } = await client.from('bills').delete().eq('id', billId)

	if (error) throw error
}

/**
 * Updates Stripe receipt metadata on a bill
 * - Persists stripe_charge_id and/or stripe_receipt_url
 */
export async function updateBillReceiptMetadata(
	billId: string,
	payload: {
		stripe_charge_id?: string | null
		stripe_receipt_url?: string | null
	},
	supabaseClient?: SupabaseClient
): Promise<Bill> {
	const client = supabaseClient || supabase
	const updateData: any = {}
	if (typeof payload.stripe_charge_id !== 'undefined') {
		updateData.stripe_charge_id = payload.stripe_charge_id
	}
	if (typeof payload.stripe_receipt_url !== 'undefined') {
		updateData.stripe_receipt_url = payload.stripe_receipt_url
	}

	const { data, error } = await client.from('bills').update(updateData).eq('id', billId).select().single()

	if (error) throw error
	return data
}

/**
 * Marks that the payment receipt email was sent for a bill
 */
export async function markBillReceiptEmailSent(billId: string, supabaseClient?: SupabaseClient): Promise<Bill> {
	const client = supabaseClient || supabase
	const { data, error } = await client
		.from('bills')
		.update({ stripe_receipt_email_sent_at: new Date().toISOString() })
		.eq('id', billId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Utility function to get bills due for reminder emails
 * Gets bills that are sent, overdue, but not too old (within last 90 days)
 *
 * @param userId - Optional user ID to filter by
 * @returns Promise<Bill[]> - Array of bills needing reminders
 * @throws Error if database operation fails
 */
export async function getBillsDueForReminder(userId?: string): Promise<Bill[]> {
	const now = new Date()
	const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

	let query = supabase
		.from('bills')
		.select('*')
		.eq('status', 'sent')
		.lt('due_date', now.toISOString())
		.gte('due_date', ninetyDaysAgo.toISOString())
		.order('due_date', { ascending: true })

	if (userId) {
		query = query.eq('user_id', userId)
	}

	const { data, error } = await query

	if (error) throw error
	return data || []
}

export async function getBillForBookingAndMarkAsPaid(
	bookingId: string,
	supabaseClient?: SupabaseClient
): Promise<Bill> {
	const bills = await getBillsForBooking(bookingId, supabaseClient)
	if (!bills || bills.length === 0) {
		console.log('Bill not found')
		throw new Error('Bill not found')
	}
	await markBillAsPaid(bills[0].id, supabaseClient)
	return bills[0]
}

/**
 * Atomically claims a small batch of bills whose payment emails are due to send.
 * Sets email_send_locked_at to now() to prevent concurrent senders from picking the same rows.
 *
 * @param nowIso ISO timestamp used for filtering and locking
 * @param limit Max number of rows to claim per run
 */
export async function claimDueBillsForEmail(
	nowIso: string,
	limit: number = 25,
	supabaseClient?: SupabaseClient
): Promise<Bill[]> {
	const client = supabaseClient || supabase
	const { data, error } = await client
		.from('bills')
		.update({ email_send_locked_at: nowIso })
		.lte('email_scheduled_at', nowIso)
		.is('sent_at', null)
		.in('status', ['scheduled', 'pending'] as any)
		.is('email_send_locked_at', null)
		.select('*')
		.limit(limit)
		.order('email_scheduled_at', { ascending: true })

	if (error) throw error
	return (data as any) || []
}

/**
 * Releases the send lock for a bill so it can be retried in a later run.
 */
export async function releaseBillEmailLock(billId: string, supabaseClient?: SupabaseClient): Promise<void> {
	const client = supabaseClient || supabase
	const { error } = await client.from('bills').update({ email_send_locked_at: null }).eq('id', billId)
	if (error) throw error
}
