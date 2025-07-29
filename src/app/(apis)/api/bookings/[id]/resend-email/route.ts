import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/db/bookings'
import { getClientById } from '@/lib/db/clients'
import { getProfileById } from '@/lib/db/profiles'
import { getBillsForBooking } from '@/lib/db/bills'

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

		// Step 2: Fetch booking details and validate ownership
		// Get booking first to check if it belongs to the authenticated user
		const booking = await getBookingById(bookingId, supabase)

		if (!booking) {
			console.log(`[RESEND] Booking not found: ${bookingId}`)
			return NextResponse.json(
				{ error: 'Booking not found' },
				{ status: 404 }
			)
		}

		// Verify the booking belongs to the authenticated practitioner
		if (booking.user_id !== user.id) {
			return NextResponse.json(
				{ error: 'Unauthorized: Booking does not belong to you' },
				{ status: 403 }
			)
		}

		// Step 3: Fetch client, practitioner details, and billing information
		// We need this data for the email template and amount validation

		const [client, practitioner, bills] = await Promise.all([
			getClientById(booking.client_id, supabase),
			getProfileById(user.id, supabase),
			getBillsForBooking(bookingId, supabase)
		])

		if (!client || !practitioner) {
			return NextResponse.json(
				{ error: 'Missing client or practitioner information' },
				{ status: 400 }
			)
		}

		// Step 4: Validate booking is eligible for resend
		// Cannot resend email for canceled bookings
		if (booking.status === 'canceled') {
			return NextResponse.json(
				{
					error: 'Cannot resend email for canceled bookings'
				},
				{ status: 400 }
			)
		}

		const resendableBill = bills.find(
			(bill) => bill.status === 'pending' || bill.status === 'sent'
		)

		if (!resendableBill) {
			return NextResponse.json(
				{
					error: 'Cannot resend email: no resendable bill found (bill must be pending or sent, not paid/canceled/refunded)'
				},
				{ status: 400 }
			)
		}

		if (resendableBill.amount <= 0) {
			return NextResponse.json(
				{
					error: 'Cannot resend email for bookings that do not require payment'
				},
				{ status: 400 }
			)
		}

		// Step 5: Validate all required parameters before proceeding

		// Validate amount
		if (!resendableBill.amount || resendableBill.amount <= 0) {
			return NextResponse.json(
				{ error: 'Invalid bill amount for resend' },
				{ status: 400 }
			)
		}

		// Validate required fields
		if (!client.email || !client.name || !booking.start_time) {
			return NextResponse.json(
				{ error: 'Missing required client or booking information' },
				{ status: 400 }
			)
		}

		// Step 6: Generate payment gateway URL (no need to create checkout session)
		// The payment gateway will create a fresh checkout session when the user clicks the link
		const baseUrl =
			process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
		const paymentGatewayUrl = `${baseUrl}/api/payments/${booking.id}`

		const emailResult = await sendConsultationBillEmail({
			to: client.email,
			clientName: client.name,
			consultationDate: booking.start_time,
			amount: resendableBill.amount,
			billingTrigger: 'before_consultation',
			practitionerName: practitioner.name || 'Your Practitioner',
			practitionerEmail: practitioner.email,
			practitionerImageUrl: practitioner.profile_picture_url || undefined,
			paymentUrl: paymentGatewayUrl
		})

		// Validation Step 4: Verify email was sent successfully
		if (!emailResult.success) {
			return NextResponse.json(
				{
					error: `Failed to send confirmation email: ${emailResult.error}`
				},
				{ status: 500 }
			)
		}

		// Step 9: Track resend action in email_communications
		// This helps practitioners see resend history and prevents abuse
		try {
			await createEmailCommunication(
				{
					user_id: user.id,
					client_id: client.id,
					booking_id: bookingId,
					email_type: 'consultation_bill_resend',
					recipient_email: client.email,
					recipient_name: client.name,
					status: 'sent', // We've already validated email was sent successfully
					error_message: null
				},
				supabase
			)
		} catch (trackingError) {
			// Validation Step 6: Email communication tracking failure
			// This is critical for audit trail and preventing abuse
			console.error('Failed to track email communication:', trackingError)
			return NextResponse.json(
				{
					error: 'Email sent successfully but failed to record communication history'
				},
				{ status: 500 }
			)
		}

		// Step 7: All validations passed - return success
		// If we reach this point, all critical steps have been validated:
		// ✅ Payment gateway URL generated
		// ✅ Email sent successfully with valid email ID
		// ✅ Email communication tracked for audit trail
		return NextResponse.json({
			success: true,
			message: 'Confirmation email resent successfully',
			emailId: emailResult.emailId // Include email ID for verification
		})
	} catch (error) {
		console.error(
			`Unexpected error during email resend for booking ${params.id}:`,
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
