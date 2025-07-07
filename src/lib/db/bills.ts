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
	billing_type: 'in-advance' | 'right-after' | 'monthly'
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
export async function createBill(
	payload: CreateBillPayload,
	supabaseClient?: SupabaseClient
): Promise<Bill> {
	const billData = {
		booking_id: payload.booking_id,
		user_id: payload.user_id,
		client_id: payload.client_id || null,
		amount: payload.amount,
		currency: payload.currency || 'EUR',
		client_name: payload.client_name,
		client_email: payload.client_email,
		billing_type: payload.billing_type,
		notes: payload.notes || null,
		status: 'pending' as const
	}

	// Use provided client or fall back to default
	const client = supabaseClient || supabase

	const { data, error } = await client
		.from('bills')
		.insert([billData])
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Retrieves a bill by its ID
 *
 * @param billId - The UUID of the bill to retrieve
 * @returns Promise<Bill | null> - The bill object or null if not found
 * @throws Error if database operation fails
 */
export async function getBillById(billId: string): Promise<Bill | null> {
	const { data, error } = await supabase
		.from('bills')
		.select('*')
		.eq('id', billId)
		.single()

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
export async function getBillsForBooking(
	bookingId: string,
	supabaseClient?: SupabaseClient
): Promise<Bill[]> {
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
	status?: 'pending' | 'sent' | 'paid' | 'disputed' | 'canceled'
): Promise<Bill[]> {
	let query = supabase
		.from('bills')
		.select('*')
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
	status?: 'pending' | 'sent' | 'paid' | 'disputed' | 'canceled'
): Promise<Bill[]> {
	let query = supabase
		.from('bills')
		.select('*')
		.eq('client_id', clientId)
		.order('created_at', { ascending: false })

	if (status) {
		query = query.eq('status', status)
	}

	const { data, error } = await query

	if (error) throw error
	return data || []
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
	status?: 'pending' | 'sent' | 'paid' | 'disputed' | 'canceled'
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
	status: 'pending' | 'sent' | 'paid' | 'disputed' | 'canceled',
	userId?: string
): Promise<Bill[]> {
	let query = supabase
		.from('bills')
		.select('*')
		.eq('status', status)
		.order('created_at', { ascending: false })

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
	status: 'pending' | 'sent' | 'paid' | 'disputed' | 'canceled',
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

	const { data, error } = await client
		.from('bills')
		.update(updateData)
		.eq('id', billId)
		.select()
		.single()

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
export async function markBillAsPaid(
	billId: string,
	supabaseClient?: SupabaseClient
): Promise<Bill> {
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
 * Marks a bill as disputed
 * Updates status to 'disputed' for tracking payment disputes
 *
 * @param billId - The UUID of the bill to mark as disputed
 * @param notes - Optional notes about the dispute
 * @returns Promise<Bill> - The updated bill object
 * @throws Error if update fails or bill not found
 */
export async function markBillAsDisputed(
	billId: string,
	notes?: string
): Promise<Bill> {
	const updateData: any = { status: 'disputed' }
	if (notes) {
		updateData.notes = notes
	}

	const { data, error } = await supabase
		.from('bills')
		.update(updateData)
		.eq('id', billId)
		.select()
		.single()

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
export async function cancelBill(
	billId: string,
	notes?: string
): Promise<Bill> {
	const updateData: any = { status: 'canceled' }
	if (notes) {
		updateData.notes = notes
	}

	const { data, error } = await supabase
		.from('bills')
		.update(updateData)
		.eq('id', billId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Updates bill notes
 *
 * @param billId - The UUID of the bill to update
 * @param notes - The notes to add or update
 * @returns Promise<Bill> - The updated bill object
 * @throws Error if update fails or bill not found
 */
export async function updateBillNotes(
	billId: string,
	notes: string
): Promise<Bill> {
	const { data, error } = await supabase
		.from('bills')
		.update({ notes })
		.eq('id', billId)
		.select()
		.single()

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
export async function deleteBill(
	billId: string,
	supabaseClient?: SupabaseClient
): Promise<void> {
	const client = supabaseClient || supabase

	const { error } = await client.from('bills').delete().eq('id', billId)

	if (error) throw error
}

/**
 * Utility function to check if a bill is overdue
 *
 * @param bill - The bill object to check
 * @returns boolean - True if the bill is overdue
 */
export function isBillOverdue(bill: Bill): boolean {
	if (bill.status !== 'sent' || !bill.due_date) return false
	return new Date() > new Date(bill.due_date)
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
