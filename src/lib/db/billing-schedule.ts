/**
 * Billing Schedule Database Operations
 *
 * This module manages the billing_schedule table which optimizes cron job performance
 * by pre-calculating when billing actions should occur instead of scanning all bookings.
 */

import { supabase } from '@/lib/supabase'

export type BillingScheduleAction =
	| 'send_bill'
	| 'payment_reminder'
	| 'overdue_notice'
export type BillingScheduleStatus =
	| 'pending'
	| 'completed'
	| 'failed'
	| 'cancelled'

export interface BillingScheduleEntry {
	id: string
	booking_id: string
	action_type: BillingScheduleAction
	scheduled_date: string
	status: BillingScheduleStatus
	processed_at?: string
	retry_count: number
	max_retries: number
	created_at: string
	updated_at: string
}

/**
 * Schedules a billing action for a specific booking
 *
 * @param bookingId - UUID of the booking
 * @param actionType - Type of billing action to schedule
 * @param scheduledDate - Date when the action should be performed (YYYY-MM-DD)
 * @returns Promise<BillingScheduleEntry> - The created schedule entry
 */
export async function scheduleBillingAction(
	bookingId: string,
	actionType: BillingScheduleAction,
	scheduledDate: string
): Promise<BillingScheduleEntry> {
	const { data, error } = await supabase
		.from('billing_schedule')
		.insert({
			booking_id: bookingId,
			action_type: actionType,
			scheduled_date: scheduledDate,
			status: 'pending'
		})
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Gets all pending billing actions for a specific date with billing settings
 * Used by cron jobs to process daily billing tasks
 *
 * @param date - Date to process (YYYY-MM-DD)
 * @returns Promise<Array> - Array of pending actions with billing frequency info
 */
export async function getPendingBillingActions(date: string) {
	const { data, error } = await supabase
		.from('billing_schedule')
		.select(
			`
      *,
      booking:bookings(
        id,
        user_id,
        client_id,
        start_time,
        end_time,
        billing_status,
        payment_status,
        billing_settings_id,
        client:clients(id, name, email),
        billing_settings:billing_settings(
          id,
          billing_frequency,
          billing_amount,
          billing_type,
          should_bill
        )
      )
    `
		)
		.eq('scheduled_date', date)
		.eq('status', 'pending')
		.order('created_at', { ascending: true })

	if (error) throw error
	return data || []
}

/**
 * Marks a billing action as completed
 *
 * @param scheduleId - UUID of the schedule entry
 * @returns Promise<BillingScheduleEntry> - Updated schedule entry
 */
export async function markBillingActionCompleted(
	scheduleId: string
): Promise<BillingScheduleEntry> {
	const { data, error } = await supabase
		.from('billing_schedule')
		.update({
			status: 'completed',
			processed_at: new Date().toISOString()
		})
		.eq('id', scheduleId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Marks a billing action as failed and increments retry count
 *
 * @param scheduleId - UUID of the schedule entry
 * @returns Promise<BillingScheduleEntry> - Updated schedule entry
 */
export async function markBillingActionFailed(
	scheduleId: string
): Promise<BillingScheduleEntry> {
	// First get current retry count
	const { data: current, error: fetchError } = await supabase
		.from('billing_schedule')
		.select('retry_count')
		.eq('id', scheduleId)
		.single()

	if (fetchError) throw fetchError

	// Update with incremented retry count
	const { data, error } = await supabase
		.from('billing_schedule')
		.update({
			status: 'failed',
			retry_count: (current.retry_count || 0) + 1,
			processed_at: new Date().toISOString()
		})
		.eq('id', scheduleId)
		.select()
		.single()

	if (error) throw error
	return data
}

/**
 * Ensures a date is in the future, if not, sets it to a few hours from now
 *
 * @param date - Date to check
 * @returns Date - Future date
 */
function ensureFutureDate(date: Date): Date {
	const now = new Date()
	if (date <= now) {
		// Set to 2 hours from now if the calculated date is in the past
		const futureDate = new Date(now.getTime() + 2 * 60 * 60 * 1000)
		return futureDate
	}
	return date
}

/**
 * Calculates the billing due date based on billing frequency and trigger
 *
 * @param bookingStartTime - Start time of the booking (ISO string)
 * @param bookingEndTime - End time of the booking (ISO string)
 * @param billingFrequency - Billing frequency from settings
 * @param billingTrigger - When to bill ('before_consultation', 'after_consultation', or null for recurring)
 * @param billingAdvanceDays - Days before/after booking for per_session billing
 * @returns string - Due date in YYYY-MM-DD format
 */
function calculateBillingDueDate(
	bookingStartTime: string,
	bookingEndTime: string,
	billingFrequency: string,
	billingTrigger: string | null,
	billingAdvanceDays: number = 7
): string {
	const bookingStart = new Date(bookingStartTime)
	const bookingEnd = new Date(bookingEndTime)

	switch (billingFrequency) {
		case 'per_session':
			let sessionDue: Date

			if (billingTrigger === 'before_consultation') {
				// X days before the booking
				sessionDue = new Date(bookingStart)
				sessionDue.setDate(sessionDue.getDate() - billingAdvanceDays)
			} else if (billingTrigger === 'after_consultation') {
				// X days after the booking ends (or immediately if 0 days)
				sessionDue = new Date(bookingEnd)
				sessionDue.setDate(sessionDue.getDate() + billingAdvanceDays)
			} else {
				// Default to before if trigger is unclear
				sessionDue = new Date(bookingStart)
				sessionDue.setDate(sessionDue.getDate() - billingAdvanceDays)
			}

			// Ensure the date is in the future
			sessionDue = ensureFutureDate(sessionDue)
			return sessionDue.toISOString().split('T')[0]

		case 'weekly':
			// End of the week containing the booking
			const weekEnd = new Date(bookingStart)
			const dayOfWeek = weekEnd.getDay() // 0 = Sunday, 6 = Saturday
			const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
			weekEnd.setDate(weekEnd.getDate() + daysToSunday)
			return ensureFutureDate(weekEnd).toISOString().split('T')[0]

		case 'monthly':
			// End of the month containing the booking
			const monthEnd = new Date(
				bookingStart.getFullYear(),
				bookingStart.getMonth() + 1,
				0
			)
			return ensureFutureDate(monthEnd).toISOString().split('T')[0]

		default:
			throw new Error(`Unknown billing frequency: ${billingFrequency}`)
	}
}

/**
 * Automatically schedules billing actions when a booking is created
 * Based on the booking's billing settings and frequency
 *
 * @param bookingId - UUID of the booking
 * @param bookingStartTime - Start time of the booking (ISO string)
 * @param bookingEndTime - End time of the booking (ISO string)
 * @param billingFrequency - Billing frequency ('per_session', 'weekly', 'monthly')
 * @param billingTrigger - When to bill ('before_consultation', 'after_consultation', or null)
 * @param billingAdvanceDays - Days before/after booking to send bill (default: 7)
 * @returns Promise<BillingScheduleEntry[]> - Array of created schedule entries
 */
export async function autoScheduleBillingActions(
	bookingId: string,
	bookingStartTime: string,
	bookingEndTime: string,
	billingFrequency: string,
	billingTrigger: string | null,
	billingAdvanceDays: number = 7
): Promise<BillingScheduleEntry[]> {
	const bookingDate = new Date(bookingStartTime)
	const scheduleEntries: BillingScheduleEntry[] = []

	// Calculate billing due date based on frequency and trigger
	const billDueDate = calculateBillingDueDate(
		bookingStartTime,
		bookingEndTime,
		billingFrequency,
		billingTrigger,
		billingAdvanceDays
	)

	const billEntry = await scheduleBillingAction(
		bookingId,
		'send_bill',
		billDueDate
	)
	scheduleEntries.push(billEntry)

	// Schedule payment reminder (1 day after booking - same for all frequencies)
	const reminderDate = new Date(bookingDate)
	reminderDate.setDate(reminderDate.getDate() + 1)

	const reminderEntry = await scheduleBillingAction(
		bookingId,
		'payment_reminder',
		reminderDate.toISOString().split('T')[0]
	)
	scheduleEntries.push(reminderEntry)

	// Schedule overdue notice (7 days after booking - same for all frequencies)
	const overdueDate = new Date(bookingDate)
	overdueDate.setDate(overdueDate.getDate() + 7)

	const overdueEntry = await scheduleBillingAction(
		bookingId,
		'overdue_notice',
		overdueDate.toISOString().split('T')[0]
	)
	scheduleEntries.push(overdueEntry)

	return scheduleEntries
}

/**
 * Cancels all pending billing actions for a booking
 * Used when a booking is cancelled or billing settings change
 *
 * @param bookingId - UUID of the booking
 * @returns Promise<number> - Number of cancelled actions
 */
export async function cancelBillingActions(bookingId: string): Promise<number> {
	const { data, error } = await supabase
		.from('billing_schedule')
		.update({ status: 'cancelled' })
		.eq('booking_id', bookingId)
		.eq('status', 'pending')
		.select()

	if (error) throw error
	return data?.length || 0
}

/**
 * Groups pending billing actions by frequency for cron job processing
 *
 * @param date - Date to process (YYYY-MM-DD)
 * @returns Promise<Object> - Grouped actions by billing frequency
 */
export async function groupBillingActionsByFrequency(date: string) {
	const actions = await getPendingBillingActions(date)

	const grouped = {
		per_session: [] as any[],
		weekly: [] as any[],
		monthly: [] as any[]
	}

	actions.forEach((action: any) => {
		const frequency =
			action.booking?.billing_settings?.billing_frequency || 'per_session'
		if (grouped[frequency as keyof typeof grouped]) {
			grouped[frequency as keyof typeof grouped].push(action)
		}
	})

	// Further group weekly/monthly by client_id for aggregation
	return {
		per_session: grouped.per_session,
		weekly: groupByClientId(grouped.weekly),
		monthly: groupByClientId(grouped.monthly)
	}
}

/**
 * Helper function to group actions by client_id
 *
 * @param actions - Array of billing actions
 * @returns Object - Actions grouped by client_id
 */
function groupByClientId(actions: any[]) {
	return actions.reduce((groups, action) => {
		const clientId = action.booking?.client_id
		if (!groups[clientId]) {
			groups[clientId] = []
		}
		groups[clientId].push(action)
		return groups
	}, {} as Record<string, any[]>)
}
