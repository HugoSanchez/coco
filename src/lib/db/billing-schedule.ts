/**
 * Billing Schedule Database Operations
 *
 * This module manages the billing_schedule table which optimizes cron job performance
 * by pre-calculating when billing actions should occur instead of scanning all bookings.
 */

import { createClient as createSupabaseClient } from '@/lib/supabase/client'
const supabase = createSupabaseClient()

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
 * Gets all pending billing actions that should be processed now
 * Used by cron jobs to process billing tasks that are due
 *
 * @param currentDateTime - Current datetime (ISO string, optional - defaults to now)
 * @returns Promise<Array> - Array of pending actions with billing frequency info
 */
export async function getPendingBillingActions(currentDateTime?: string) {
	const now = currentDateTime || new Date().toISOString()

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
		.lte('scheduled_date', now) // Actions scheduled for now or earlier
		.eq('status', 'pending')
		.order('scheduled_date', { ascending: true })

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
 * Calculates when to send the bill based on billing frequency and trigger
 * Returns full ISO datetime string for precise scheduling
 *
 * @param bookingStartTime - Start time of the booking (ISO string)
 * @param bookingEndTime - End time of the booking (ISO string)
 * @param billingFrequency - Billing frequency ('per_session', 'weekly', 'monthly')
 * @param billingTrigger - When to bill ('before_consultation', 'after_consultation', or null)
 * @param billingAdvanceDays - Days before booking for 'before_consultation' (default: 7)
 * @returns string - ISO datetime string when to send the bill
 */
function calculateBillingSendDateTime(
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
			if (billingTrigger === 'before_consultation') {
				// X days before the booking
				const beforeDate = new Date(bookingStart)
				beforeDate.setDate(beforeDate.getDate() - billingAdvanceDays)
				beforeDate.setHours(9, 0, 0, 0) // Send at 9 AM
				return ensureFutureDate(beforeDate).toISOString()
			} else if (billingTrigger === 'after_consultation') {
				// Within the hour after consultation ends
				const afterDate = new Date(bookingEnd)
				afterDate.setMinutes(afterDate.getMinutes() + 30) // 30 minutes after
				return ensureFutureDate(afterDate).toISOString()
			} else {
				// Default to before if trigger is unclear
				const defaultDate = new Date(bookingStart)
				defaultDate.setDate(defaultDate.getDate() - billingAdvanceDays)
				defaultDate.setHours(9, 0, 0, 0)
				return ensureFutureDate(defaultDate).toISOString()
			}

		case 'weekly':
			// Last day of the week containing the booking
			const weekEnd = new Date(bookingStart)
			const dayOfWeek = weekEnd.getDay() // 0 = Sunday, 6 = Saturday
			const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
			weekEnd.setDate(weekEnd.getDate() + daysToSunday)
			weekEnd.setHours(18, 0, 0, 0) // Send at 6 PM on Sunday
			return ensureFutureDate(weekEnd).toISOString()

		case 'monthly':
			// Last day of the month containing the booking
			const monthEnd = new Date(
				bookingStart.getFullYear(),
				bookingStart.getMonth() + 1,
				0
			)
			monthEnd.setHours(18, 0, 0, 0) // Send at 6 PM on last day
			return ensureFutureDate(monthEnd).toISOString()

		default:
			throw new Error(`Unknown billing frequency: ${billingFrequency}`)
	}
}

/**
 * Automatically schedules billing action when a booking is created
 * Creates a single entry for when to send the bill with payment instructions
 *
 * @param bookingId - UUID of the booking
 * @param bookingStartTime - Start time of the booking (ISO string)
 * @param bookingEndTime - End time of the booking (ISO string)
 * @param billingFrequency - Billing frequency ('per_session', 'weekly', 'monthly')
 * @param billingTrigger - When to bill ('before_consultation', 'after_consultation', or null)
 * @param billingAdvanceDays - Days before booking to send bill for 'before_consultation' (default: 7)
 * @returns Promise<BillingScheduleEntry> - The created schedule entry
 */
export async function autoScheduleBillingActions(
	bookingId: string,
	bookingStartTime: string,
	bookingEndTime: string,
	billingFrequency: string,
	billingTrigger: string | null,
	billingAdvanceDays: number = 7
): Promise<BillingScheduleEntry> {
	// Calculate when to send the bill
	const billDateTime = calculateBillingSendDateTime(
		bookingStartTime,
		bookingEndTime,
		billingFrequency,
		billingTrigger,
		billingAdvanceDays
	)

	// Create single billing schedule entry
	const billEntry = await scheduleBillingAction(
		bookingId,
		'send_bill',
		billDateTime
	)

	return billEntry
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
 * @param currentDateTime - Current datetime (ISO string, optional - defaults to now)
 * @returns Promise<Object> - Grouped actions by billing frequency
 */
export async function groupBillingActionsByFrequency(currentDateTime?: string) {
	const actions = await getPendingBillingActions(currentDateTime)

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
