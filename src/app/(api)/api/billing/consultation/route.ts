import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendBulkConsultationBills } from '@/lib/emails/email-service'
import { paymentOrchestrationService } from '@/lib/payments/payment-orchestration-service'
import { updateBookingBillingStatus } from '@/lib/db/bookings'
import { markBillingActionCompletedFromBookingId } from '@/lib/db/billing-schedule'

/**
 * Supabase client with service role key
 * Bypasses RLS for admin operations
 */
const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Get consultation billing HELPER FUNCTION
 * @param todayStr - Today's date in YYYY-MM-DD format
 * @returns - Array of consultation billing data
 */
async function getConsultationBilling(todayStr: string) {
	/**
	 * Call the get_consultation_billing() database function
	 *
	 * Why use a database function instead of PostgREST queries?
	 * - PostgREST has issues with complex nested relationship filtering
	 * - Functions give us reliable SQL with proper JOINs
	 * - Better performance (single query vs multiple API calls)
	 * - Easier to debug and test in SQL editor
	 *
	 * The function executes this SQL:
	 * SELECT bs.booking_id, bs.scheduled_date, c.*, billing.*
	 * FROM billing_schedule bs
	 * JOIN bookings b ON bs.booking_id = b.id
	 * JOIN billing_settings billing ON b.billing_settings_id = billing.id
	 * JOIN clients c ON b.client_id = c.id
	 * WHERE bs.scheduled_date <= today_date
	 *   AND bs.status = 'pending'
	 *   AND billing.billing_type = 'consultation_based'
	 */
	const { data, error } = await supabase.rpc('get_consultation_billing', {
		today_date: todayStr
	})

	if (error) {
		throw new Error(error.message)
	}

	/**
	 * Map the data to the expected format
	 */
	return (data || []).map((row: any) => ({
		booking_id: row.booking_id,
		scheduled_date: row.scheduled_date,
		consultation_date: row.consultation_date,
		user_id: row.user_id,
		practitioner: {
			name: row.practitioner_name,
			email: row.practitioner_email
		},
		client: {
			id: row.client_id,
			name: row.client_name,
			email: row.client_email
		},
		billing_settings: {
			id: row.billing_settings_id,
			billing_amount: row.billing_amount,
			billing_trigger: row.billing_trigger,
			billing_advance_days: row.billing_advance_days
		},
		amount: row.billing_amount,
		trigger: row.billing_trigger
	}))
}

/**
 * GET /api/billing/consultation
 *
 * CONSULTATION BILLING ENDPOINT
 * ============================
 *
 * Purpose:
 * Returns all consultation-based bills that are due for processing today.
 * This endpoint is designed for billing automation - it finds consultations
 * that need invoices sent to clients.
 *
 * How Consultation Billing Works:
 * ------------------------------
 * 1. Client books a consultation appointment
 * 2. Booking references billing_settings with type = 'consultation_based'
 * 3. System creates billing_schedule entry with calculated due date:
 *    - If billing_trigger = 'before_consultation': due_date = consultation_date - advance_days
 *    - If billing_trigger = 'after_consultation': due_date = consultation_date + advance_days
 * 4. This endpoint finds billing_schedule entries where due_date <= today
 *
 * Database Flow:
 * billing_schedule → bookings → billing_settings + clients
 *
 * Response Format:
 * [
 *   {
 *     booking_id: "uuid",
 *     scheduled_date: "2025-01-18",  // when to bill (today or past)
 *     client: { id, name, email },
 *     billing_settings: { id, amount, trigger, advance_days },
 *     amount: 80,                    // shortcut to billing_amount
 *     trigger: "before_consultation" // shortcut to billing_trigger
 *   }
 * ]
 */

export async function GET() {
	/**
	 * Get today's date in YYYY-MM-DD format
	 * This is used to find billing_schedule entries that are due today or overdue
	 */
	const todayStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

	/**
	 * Fetch DB for pending consultation billings
	 */
	const consultations = await getConsultationBilling(todayStr)

	/**
	 * Return the consultation bills ready for processing
	 */
	return NextResponse.json(consultations)
}

/**
 * POST /api/billing/consultation
 *
 * SEND CONSULTATION BILLING EMAILS
 * ===============================
 *
 * Purpose:
 * Finds all consultation bills due today and sends billing emails to clients.
 * This endpoint handles the actual email sending for consultation billing.
 *
 * Request Body Options:
 * - No body: Send emails for ALL consultation bills due today
 * - { booking_ids: ["uuid1", "uuid2"] }: Send emails for specific bookings only
 * - { dry_run: true }: Preview what emails would be sent without actually sending
 *
 * Email Flow:
 * 1. Query consultation bills (same as GET endpoint)
 * 2. Transform data into email format
 * 3. Send emails via Resend
 * 4. Update billing_schedule status to 'processed' for successful sends
 *
 * Response Format:
 * {
 *   success: true,
 *   total: 5,
 *   emails_sent: 4,
 *   emails_failed: 1,
 *   results: [...],
 *   errors: [...]
 * }
 */
export async function POST(request: Request) {
	try {
		// =========================================================================
		// 1. GET CONSULTATION BILLS (Same as GET endpoint)
		// =========================================================================

		// Get today's date in YYYY-MM-DD format
		const todayStr = new Date().toISOString().slice(0, 10)
		// Get consultation billing
		const consultations = await getConsultationBilling(todayStr)
		// If no consultations to process, return success
		if (consultations.length === 0) {
			return NextResponse.json({
				success: true,
				message: 'No consultation bills to process'
			})
		}

		// =========================================================================
		// 2. FOR EACH CONSULTATION, GENERATE PAYMENT LINKS
		// =========================================================================

		const emailData = []
		// Loop through consultations and generate payment links
		for (const consultation of consultations) {
			try {
				// Generate payment link using orchestration service
				const paymentResult =
					// Call the service to generate the payment link
					await paymentOrchestrationService.orechestrateConsultationCheckout(
						{
							// user_id is the practitioner's user_id
							userId: consultation.user_id,
							// booking_id is the booking_id to be billed
							bookingId: consultation.booking_id,
							// client_email is the client's email
							clientEmail: consultation.client.email,
							// client_name is the client's name
							clientName: consultation.client.name,
							// consultation_date is the date of the consultation
							consultationDate: consultation.consultation_date,
							// amount is the amount to be billed
							amount: consultation.amount,
							// practitioner_name is the practitioner's name
							practitionerName: consultation.practitioner.name
						}
					)

				// Check payment link creation was successful
				if (paymentResult.success) {
					// Add email data with payment link
					emailData.push({
						to: consultation.client.email,
						clientName: consultation.client.name,
						consultationDate: consultation.consultation_date,
						amount: consultation.amount,
						billingTrigger: consultation.trigger,
						practitionerName: consultation.practitioner.name,
						practitionerEmail: consultation.practitioner.email,
						bookingId: consultation.booking_id,
						userId: consultation.user_id,
						paymentUrl: paymentResult.checkoutUrl
					})
				}
			} catch (error) {
				console.error(
					`Error generating payment link for booking ${consultation.booking_id}:`,
					error
				)
			}
		}

		// =========================================================================
		// 3. SEND BULK EMAILS
		// =========================================================================

		// Send emails to clients using the email service in bulk
		const emailResults = await sendBulkConsultationBills(emailData)

		// =========================================================================
		// 4. UPDATE BILLING SCHEDULE STATUS
		// =========================================================================

		// Mark successful emails as 'processed' in billing_schedule
		const successfulBookingIds = emailResults.results
			.filter((r: any) => r.status === 'sent')
			.map((r: any) => r.bookingId)

		// Mark billing schedule entries as completed and update booking status
		for (const bookingId of successfulBookingIds) {
			// Mark billing schedule as completed using the service function
			await markBillingActionCompletedFromBookingId(bookingId)
			// Update booking billing status using the service function
			await updateBookingBillingStatus(bookingId, 'billed')
		}

		// =========================================================================
		// 5. RETURN API RESPONSE
		// =========================================================================

		return NextResponse.json({
			success: true,
			total: emailResults.total,
			emails_sent: emailResults.successful,
			emails_failed: emailResults.failed,
			results: emailResults.results,
			errors: emailResults.errors
		})
	} catch (error) {
		console.error('[API] Error in consultation billing:', error)
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error
						? error.message
						: 'Unknown error occurred'
			},
			{ status: 500 }
		)
	}
}
