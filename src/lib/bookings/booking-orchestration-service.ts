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
import { paymentOrchestrationService } from '@/lib/payments/payment-orchestration-service'
import { createEmailCommunication } from '@/lib/db/email-communications'
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

			// Create Stripe checkout session directly using payment orchestration service
			const paymentResult =
				await paymentOrchestrationService.orechestrateConsultationCheckout(
					{
						userId: request.userId,
						bookingId: booking.id,
						clientEmail: client.email,
						clientName: client.name,
						consultationDate: request.startTime,
						amount: billing.amount,
						practitionerName:
							practitioner.name || 'Your Practitioner',
						supabaseClient
					}
				)

			if (paymentResult.success && paymentResult.checkoutUrl) {
				// Send consultation bill email with payment link
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
					paymentUrl: paymentResult.checkoutUrl
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

				return {
					booking,
					bill,
					requiresPayment: true,
					paymentUrl: paymentResult.checkoutUrl
				}
			} else {
				throw new Error(
					`Payment session creation failed: ${paymentResult.error}`
				)
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
