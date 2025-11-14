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

import { createBooking, Booking, deleteBooking } from '@/lib/db/bookings'
import { getClientById } from '@/lib/db/clients'
import { createBill, CreateBillPayload, Bill, updateBillStatus, markBillAsPaid, deleteBill } from '@/lib/db/bills'
import { sendConsultationBillEmail } from '@/lib/emails/email-service'
import { getProfileById } from '@/lib/db/profiles'
import { getBookingById } from '@/lib/db/bookings'
import { createEmailCommunication } from '@/lib/db/email-communications'
import { createBookingCalendarEvent } from '@/lib/calendar/calendar-orchestration'
import { computeEmailScheduledAt } from '@/lib/utils'
import { buildManageUrl } from '@/lib/crypto'
import {
	getClientBillingSettings,
	getUserDefaultBillingSettings
} from '@/lib/db/billing-settings'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'

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
	mode?: 'online' | 'in_person'
	locationText?: string | null
	// If true, booking was created by patient; we will append manage links
	patientCreated?: boolean
	// Email used to bind manage-link signature
	patientEmail?: string
}

/**
 * BillingInput
 * ------------------------------------------------------------
 * Frontend-resolved billing payload we will require in the new flow.
 * - type: 'per_booking' | 'monthly'
 * - amount: number (>= 0). 0 allowed; null/undefined not allowed
 * - currency: currently 'EUR' only (kept explicit for future-proofing)
 * - paymentEmailLeadHours: integer hours (nullable); 0 means immediate
 * - suppressEmail: when true, payment emails will not be sent
 */
export type BillingInput = {
	type: 'per_booking' | 'monthly'
	amount: number
	currency: 'EUR'
	paymentEmailLeadHours?: number | null
	suppressEmail?: boolean
}

/**
 * CreateBookingRequestWithBilling (planned request contract)
 * ------------------------------------------------------------
 * We keep this alongside the legacy interface for a smooth, staged rollout.
 * The API route will adopt this type when we switch callers to pass billing.
 */
export interface CreateBookingRequestWithBilling extends CreateBookingRequest {
	billing: BillingInput
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
 * Unified booking creation
 *
 * One function handles both per-booking and monthly flows:
 * 1) Normalize billing type to 'per_booking' | 'monthly'
 * 2) Create booking once (status: completed|scheduled|pending)
 * 3) Create bill once (0-amount → paid; monthly → scheduled; per_booking → scheduled/pending)
 * 4) Calendar event via single helper to avoid repetition
 * 5) For per-booking: optionally send payment email when due
 */
export async function orchestrateBookingCreation(
	request: CreateBookingRequest,
	billing: any,
	supabaseClient?: SupabaseClient,
	options?: { suppressCalendar?: boolean; suppressEmail?: boolean }
): Promise<CreateBookingResult> {
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Pre-validate inputs (time window + billing payload)
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	validateBookingTimes(request.startTime, request.endTime)
	validateBillingInput(billing)
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 0: Load client and practitioner once (shared context)
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	const [client, practitioner] = await Promise.all([
		getClientById(request.clientId, supabaseClient),
		getProfileById(request.userId, supabaseClient)
	])
	if (!client) throw new Error(`Client not found: ${request.clientId}`)
	if (!practitioner) throw new Error(`Practitioner profile not found: ${request.userId}`)
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 1: Normalize billing type and derive simple flags
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	const normalizedType: 'per_booking' | 'monthly' = billing.type === 'monthly' ? 'monthly' : 'per_booking'
	// Total to charge for this booking
	const amount = Number(billing.amount)
	// Whether the consultation start_time is in the past (UTC comparison)
	const isPast = new Date(request.startTime).getTime() < Date.now()

	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 2: Decide which booking.status to persist (preserves prior behavior)
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	// When suppressEmail is true, mark as confirmed (scheduled) since we're not waiting for payment
	const bookingStatus: 'completed' | 'scheduled' | 'pending' =
		options?.suppressEmail
			? isPast
				? 'completed'
				: 'scheduled'
			: normalizedType === 'per_booking'
				? amount > 0
					? isPast
						? 'completed'
						: 'pending'
					: 'scheduled'
				: 'scheduled'

	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 3: Create the booking (single write)
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	const booking = await createBooking(
		{
			user_id: request.userId,
			client_id: request.clientId,
			start_time: request.startTime,
			end_time: request.endTime,
			status: bookingStatus,
			consultation_type: request.consultationType,
			mode: request.mode || 'online',
			location_text: request.mode === 'in_person' ? request.locationText || null : null
		},
		supabaseClient
	)

	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 4: Compute when to send the payment email (per-booking only)
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	const emailScheduledAt =
		options?.suppressEmail
			? null
			: normalizedType === 'per_booking' && amount > 0
				? computeEmailScheduledAt(billing.paymentEmailLeadHours, request.startTime, request.endTime)
				: null

	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 5: Create the bill (single write) and copy normalized type
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	const bill = await createBillForBooking(
		booking,
		{ ...billing, type: normalizedType, email_scheduled_at: emailScheduledAt },
		client,
		supabaseClient
	)

	// Monthly bills now start in 'scheduled' at creation time. No extra update needed.

	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 6: Calendar events (single helper, preserves earlier behavior by variant)
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	if (!options?.suppressCalendar && normalizedType === 'per_booking') {
		// New behavior: right-after bookings should behave like monthly for invites.
		// If paymentEmailLeadHours === -1 (after session), create CONFIRMED event now (when future),
		// so the client receives an invite immediately.
		const rightAfter = billing && typeof billing === 'object' && (billing as any).paymentEmailLeadHours === -1
		// If patient-created, append manage links using the REAL bookingId now
		const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
		const suffix =
			request.patientCreated && request.patientEmail
				? (() => {
						const resUrl = buildManageUrl(baseUrl, 'reschedule', booking.id, request.patientEmail as string)
						const canUrl = buildManageUrl(baseUrl, 'cancel', booking.id, request.patientEmail as string)
						return `¿Necesitas hacer cambios?\nReprogramar: ${resUrl}\n\nCancelar: ${canUrl}`
					})()
				: undefined
		const requestWithSuffix: CreateBookingRequest = {
			...request,
			notes: suffix ? `${request.notes || ''}${request.notes ? '\n\n' : ''}${suffix}` : request.notes
		}
		if (amount === 0) {
			await createCalendarEventForBooking({
				variant: 'confirmed',
				request: requestWithSuffix,
				bookingId: booking.id,
				client,
				practitioner,
				supabaseClient
			})
		} else if (isPast) {
			// Past bookings: only create calendar event if not suppressing email
			// (when suppressEmail is true, skip calendar for past bookings)
			if (!options?.suppressEmail) {
				await createCalendarEventForBooking({
					variant: 'internal_confirmed',
					request: requestWithSuffix,
					bookingId: booking.id,
					client,
					practitioner,
					supabaseClient
				})
			}
		} else if (options?.suppressEmail) {
			// Future bookings with suppressEmail: create confirmed event (calendar invite only, no payment email)
			await createCalendarEventForBooking({
				variant: 'confirmed',
				request: requestWithSuffix,
				bookingId: booking.id,
				client,
				practitioner,
				supabaseClient
			})
		} else if (rightAfter) {
			// Right-after: confirm now so invite is sent immediately
			await createCalendarEventForBooking({
				variant: 'confirmed',
				request: requestWithSuffix,
				bookingId: booking.id,
				client,
				practitioner,
				supabaseClient
			})
		} else {
			await createCalendarEventForBooking({
				variant: 'pending',
				request: requestWithSuffix,
				bookingId: booking.id,
				client,
				practitioner,
				supabaseClient
			})
		}
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 7: Zero-amount — mark bill as paid and finish
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	if (amount === 0) {
		await markBillAsPaid(bill.id, supabaseClient)
		return { booking, bill, requiresPayment: false }
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 8: Monthly flow — no payment email; create calendar invite if future; cron emails invoice
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	if (!options?.suppressCalendar && normalizedType === 'monthly') {
		if (!isPast) {
			await createCalendarEventForBooking({
				variant: 'confirmed',
				request,
				bookingId: booking.id,
				client,
				practitioner,
				supabaseClient
			})
		}
		return { booking, bill, requiresPayment: false }
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 9: Per-booking with non-zero amount — decide if we send the email now
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	const requiresPayment = true
	const dueNow = !emailScheduledAt || new Date(emailScheduledAt) <= new Date()

	// Skip email sending if suppressed (e.g., for recurring bookings during series creation)
	if (options?.suppressEmail) {
		return { booking, bill, requiresPayment, paymentUrl: undefined }
	}

	if (!dueNow) {
		// Email is scheduled for the future; UI can show "Programada..."
		return { booking, bill, requiresPayment, paymentUrl: undefined }
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 10: Send payment email now and update bill state to 'sent'
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	try {
		// Reuse loaded snapshots instead of refetching
		if (!client || !practitioner) throw new Error('Missing client or practitioner')

		const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
		const paymentGatewayUrl = `${baseUrl}/api/payments/${booking.id}`
		const triggerImmediate: 'before_consultation' | 'after_consultation' = isPast
			? 'after_consultation'
			: 'before_consultation'
		const emailResult = await sendConsultationBillEmail({
			to: client.email,
			clientName: client.name,
			consultationDate: request.startTime,
			amount,
			billingTrigger: triggerImmediate,
			practitionerName: practitioner.name || 'Your Practitioner',
			practitionerEmail: practitioner.email,
			practitionerImageUrl: practitioner.profile_picture_url || undefined,
			paymentUrl: paymentGatewayUrl
		})

		if (emailResult.success) {
			// Persist state transition to 'sent' and log the communication
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
			return { booking, bill, requiresPayment, paymentUrl: paymentGatewayUrl }
		}

		////////////////////////////////////////////////////////////////////////////////////////////////////////
		////// Step 10B: If sending failed, record failure for auditability
		////////////////////////////////////////////////////////////////////////////////////////////////////////
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
					status: 'failed'
				},
				supabaseClient
			)
		} catch (_) {}

		throw new Error('EMAIL_SEND_FAILED')
	} catch (error) {
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		////// Step 11: Cleanup if we failed after creating records (avoid dangling data)
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		try {
			await deleteBooking(booking.id, supabaseClient)
			await deleteBill(bill.id, supabaseClient)
		} catch (_) {}
		throw error
	}
}

/**
 * Creates a bill for a booking
 * Inmediately after creating a booking, a bill is created for the booking
 * This function handles that.
 */
async function createBillForBooking(
	booking: Booking,
	billing: any,
	client: any,
	supabaseClient?: SupabaseClient
): Promise<Bill> {
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 1: Normalize billing type and build bill payload from provided client snapshot
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	const normalizedBillingType: 'per_booking' | 'monthly' = billing.type === 'monthly' ? 'monthly' : 'per_booking'

	const clientDisplayName =
		(client as any).full_name_search ||
		[String((client as any).name || ''), String((client as any).last_name || '')].filter(Boolean).join(' ').trim()

	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 2: Look up VAT rate from billing_settings (client-specific, then user default)
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	let vatRatePercent: number | null = null
	if ((client as any).id) {
		try {
			// Try client-specific billing settings first
			const clientSettings = await getClientBillingSettings(booking.user_id, (client as any).id, supabaseClient)
			if (clientSettings?.vat_rate_percent != null) {
				vatRatePercent = Number(clientSettings.vat_rate_percent)
			} else {
				// Fall back to user default billing settings
				const userDefaults = await getUserDefaultBillingSettings(booking.user_id, supabaseClient)
				if (userDefaults?.vat_rate_percent != null) {
					vatRatePercent = Number(userDefaults.vat_rate_percent)
				}
			}
		} catch (error) {
			console.error('Error looking up VAT rate for bill:', error)
			// Continue with vatRatePercent = null (no VAT)
		}
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 3: Calculate tax amount if VAT applies
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	const taxAmount =
		vatRatePercent != null && vatRatePercent > 0 && billing.amount > 0
			? Math.round((billing.amount * (vatRatePercent / 100)) * 100) / 100
			: 0

	const billPayload: CreateBillPayload = {
		booking_id: booking.id,
		user_id: booking.user_id,
		client_id: (client as any).id,
		client_name: clientDisplayName,
		client_email: (client as any).email,
		client_national_id: (client as any).national_id || null,
		client_address: (client as any).address || null,
		amount: billing.amount,
		currency: billing.currency,
		billing_type: normalizedBillingType,
		email_scheduled_at: billing.email_scheduled_at || null,
		tax_rate_percent: vatRatePercent ?? 0,
		tax_amount: taxAmount
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////////
	////// Step 4: Persist bill and return
	////////////////////////////////////////////////////////////////////////////////////////////////////////
	const bill = await createBill(billPayload, supabaseClient)
	return bill
}

/**
 * Calendar event helper (single place to create Google events + DB rows)
 *
 * Rules (preserves existing behavior):
 * - Past paid consult (status 'completed'): create INTERNAL confirmed event (no invitations)
 * - Zero-amount per-booking: create CONFIRMED with invite
 * - Pending per-booking: create PENDING event
 * - Monthly: no calendar event here (monthly flow never created one before)
 */
async function createCalendarEventForBooking(options: {
	variant: 'internal_confirmed' | 'confirmed' | 'pending'
	request: CreateBookingRequest
	bookingId: string
	client: any
	practitioner: any
	supabaseClient?: SupabaseClient
}) {
	console.log('[orchestrate] createCalendarEventForBooking', {
		variant: options.variant,
		mode: options.request?.mode,
		locationText: options.request?.locationText
	})
	const { variant, request, bookingId, client, practitioner, supabaseClient } = options
	await createBookingCalendarEvent({ variant, request, bookingId, client, practitioner, supabaseClient })
}

/**
 * This function is used by the CRON job to send scheduled bills (per-booking only).
 * Sends the consultation bill email for a given bill.
 * - Builds the payment URL
 * - Sends the email
 * - Marks bill as 'sent' upon success and records email communication
 */
export async function sendBillPaymentEmail(
	bill: Bill,
	supabaseClient?: SupabaseClient
): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
	try {
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		////// Step 1: Guardrails and load required entities
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		if (!bill.booking_id) return { success: false, error: 'Bill missing booking_id' }
		// Load required entities
		const booking = await getBookingById(bill.booking_id, supabaseClient)
		const client = await getClientById(bill.client_id!, supabaseClient)
		const practitioner = await getProfileById(bill.user_id, supabaseClient)

		if (!booking) return { success: false, error: 'Booking not found' }
		if (!client) return { success: false, error: 'Client not found' }
		if (!practitioner) return { success: false, error: 'Practitioner not found' }

		////////////////////////////////////////////////////////////////////////////////////////////////////////
		////// Step 2: Compose payment URL and send email
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
		const paymentGatewayUrl = `${baseUrl}/api/payments/${bill.booking_id}`
		// Decide email copy variant based on whether the consultation already ended
		const bookingEnded = new Date(booking.end_time).getTime() <= Date.now()
		const trigger: 'before_consultation' | 'after_consultation' = bookingEnded
			? 'after_consultation'
			: 'before_consultation'
		const emailResult = await sendConsultationBillEmail({
			to: client.email,
			clientName: client.name,
			consultationDate: booking.start_time,
			amount: bill.amount,
			billingTrigger: trigger,
			practitionerName: practitioner.name || 'Your Practitioner',
			practitionerEmail: practitioner.email,
			practitionerImageUrl: practitioner.profile_picture_url || undefined,
			paymentUrl: paymentGatewayUrl
		})

		if (emailResult.success) {
			////////////////////////////////////////////////////////////////////////////////////////////////////////
			////// Step 3: Mark bill as 'sent' and record the communication
			////////////////////////////////////////////////////////////////////////////////////////////////////////
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

		////////////////////////////////////////////////////////////////////////////////////////////////////////
		////// Step 4: Propagate failure
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		return { success: false, error: emailResult.error || 'Email sending failed' }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////////
////// Validation helpers (trust but verify)
////////////////////////////////////////////////////////////////////////////////////////////////////////

export function validateBillingInput(b: any): asserts b is BillingInput {
	// If billing is null, throw an error
	if (!b) throw new Error('billing is required')
	// If billing.type is not 'per_booking' or 'monthly', throw an error
	if (b.type !== 'per_booking' && b.type !== 'monthly') throw new Error('billing.type invalid')
	// If billing.amount is not a number or is NaN or is less than 0, throw an error
	if (typeof b.amount !== 'number' || Number.isNaN(b.amount) || b.amount < 0) {
		throw new Error('billing.amount must be a number >= 0')
	}
	// If billing.currency is not 'EUR', throw an error
	if (b.currency !== 'EUR') throw new Error('billing.currency unsupported')
	// If billing.paymentEmailLeadHours is not an integer or is null, throw an error
	if (b.paymentEmailLeadHours != null && !Number.isInteger(b.paymentEmailLeadHours)) {
		throw new Error('billing.paymentEmailLeadHours must be an integer or null')
	}
	// If billing.paymentEmailLeadHours is not an integer or is null, throw an error
	if (b.paymentEmailLeadHours != null && !Number.isInteger(b.paymentEmailLeadHours)) {
		throw new Error('billing.paymentEmailLeadHours must be an integer or null')
	}
}

export function validateBookingTimes(startTime: string, endTime: string) {
	// Instantiate start time
	const start = new Date(startTime)
	// Instantiate end time
	const end = new Date(endTime)
	// If start time or end time is NaN, throw an error
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
		throw new Error('Invalid startTime or endTime')
	}
	// If end time is before start time, throw an error
	if (end <= start) throw new Error('endTime must be after startTime')
}
