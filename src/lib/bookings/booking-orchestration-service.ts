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

import { createBooking, CreateBookingPayload, Booking, deleteBooking } from '@/lib/db/bookings'
import { getClientBillingSettings, getUserDefaultBillingSettings } from '@/lib/db/billing-settings'
import { getClientById, getClientFullName } from '@/lib/db/clients'
import { createBill, CreateBillPayload, Bill, updateBillStatus, markBillAsPaid, deleteBill } from '@/lib/db/bills'
import { sendConsultationBillEmail } from '@/lib/emails/email-service'
import { getProfileById } from '@/lib/db/profiles'
import { getBookingById } from '@/lib/db/bookings'

import { createEmailCommunication } from '@/lib/db/email-communications'
import {
	createPendingCalendarEvent,
	createCalendarEventWithInvite,
	createInternalConfirmedCalendarEvent
} from '@/lib/calendar/calendar'
import { createCalendarEvent } from '@/lib/db/calendar-events'
import { computeEmailScheduledAt } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { createInvoiceForBooking } from '@/lib/invoicing/invoice-orchestration'

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
	overrideAmount?: number
	consultationType?: 'first' | 'followup'
	// Scheduling mode: defaults to 'online' if not provided
	mode?: 'online' | 'in_person'
	// Only when mode is 'in_person'
	locationText?: string | null
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
async function getAppropriateBillingSettings(userId: string, clientId: string, supabaseClient?: SupabaseClient) {
	// Check if client has specific billing settings
	const clientBilling = await getClientBillingSettings(userId, clientId, supabaseClient)

	if (clientBilling) {
		return {
			id: clientBilling.id,
			type: clientBilling.billing_type,
			amount: clientBilling.billing_amount || 0,
			currency: clientBilling.currency,
			first_consultation_amount: clientBilling.first_consultation_amount ?? null,
			payment_email_lead_hours: clientBilling.payment_email_lead_hours ?? null
		}
	}

	// Fall back to user default billing settings
	const userDefaultSettings = await getUserDefaultBillingSettings(userId, supabaseClient)

	if (userDefaultSettings) {
		return {
			id: userDefaultSettings.id,
			type: userDefaultSettings.billing_type,
			amount: userDefaultSettings.billing_amount || 0,
			currency: userDefaultSettings.currency,
			first_consultation_amount: userDefaultSettings.first_consultation_amount ?? null,
			// New: lead time for scheduling payment email
			payment_email_lead_hours: userDefaultSettings.payment_email_lead_hours ?? null
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
		client_name: (client as any).full_name_search || getClientFullName(client as any),
		client_email: client.email,
		amount: billing.amount,
		currency: billing.currency,
		billing_type: billing.type as 'in-advance' | 'right-after' | 'monthly',
		email_scheduled_at: billing.email_scheduled_at || null
	}

	console.log('[Orchestrator] Creating bill for booking', {
		bookingId: booking.id,
		amount: billing.amount,
		type: billing.type
	})

	const bill = await createBill(billPayload, supabaseClient)

	// Dual write: create a matching invoice + 1 item for this booking (feature-flagged)
	if (process.env.ENABLE_INVOICES_DUAL_WRITE === 'true') {
		try {
			await createInvoiceForBooking(
				{
					userId: booking.user_id,
					clientId,
					clientName: (client as any).full_name_search || getClientFullName(client as any),
					clientEmail: client.email,
					bookingId: booking.id,
					description: 'Consulta',
					amount: billing.amount,
					currency: billing.currency,
					// If your current flow marks bill as sent immediately for some paths,
					// you can toggle issueNow accordingly in those call sites.
					issueNow: false,
					legacyBillId: bill.id,
					// Scheduling fields for invoice_items
					cadence: (billing.type === 'monthly' ? 'monthly' : 'per_booking') as 'per_booking' | 'monthly',
					serviceDate: booking.start_time,
					scheduledSendAt:
						billing.type === 'monthly'
							? null
							: computeEmailScheduledAt(
									billing.payment_email_lead_hours,
									booking.start_time,
									booking.end_time
								)
				},
				supabaseClient
			)
		} catch (e) {
			Sentry.captureException(e, {
				tags: {
					component: 'booking-orchestrator',
					stage: 'dual_write_invoice'
				},
				extra: { bookingId: booking.id, billId: bill.id }
			})
			// Do not fail the legacy path if invoice creation fails
		}
	}

	return bill
}

/**
 * Creates a booking in the past with in-advance billing semantics
 * - Marks booking as completed
 * - Creates an internal confirmed calendar event (no invitations)
 * - Sends post-consultation email with payment link
 */
async function createPastBooking(
	request: CreateBookingRequest,
	billing: any,
	supabaseClient?: SupabaseClient
): Promise<CreateBookingResult> {
	// Create booking as completed
	const booking = await createBooking(
		{
			user_id: request.userId,
			client_id: request.clientId,
			start_time: request.startTime,
			end_time: request.endTime,
			status: 'completed',
			consultation_type: request.consultationType,
			mode: request.mode || 'online',
			location_text: request.mode === 'in_person' ? request.locationText || null : null
		},
		supabaseClient
	)

	// Create bill (pending) for historical booking
	const bill = await createBillForBooking(booking, billing, request.clientId, supabaseClient)

	// Create internal confirmed calendar event (no invites/notifications)
	try {
		const client = await getClientById(request.clientId, supabaseClient)
		const practitioner = await getProfileById(request.userId, supabaseClient)

		if (!client) throw new Error(`Client not found: ${request.clientId}`)
		if (!practitioner) throw new Error(`Practitioner profile not found: ${request.userId}`)

		const eventResult = await createInternalConfirmedCalendarEvent(
			{
				userId: request.userId,
				clientName: client.name,
				practitionerName: practitioner.name || 'Your Practitioner',
				practitionerEmail: practitioner.email,
				startTime: request.startTime,
				endTime: request.endTime,
				bookingNotes: request.notes,
				bookingId: booking.id as any
			},
			supabaseClient
		)

		if (eventResult.success && eventResult.googleEventId) {
			await createCalendarEvent(
				{
					booking_id: booking.id,
					user_id: request.userId,
					google_event_id: eventResult.googleEventId,
					event_type: 'confirmed',
					event_status: 'created'
				},
				supabaseClient
			)
		}
	} catch (calendarError) {
		console.error(`Internal confirmed calendar creation error for booking ${booking.id}:`, calendarError)
		Sentry.captureException(calendarError, {
			tags: {
				component: 'booking-orchestrator',
				stage: 'internal_confirmed_calendar'
			},
			extra: { bookingId: booking.id, userId: request.userId }
		})
	}

	// Send post-consultation email with payment link
	try {
		const client = await getClientById(request.clientId, supabaseClient)
		const practitioner = await getProfileById(request.userId, supabaseClient)
		if (client && practitioner) {
			const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
			const paymentGatewayUrl = `${baseUrl}/api/payments/${booking.id}`
			const emailResult = await sendConsultationBillEmail({
				to: client.email,
				clientName: client.name,
				consultationDate: request.startTime,
				amount: billing.amount,
				billingTrigger: 'after_consultation',
				practitionerName: practitioner.name || 'Your Practitioner',
				practitionerEmail: practitioner.email,
				practitionerImageUrl: practitioner.profile_picture_url || undefined,
				paymentUrl: paymentGatewayUrl
			})
			if (emailResult.success) {
				await updateBillStatus(bill.id, 'sent', supabaseClient)
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
				} catch (_) {}
			}
		}
	} catch (_) {}

	return { booking, bill, requiresPayment: true }
}

/**
 * Sends the consultation bill email for a given bill (before consultation flow).
 * - Builds the payment URL
 * - Sends the email
 * - Marks bill as 'sent' upon success and records email communication
 */
export async function sendBillPaymentEmail(
	bill: Bill,
	supabaseClient?: SupabaseClient
): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
	try {
		if (!bill.booking_id) {
			return { success: false, error: 'Bill missing booking_id' }
		}
		// Fetch entities needed
		const booking = await getBookingById(bill.booking_id, supabaseClient)
		const client = await getClientById(bill.client_id!, supabaseClient)
		const practitioner = await getProfileById(bill.user_id, supabaseClient)

		if (!booking) return { success: false, error: 'Booking not found' }
		if (!client) return { success: false, error: 'Client not found' }
		if (!practitioner) return { success: false, error: 'Practitioner not found' }

		const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
		const paymentGatewayUrl = `${baseUrl}/api/payments/${bill.booking_id}`

		const emailResult = await sendConsultationBillEmail({
			to: client.email,
			clientName: client.name,
			consultationDate: booking.start_time,
			amount: bill.amount,
			billingTrigger: 'before_consultation',
			practitionerName: practitioner.name || 'Your Practitioner',
			practitionerEmail: practitioner.email,
			practitionerImageUrl: practitioner.profile_picture_url || undefined,
			paymentUrl: paymentGatewayUrl
		})

		if (emailResult.success) {
			await updateBillStatus(bill.id, 'sent', supabaseClient)
			try {
				await createEmailCommunication(
					{
						user_id: bill.user_id,
						client_id: bill.client_id!,
						bill_id: bill.id,
						booking_id: bill.booking_id,
						email_type: 'consultation_bill',
						recipient_email: client.email,
						recipient_name: client.name,
						status: 'sent'
					},
					supabaseClient
				)
			} catch (_) {}
			return { success: true, paymentUrl: paymentGatewayUrl }
		}

		return {
			success: false,
			error: emailResult.error || 'Email sending failed'
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}
	}
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
	// Route past bookings to dedicated flow
	const isPastBooking = new Date(request.startTime).getTime() < Date.now()
	if (isPastBooking && billing.amount > 0) {
		return await createPastBooking(request, billing, supabaseClient)
	}
	// Fast-track zero-amount bookings: immediately confirm and invite
	if (billing.amount === 0) {
		// Create booking already scheduled
		const booking = await createBooking(
			{
				user_id: request.userId,
				client_id: request.clientId,
				start_time: request.startTime,
				end_time: request.endTime,
				status: 'scheduled',
				consultation_type: request.consultationType,
				mode: request.mode || 'online',
				location_text: request.mode === 'in_person' ? request.locationText || null : null
			},
			supabaseClient
		)

		// Create bill (0 EUR) and mark it as paid
		const bill = await createBillForBooking(booking, billing, request.clientId, supabaseClient)
		await markBillAsPaid(bill.id, supabaseClient)

		// Create confirmed calendar event directly
		try {
			const client = await getClientById(request.clientId, supabaseClient)
			const practitioner = await getProfileById(request.userId, supabaseClient)

			if (!client) throw new Error(`Client not found: ${request.clientId}`)
			if (!practitioner) throw new Error(`Practitioner profile not found: ${request.userId}`)

			const eventResult = await createCalendarEventWithInvite(
				{
					userId: request.userId,
					clientName: client.name,
					clientEmail: client.email,
					practitionerName: practitioner.name || 'Your Practitioner',
					practitionerEmail: practitioner.email,
					startTime: request.startTime,
					endTime: request.endTime,
					bookingNotes: request.notes,
					bookingId: booking.id as any,
					mode: request.mode,
					locationText: request.mode === 'in_person' ? request.locationText || null : null
				},
				supabaseClient
			)

			if (eventResult.success && eventResult.googleEventId) {
				await createCalendarEvent(
					{
						booking_id: booking.id,
						user_id: request.userId,
						google_event_id: eventResult.googleEventId,
						event_type: 'confirmed',
						event_status: 'created'
					},
					supabaseClient
				)
			} else {
				console.error(`Failed to create confirmed calendar event for booking ${booking.id}:`, eventResult.error)
				Sentry.captureException(eventResult.error, {
					tags: {
						component: 'booking-orchestrator',
						stage: 'confirmed_calendar'
					},
					extra: { bookingId: booking.id, userId: request.userId }
				})
			}
		} catch (calendarError) {
			console.error(`Confirmed calendar creation error for booking ${booking.id}:`, calendarError)
			Sentry.captureException(calendarError, {
				tags: {
					component: 'booking-orchestrator',
					stage: 'confirmed_calendar'
				},
				extra: { bookingId: booking.id, userId: request.userId }
			})
		}

		return {
			booking,
			bill,
			requiresPayment: false
		}
	}
	// Non-zero amount bookings (normal booking flow)
	const bookingPayload: CreateBookingPayload = {
		user_id: request.userId,
		client_id: request.clientId,
		start_time: request.startTime,
		end_time: request.endTime,
		status: 'pending', // Pending until payment
		consultation_type: request.consultationType,
		mode: request.mode || 'online',
		location_text: request.mode === 'in_person' ? request.locationText || null : null
	}

	const booking = await createBooking(bookingPayload, supabaseClient)

	const emailScheduledAt = computeEmailScheduledAt(
		billing.payment_email_lead_hours,
		request.startTime,
		request.endTime
	)

	// Create bill for this booking with 'pending' status
	const bill = await createBillForBooking(
		booking,
		{ ...billing, email_scheduled_at: emailScheduledAt },
		request.clientId,
		supabaseClient
	)

	// Create pending calendar event to reserve the time slot
	// This prevents double-booking while payment is being processed
	try {
		const client = await getClientById(request.clientId, supabaseClient)
		const practitioner = await getProfileById(request.userId, supabaseClient)

		if (!client) {
			throw new Error(`Client not found: ${request.clientId}`)
		}

		if (!practitioner) {
			throw new Error(`Practitioner profile not found: ${request.userId}`)
		}

		console.log('🗓️ [Booking] Starting calendar event creation for user:', request.userId, 'client:', client.name)

		let pendingEventResult
		try {
			pendingEventResult = await createPendingCalendarEvent(
				{
					userId: request.userId,
					clientName: client.name,
					practitionerEmail: practitioner.email,
					startTime: request.startTime,
					endTime: request.endTime,
					// Tag the Google event for idempotent reconciliation later
					bookingId: booking.id,
					mode: request.mode,
					locationText: request.mode === 'in_person' ? request.locationText || null : null
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
			console.error('❌ [Booking] Calendar event creation failed for user:', request.userId, 'Error:', error)

			// Provide specific guidance for common errors
			let calendarWarning: string | undefined
			if (error instanceof Error && error.message.includes('Calendar access expired')) {
				console.log('💡 [Booking] User needs to reconnect Google Calendar:', request.userId)
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

			console.log(`Pending calendar event created for booking ${booking.id}: ${pendingEventResult.googleEventId}`)
		} else {
			console.error(
				`Failed to create pending calendar event for booking ${booking.id}:`,
				pendingEventResult.error
			)
		}
	} catch (calendarError) {
		// Don't fail the booking creation if calendar event fails
		console.error(`Pending calendar creation error for booking ${booking.id}:`, calendarError)
		Sentry.captureException(calendarError, {
			tags: {
				component: 'booking-orchestrator',
				stage: 'pending_calendar'
			},
			extra: { bookingId: booking.id, userId: request.userId }
		})
	}

	// If amount > 0, requires payment - create payment session and send email
	const requiresPayment = billing.amount > 0

	if (requiresPayment) {
		// Only send the email immediately if the scheduled time has arrived
		const dueNow = !emailScheduledAt || new Date(emailScheduledAt) <= new Date()
		if (!dueNow) {
			return {
				booking,
				bill,
				requiresPayment: true,
				paymentUrl: undefined
			}
		}
		try {
			// Get client and practitioner info for payment session
			const client = await getClientById(request.clientId, supabaseClient)
			const practitioner = await getProfileById(request.userId, supabaseClient)

			if (!client) {
				throw new Error(`Client not found: ${request.clientId}`)
			}

			if (!practitioner) {
				throw new Error(`Practitioner profile not found: ${request.userId}`)
			}

			// Generate payment gateway URL (no need to create checkout session upfront)
			const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
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
				practitionerImageUrl: practitioner.profile_picture_url || undefined,
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
					console.error('Failed to track successful email:', trackingError)
					Sentry.captureException(trackingError, {
						tags: {
							component: 'booking-orchestrator',
							stage: 'email_track_sent'
						},
						extra: { bookingId: booking.id, billId: bill.id }
					})
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
							error_message: emailResult.error || 'Email sending failed'
						},
						supabaseClient
					)
				} catch (trackingError) {
					// Log tracking failure but don't break the flow
					console.error('Failed to track failed email:', trackingError)
					Sentry.captureException(trackingError, {
						tags: {
							component: 'booking-orchestrator',
							stage: 'email_track_failed'
						},
						extra: { bookingId: booking.id, billId: bill.id }
					})
				}

				// Email failed - throw error to trigger cleanup
				const emailError = new Error(`EMAIL_SEND_FAILED: Unable to send payment email to ${client.email}`)
				emailError.name = 'EmailSendError'
				throw emailError
			}
		} catch (error) {
			console.error(
				`Error in payment flow for booking ${booking.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
			Sentry.captureException(error, {
				tags: {
					component: 'booking-orchestrator',
					stage: 'payment_flow'
				},
				extra: {
					bookingId: booking.id,
					userId: request.userId,
					clientId: request.clientId
				}
			})

			// Cleanup: Delete the booking and bill we created
			try {
				await deleteBooking(booking.id, supabaseClient)
				await deleteBill(bill.id, supabaseClient)
			} catch (cleanupError) {
				console.error(`Cleanup failed for booking ${booking.id}:`, cleanupError)
				Sentry.captureException(cleanupError, {
					tags: {
						component: 'booking-orchestrator',
						stage: 'cleanup'
					},
					extra: { bookingId: booking.id, billId: bill.id }
				})
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
		status: request.status || 'scheduled', // Confirmed immediately
		mode: request.mode || 'online',
		location_text: request.mode === 'in_person' ? request.locationText || null : null
	}

	const booking = await createBooking(bookingPayload, supabaseClient)

	// Create bill for this booking
	const bill = await createBillForBooking(booking, billing, request.clientId, supabaseClient)

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
		status: request.status || 'scheduled', // Confirmed immediately
		mode: request.mode || 'online',
		location_text: request.mode === 'in_person' ? request.locationText || null : null
	}

	const booking = await createBooking(bookingPayload, supabaseClient)

	// Create bill for this booking
	const bill = await createBillForBooking(booking, billing, request.clientId, supabaseClient)

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
		const billing = await getAppropriateBillingSettings(request.userId, request.clientId, supabaseClient)

		// If a custom price override was provided, apply it for this booking only
		let resolvedBilling = { ...billing }
		// Apply first consultation pricing if selected and available
		if (request.consultationType === 'first' && billing?.first_consultation_amount != null) {
			resolvedBilling.amount = billing?.first_consultation_amount as number
		}
		if (
			request.overrideAmount != null &&
			typeof request.overrideAmount === 'number' &&
			!Number.isNaN(request.overrideAmount) &&
			request.overrideAmount >= 0
		) {
			resolvedBilling.amount = Math.round(request.overrideAmount * 100) / 100
		}

		// Call appropriate function based on billing type
		// Each function will COPY the billing data into the booking record
		switch (resolvedBilling.type) {
			case 'in-advance':
				return await createInAdvanceBooking(request, resolvedBilling, supabaseClient)

			case 'right-after':
				return await createRightAfterBooking(request, resolvedBilling, supabaseClient)

			case 'monthly':
				return await createMonthlyBooking(request, resolvedBilling, supabaseClient)

			default:
				throw new Error(`Unknown billing type: ${billing.type}`)
		}
	} catch (error) {
		console.error('Error creating booking:', error)
		Sentry.captureException(error, {
			tags: {
				component: 'booking-orchestrator',
				stage: 'createBookingSimple'
			},
			extra: { userId: request.userId, clientId: request.clientId }
		})
		throw error
	}
}
