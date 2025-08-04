/**
 * Simple Booking Creation Service
 *
 * Creates bookings with a simple billing hierarchy:
 * 1. Client-specific billing settings (if they exist)
 * 2. User default billing settings (fallback)
 * 3. Auto-created default settings (if none exist)
 *
 * Uses SNAPSHOT APPROACH:
 * - Billing data is copied from billing_settings into the booking record
 * - Bookings become independent of future billing settings changes
 * - billing_settings_id is stored for audit trail
 * - Original billing terms are preserved forever
 *
 * Based on billing type, calls the appropriate creation function.
 */

import {
	createBooking,
	CreateBookingPayload,
	Booking,
	deleteBooking
} from '@/lib/db/bookings'
import {
	getClientBillingSettings,
	getUserDefaultBillingSettings
} from '@/lib/db/billing-settings'
import { getClientById } from '@/lib/db/clients'
import {
	createBill,
	CreateBillPayload,
	Bill,
	updateBillStatus,
	deleteBill
} from '@/lib/db/bills'
import { sendConsultationBillEmail } from '@/lib/emails/email-service'
import { getProfileById } from '@/lib/db/profiles'

import { createEmailCommunication } from '@/lib/db/email-communications'
import { createPendingCalendarEvent } from '@/lib/calendar/calendar'
import { createCalendarEvent } from '@/lib/db/calendar-events'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Interface for creating a booking
 */
export interface CreateBookingRequest {
	userId: string
	clientId: string
	startTime: string
	endTime: string
	notes?: string
	status?: 'pending' | 'scheduled' | 'completed' | 'canceled'
}

/**
 * Result of booking creation
 */
export interface CreateBookingResult {
	booking: Booking
	bill: Bill
	requiresPayment: boolean
	paymentUrl?: string
	warning?: string // Optional warning message for user
}

/**
 * Gets billing settings for a booking (client-specific or user default)
 * Returns the full billing settings record including ID for proper referential integrity
 * Throws error if no billing settings exist (users must have billing settings configured)
 */
async function getAppropriateBillingSettings(
	userId: string,
	clientId: string,
	supabaseClient?: SupabaseClient
) {
	// Check if client has specific billing settings
	const clientBilling = await getClientBillingSettings(
		userId,
		clientId,
		supabaseClient
	)

	if (clientBilling) {
		return {
			id: clientBilling.id,
			type: clientBilling.billing_type,
			amount: clientBilling.billing_amount || 0,
			currency: clientBilling.currency
		}
	}

	// Fall back to user default billing settings
	const userDefaultSettings = await getUserDefaultBillingSettings(
		userId,
		supabaseClient
	)

	if (userDefaultSettings) {
		return {
			id: userDefaultSettings.id,
			type: userDefaultSettings.billing_type,
			amount: userDefaultSettings.billing_amount || 0,
			currency: userDefaultSettings.currency
		}
	}

	// No billing settings found - this should not happen in production
	throw new Error(
		'No billing settings found for user or client. Please configure billing settings before creating bookings.'
	)
}

/**
 * Creates a bill for a booking
 * Inmediately after creating a booking, a bill is created for the booking
 * This function handles that.
 */
async function createBillForBooking(
	booking: Booking,
	billing: any,
	clientId: string,
	supabaseClient?: SupabaseClient
): Promise<Bill> {
	// Get client information
	const client = await getClientById(clientId, supabaseClient)
	if (!client) {
		throw new Error(`Client not found: ${clientId}`)
	}

	const billPayload: CreateBillPayload = {
		booking_id: booking.id,
		user_id: booking.user_id,
		client_id: clientId,
		client_name: client.name,
		client_email: client.email,
		amount: billing.amount,
		currency: billing.currency,
		billing_type: billing.type as 'in-advance' | 'right-after' | 'monthly'
	}

	return await createBill(billPayload, supabaseClient)
}

/**
 * Creates a booking with in-advance payment
 * Enhanced with complete payment link generation and email sending
 */
async function createInAdvanceBooking(
	request: CreateBookingRequest,
	billing: any,
	supabaseClient?: SupabaseClient
): Promise<CreateBookingResult> {
	const bookingPayload: CreateBookingPayload = {
		user_id: request.userId,
		client_id: request.clientId,
		start_time: request.startTime,
		end_time: request.endTime,
		status: 'pending' // Pending until payment
	}

	const booking = await createBooking(bookingPayload, supabaseClient)

	// Create bill for this booking with 'pending' status
	const bill = await createBillForBooking(
		booking,
		billing,
		request.clientId,
		supabaseClient
	)

	// Create pending calendar event to reserve the time slot
	// This prevents double-booking while payment is being processed
	try {
		const client = await getClientById(request.clientId, supabaseClient)
		const practitioner = await getProfileById(
			request.userId,
			supabaseClient
		)

		if (!client) {
			throw new Error(`Client not found: ${request.clientId}`)
		}

		if (!practitioner) {
			throw new Error(`Practitioner profile not found: ${request.userId}`)
		}

		console.log(
			'🗓️ [Booking] Starting calendar event creation for user:',
			request.userId,
			'client:',
			client.name
		)

		let pendingEventResult
		try {
			pendingEventResult = await createPendingCalendarEvent(
				{
					userId: request.userId,
					clientName: client.name,
					practitionerEmail: practitioner.email,
					startTime: request.startTime,
					endTime: request.endTime
				},
				supabaseClient
			)
			console.log(
				'✅ [Booking] Calendar event created successfully for user:',
				request.userId,
				'Event ID:',
				pendingEventResult.googleEventId
			)
		} catch (error) {
			console.error(
				'❌ [Booking] Calendar event creation failed for user:',
				request.userId,
				'Error:',
				error
			)

			// Provide specific guidance for common errors
			let calendarWarning: string | undefined
			if (
				error instanceof Error &&
				error.message.includes('Calendar access expired')
			) {
				console.log(
					'💡 [Booking] User needs to reconnect Google Calendar:',
					request.userId
				)
				calendarWarning =
					'Your Google Calendar connection has expired. Please reconnect it in your settings to enable automatic calendar events.'
			}

			// Continue without calendar event - don't block booking creation
			pendingEventResult = { success: false, googleEventId: null }
		}

		if (pendingEventResult.success && pendingEventResult.googleEventId) {
			// Store the pending calendar event in database
			await createCalendarEvent(
				{
					booking_id: booking.id,
					user_id: request.userId,
					google_event_id: pendingEventResult.googleEventId,
					event_type: 'pending',
					event_status: 'created'
				},
				supabaseClient
			)

			console.log(
				`Pending calendar event created for booking ${booking.id}: ${pendingEventResult.googleEventId}`
			)
		} else {
			console.error(
				`Failed to create pending calendar event for booking ${booking.id}:`,
				pendingEventResult.error
			)
		}
	} catch (calendarError) {
		// Don't fail the booking creation if calendar event fails
		console.error(
			`Pending calendar creation error for booking ${booking.id}:`,
			calendarError
		)
	}

	// If amount > 0, requires payment - create payment session and send email
	const requiresPayment = billing.amount > 0

	if (requiresPayment) {
		try {
			// Get client and practitioner info for payment session
			const client = await getClientById(request.clientId, supabaseClient)
			const practitioner = await getProfileById(
				request.userId,
				supabaseClient
			)

			if (!client) {
				throw new Error(`Client not found: ${request.clientId}`)
			}

			if (!practitioner) {
				throw new Error(
					`Practitioner profile not found: ${request.userId}`
				)
			}

			// Generate payment gateway URL (no need to create checkout session upfront)
			const baseUrl =
				process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
			const paymentGatewayUrl = `${baseUrl}/api/payments/${booking.id}`

			// Send consultation bill email with payment gateway link
			const emailResult = await sendConsultationBillEmail({
				to: client.email,
				clientName: client.name,
				consultationDate: request.startTime,
				amount: billing.amount,
				billingTrigger: 'before_consultation',
				practitionerName: practitioner.name || 'Your Practitioner',
				practitionerEmail: practitioner.email,
				practitionerImageUrl:
					practitioner.profile_picture_url || undefined,
				paymentUrl: paymentGatewayUrl
			})

			if (emailResult.success) {
				// Update bill status to 'sent' since email was delivered
				await updateBillStatus(bill.id, 'sent', supabaseClient)

				// Track successful email communication
				try {
					await createEmailCommunication(
						{
							user_id: booking.user_id,
							client_id: booking.client_id,
							bill_id: bill.id,
							booking_id: booking.id,
							email_type: 'consultation_bill',
							recipient_email: client.email,
							recipient_name: client.name,
							status: 'sent'
						},
						supabaseClient
					)
				} catch (trackingError) {
					// Log tracking failure but don't break the flow
					console.error(
						'Failed to track successful email:',
						trackingError
					)
				}

				return {
					booking,
					bill,
					requiresPayment: true,
					paymentUrl: paymentGatewayUrl
				}
			} else {
				// Track failed email communication
				try {
					await createEmailCommunication(
						{
							user_id: booking.user_id,
							client_id: booking.client_id,
							bill_id: bill.id,
							booking_id: booking.id,
							email_type: 'consultation_bill',
							recipient_email: client.email,
							recipient_name: client.name,
							status: 'failed',
							error_message:
								emailResult.error || 'Email sending failed'
						},
						supabaseClient
					)
				} catch (trackingError) {
					// Log tracking failure but don't break the flow
					console.error(
						'Failed to track failed email:',
						trackingError
					)
				}

				// Email failed - throw error to trigger cleanup
				const emailError = new Error(
					`EMAIL_SEND_FAILED: Unable to send payment email to ${client.email}`
				)
				emailError.name = 'EmailSendError'
				throw emailError
			}
		} catch (error) {
			console.error(
				`Error in payment flow for booking ${booking.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
			)

			// Cleanup: Delete the booking and bill we created
			try {
				await deleteBooking(booking.id, supabaseClient)
				await deleteBill(bill.id, supabaseClient)
			} catch (cleanupError) {
				console.error(
					`Cleanup failed for booking ${booking.id}:`,
					cleanupError
				)
				// Don't throw cleanup errors - original error is more important
			}

			// Re-throw the original error so the API route can handle it
			throw error
		}
	}

	// No payment required (amount = 0), mark as scheduled immediately
	return {
		booking,
		bill,
		requiresPayment: false
	}
}

/**
 * Creates a booking with right-after billing
 */
async function createRightAfterBooking(
	request: CreateBookingRequest,
	billing: any,
	supabaseClient?: SupabaseClient
): Promise<CreateBookingResult> {
	const bookingPayload: CreateBookingPayload = {
		user_id: request.userId,
		client_id: request.clientId,
		start_time: request.startTime,
		end_time: request.endTime,
		status: request.status || 'scheduled' // Confirmed immediately
	}

	const booking = await createBooking(bookingPayload, supabaseClient)

	// Create bill for this booking
	const bill = await createBillForBooking(
		booking,
		billing,
		request.clientId,
		supabaseClient
	)

	// No immediate payment required
	return {
		booking,
		bill,
		requiresPayment: false
	}
}

/**
 * Creates a booking with monthly billing
 */
async function createMonthlyBooking(
	request: CreateBookingRequest,
	billing: any,
	supabaseClient?: SupabaseClient
): Promise<CreateBookingResult> {
	const bookingPayload: CreateBookingPayload = {
		user_id: request.userId,
		client_id: request.clientId,
		start_time: request.startTime,
		end_time: request.endTime,
		status: request.status || 'scheduled' // Confirmed immediately
	}

	const booking = await createBooking(bookingPayload, supabaseClient)

	// Create bill for this booking
	const bill = await createBillForBooking(
		booking,
		billing,
		request.clientId,
		supabaseClient
	)

	// No immediate payment required
	return {
		booking,
		bill,
		requiresPayment: false
	}
}

/**
 * Main function: creates a booking based on billing type
 *
 * ULTRA-CLEAN SEPARATION APPROACH:
 * 1. Resolves the current billing settings (client-specific or user default)
 * 2. Creates clean booking record (scheduling only)
 * 3. Creates separate bill record with all billing details
 * 4. Zero coupling between scheduling and financial concerns
 *
 * Result: Perfect separation between scheduling (bookings) and financial (bills) domains
 */
export async function createBookingSimple(
	request: CreateBookingRequest,
	supabaseClient?: SupabaseClient
): Promise<CreateBookingResult> {
	try {
		// Get billing settings (client-specific or user default)
		// This returns the current active billing configuration
		const billing = await getAppropriateBillingSettings(
			request.userId,
			request.clientId,
			supabaseClient
		)

		// Call appropriate function based on billing type
		// Each function will COPY the billing data into the booking record
		switch (billing.type) {
			case 'in-advance':
				return await createInAdvanceBooking(
					request,
					billing,
					supabaseClient
				)

			case 'right-after':
				return await createRightAfterBooking(
					request,
					billing,
					supabaseClient
				)

			case 'monthly':
				return await createMonthlyBooking(
					request,
					billing,
					supabaseClient
				)

			default:
				throw new Error(`Unknown billing type: ${billing.type}`)
		}
	} catch (error) {
		console.error('Error creating booking:', error)
		throw error
	}
}
