import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/db/bookings'
import { getClientById } from '@/lib/db/clients'
import { getProfileById } from '@/lib/db/profiles'
import { getBillsForBooking } from '@/lib/db/bills'
import { paymentOrchestrationService } from '@/lib/payments/payment-orchestration-service'
import { sendConsultationBillEmail } from '@/lib/emails/email-service'
import { createEmailCommunication } from '@/lib/db/email-communications'

/**
 * POST /api/bookings/[id]/resend-email
 *
 * Resends confirmation email with a new payment link for a booking.
 * This endpoint handles the complete flow of invalidating previous payment
 * links and creating fresh ones to prevent duplicate payments.
 *
 * Flow:
 * 1. Authenticate practitioner and validate booking ownership
 * 2. Fetch booking, client, and practitioner details
 * 3. Validate booking is eligible for resend (pending status, requires payment)
 * 4. Cancel/expire all existing pending payment sessions for this booking
 * 5. Create new Stripe checkout session with fresh payment link
 * 6. Send consultation bill email with the new payment link
 * 7. Track the resend action in email_communications table
 *
 * Security: Only the practitioner who owns the booking can resend emails
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const supabase = createClient()
		const bookingId = params.id

		console.log(
			`[RESEND] Starting resend email process for booking: ${bookingId}`
		)

		// Step 1: Authenticate practitioner
		// Only authenticated practitioners can resend emails for their bookings
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()

		if (authError || !user) {
			console.log(
				`[RESEND] Authentication failed for booking ${bookingId}:`,
				authError
			)
			return NextResponse.json(
				{ error: 'Authentication required' },
				{ status: 401 }
			)
		}

		console.log(
			`[RESEND] Authenticated user: ${user.id} for booking: ${bookingId}`
		)

		// Step 2: Fetch booking details and validate ownership
		// Get booking first to check if it belongs to the authenticated user
		console.log(`[RESEND] Fetching booking details for: ${bookingId}`)
		const booking = await getBookingById(bookingId, supabase)

		if (!booking) {
			console.log(`[RESEND] Booking not found: ${bookingId}`)
			return NextResponse.json(
				{ error: 'Booking not found' },
				{ status: 404 }
			)
		}

		console.log(
			`[RESEND] Found booking: ${bookingId}, owner: ${booking.user_id}, status: ${booking.status}`
		)

		// Verify the booking belongs to the authenticated practitioner
		if (booking.user_id !== user.id) {
			console.log(
				`[RESEND] Unauthorized access: booking owner ${booking.user_id} != authenticated user ${user.id}`
			)
			return NextResponse.json(
				{ error: 'Unauthorized: Booking does not belong to you' },
				{ status: 403 }
			)
		}

		// Step 3: Fetch client, practitioner details, and billing information
		// We need this data for the email template and amount validation
		console.log(
			`[RESEND] Fetching client, practitioner, and billing data for booking: ${bookingId}`
		)
		const [client, practitioner, bills] = await Promise.all([
			getClientById(booking.client_id, supabase),
			getProfileById(user.id, supabase),
			getBillsForBooking(bookingId, supabase)
		])

		console.log(
			`[RESEND] Data fetched - Client: ${client?.name}, Practitioner: ${practitioner?.name}, Bills count: ${bills.length}`
		)

		if (!client || !practitioner) {
			console.log(
				`[RESEND] Missing data - Client: ${!!client}, Practitioner: ${!!practitioner}`
			)
			return NextResponse.json(
				{ error: 'Missing client or practitioner information' },
				{ status: 400 }
			)
		}

		// Step 4: Validate booking is eligible for resend
		// Cannot resend email for canceled bookings
		console.log(
			`[RESEND] Validating booking eligibility - Status: ${booking.status}`
		)
		if (booking.status === 'canceled') {
			console.log(`[RESEND] Booking is canceled, cannot resend`)
			return NextResponse.json(
				{
					error: 'Cannot resend email for canceled bookings'
				},
				{ status: 400 }
			)
		}

		// Find the bill that can be resent (pending or sent, but not paid/canceled/refunded)
		console.log(
			`[RESEND] Looking for resendable bill. Available bills:`,
			bills.map((b) => ({ id: b.id, status: b.status, amount: b.amount }))
		)
		const resendableBill = bills.find(
			(bill) => bill.status === 'pending' || bill.status === 'sent'
		)

		if (!resendableBill) {
			console.log(
				`[RESEND] No resendable bill found for booking ${bookingId}. Need bill with status 'pending' or 'sent'`
			)
			return NextResponse.json(
				{
					error: 'Cannot resend email: no resendable bill found (bill must be pending or sent, not paid/canceled/refunded)'
				},
				{ status: 400 }
			)
		}

		console.log(
			`[RESEND] Found resendable bill: ${resendableBill.id}, status: ${resendableBill.status}, amount: ${resendableBill.amount}`
		)

		if (resendableBill.amount <= 0) {
			console.log(
				`[RESEND] Bill amount is ${resendableBill.amount}, cannot resend`
			)
			return NextResponse.json(
				{
					error: 'Cannot resend email for bookings that do not require payment'
				},
				{ status: 400 }
			)
		}

		// Step 5: Validate all required parameters before proceeding
		console.log(
			`[RESEND] Validating parameters before creating checkout session`
		)

		// Validate amount
		if (!resendableBill.amount || resendableBill.amount <= 0) {
			console.error(`[RESEND] Invalid amount: ${resendableBill.amount}`)
			return NextResponse.json(
				{ error: 'Invalid bill amount for resend' },
				{ status: 400 }
			)
		}

		// Validate required fields
		if (!client.email || !client.name || !booking.start_time) {
			console.error(`[RESEND] Missing required fields:`, {
				hasEmail: !!client.email,
				hasName: !!client.name,
				hasStartTime: !!booking.start_time
			})
			return NextResponse.json(
				{ error: 'Missing required client or booking information' },
				{ status: 400 }
			)
		}

		// Step 6: Cancel/expire previous checkout sessions
		// This prevents patients from using old payment links and paying twice
		console.log(
			`[RESEND] Cancelling previous payment sessions for booking ${bookingId}`
		)
		const cancelResult =
			await paymentOrchestrationService.cancelPaymentForBooking(
				bookingId,
				supabase
			)

		if (!cancelResult.success) {
			console.warn(
				`[RESEND] Failed to cancel previous sessions: ${cancelResult.error}`
			)
			// Continue anyway - we'll still create a new session
		} else {
			console.log(
				`[RESEND] Successfully canceled previous payment sessions`
			)
		}

		// Step 7: Create new checkout session with fresh payment link
		console.log(
			`[RESEND] Creating new checkout session for booking ${bookingId}`
		)
		console.log(`[RESEND] Payment session params:`, {
			userId: user.id,
			bookingId,
			clientEmail: client.email,
			clientName: client.name,
			consultationDate: booking.start_time,
			amount: resendableBill.amount,
			practitionerName: practitioner.name || 'Your Practitioner'
		})

		const paymentResult =
			await paymentOrchestrationService.orechestrateConsultationCheckout({
				userId: user.id,
				bookingId,
				clientEmail: client.email,
				clientName: client.name,
				consultationDate: booking.start_time,
				amount: resendableBill.amount,
				practitionerName: practitioner.name || 'Your Practitioner',
				supabaseClient: supabase
			})

		console.log(`[RESEND] Payment session result:`, {
			success: paymentResult.success,
			hasCheckoutUrl: !!paymentResult.checkoutUrl,
			error: paymentResult.error
		})

		if (!paymentResult.success || !paymentResult.checkoutUrl) {
			console.log(
				`[RESEND] Failed to create payment session: ${paymentResult.error}`
			)
			return NextResponse.json(
				{
					error: `Failed to create new payment session: ${paymentResult.error}`
				},
				{ status: 500 }
			)
		}

		// Step 8: Send email with new payment link
		console.log(`[RESEND] Sending email for booking ${bookingId}`)
		console.log(`[RESEND] Email params:`, {
			to: client.email,
			clientName: client.name,
			consultationDate: booking.start_time,
			amount: resendableBill.amount,
			billingTrigger: 'before_consultation',
			practitionerName: practitioner.name || 'Your Practitioner',
			practitionerEmail: practitioner.email,
			hasPaymentUrl: !!paymentResult.checkoutUrl
		})

		const emailResult = await sendConsultationBillEmail({
			to: client.email,
			clientName: client.name,
			consultationDate: booking.start_time,
			amount: resendableBill.amount,
			billingTrigger: 'before_consultation',
			practitionerName: practitioner.name || 'Your Practitioner',
			practitionerEmail: practitioner.email,
			practitionerImageUrl: practitioner.profile_picture_url || undefined,
			paymentUrl: paymentResult.checkoutUrl
		})

		console.log(`[RESEND] Email sending result:`, {
			success: emailResult.success,
			emailId: emailResult.emailId,
			error: emailResult.error
		})

		// Step 9: Track resend action in email_communications
		// This helps practitioners see resend history and prevents abuse
		console.log(
			`[RESEND] Tracking email communication for booking ${bookingId}`
		)
		try {
			await createEmailCommunication(
				{
					user_id: user.id,
					client_id: client.id,
					booking_id: bookingId,
					email_type: 'consultation_bill_resend',
					recipient_email: client.email,
					recipient_name: client.name,
					status: emailResult.success ? 'sent' : 'failed',
					error_message: emailResult.success
						? null
						: emailResult.error || 'Unknown email error'
				},
				supabase
			)
			console.log(`[RESEND] Successfully tracked email communication`)
		} catch (trackingError) {
			console.error(
				'[RESEND] Failed to track email communication:',
				trackingError
			)
			// Don't fail the entire request if tracking fails
		}

		// Step 10: Return appropriate response
		if (emailResult.success) {
			console.log(
				`[RESEND] ✅ Successfully completed resend process for booking ${bookingId}`
			)
			return NextResponse.json({
				success: true,
				message: 'Confirmation email resent successfully'
			})
		} else {
			console.error(
				`[RESEND] ❌ Email sending failed for booking ${bookingId}: ${emailResult.error}`
			)
			return NextResponse.json(
				{
					error: 'Failed to send email',
					details: emailResult.error
				},
				{ status: 500 }
			)
		}
	} catch (error) {
		console.error(
			`[RESEND] ❌ Unexpected error for booking ${params.id}:`,
			error
		)
		return NextResponse.json(
			{
				error: 'Failed to resend confirmation email',
				details:
					error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
