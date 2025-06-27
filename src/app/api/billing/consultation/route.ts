import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
	sendBulkConsultationBills,
	validateEmailConfig
} from '@/lib/emails/email-service'

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

/**
 * Supabase client with service role key
 * Bypasses RLS for admin operations
 */
const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
	// =========================================================================
	// DATE CALCULATION
	// =========================================================================

	/**
	 * Get today's date in YYYY-MM-DD format
	 * This is used to find billing_schedule entries that are due today or overdue
	 */
	const todayStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

	// =========================================================================
	// DATABASE QUERY USING CUSTOM FUNCTION
	// =========================================================================

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

	// =========================================================================
	// ERROR HANDLING
	// =========================================================================

	if (error) {
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		)
	}

	// =========================================================================
	// DATA TRANSFORMATION
	// =========================================================================

	/**
	 * Transform flat database result into structured API response
	 *
	 * Database function returns flat rows like:
	 * {
	 *   booking_id: "uuid",
	 *   scheduled_date: "2025-01-18",
	 *   client_id: "uuid",
	 *   client_name: "Hugo Sanchez",
	 *   client_email: "hugo@example.com",
	 *   billing_settings_id: "uuid",
	 *   billing_amount: 80,
	 *   billing_trigger: "before_consultation",
	 *   billing_advance_days: 7
	 * }
	 *
	 * We transform this into nested objects for better API design:
	 * {
	 *   booking_id: "uuid",
	 *   scheduled_date: "2025-01-18",
	 *   client: { id: "uuid", name: "Hugo Sanchez", email: "hugo@example.com" },
	 *   billing_settings: { id: "uuid", billing_amount: 80, ... },
	 *   amount: 80,              // convenience field
	 *   trigger: "before_consultation" // convenience field
	 * }
	 */
	const consultations = (data || []).map((row: any) => ({
		// Core billing schedule info
		booking_id: row.booking_id,
		scheduled_date: row.scheduled_date, // When this bill is due

		// Client information (for sending invoice)
		client: {
			id: row.client_id,
			name: row.client_name,
			email: row.client_email
		},

		// Billing configuration (for invoice details)
		billing_settings: {
			id: row.billing_settings_id,
			billing_amount: row.billing_amount,
			billing_trigger: row.billing_trigger,
			billing_advance_days: row.billing_advance_days
		},

		// Convenience fields (commonly accessed values)
		amount: row.billing_amount, // How much to bill
		trigger: row.billing_trigger // When to bill (before/after consultation)
	}))

	// =========================================================================
	// API RESPONSE
	// =========================================================================

	/**
	 * Return the consultation bills ready for processing
	 *
	 * Each item in the array represents a consultation that needs billing today.
	 * The calling system (cron job, UI, etc.) can:
	 * 1. Generate an invoice for each consultation
	 * 2. Send email to client.email with the invoice
	 * 3. Mark the billing_schedule entry as 'processed'
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
		// Parse request body (optional filters)
		const body = await request.json().catch(() => ({}))
		const { booking_ids, dry_run = false } = body

		console.log('📧 [API] Processing consultation billing emails:', {
			booking_ids,
			dry_run
		})

		// =========================================================================
		// VALIDATE EMAIL CONFIGURATION
		// =========================================================================

		const emailValidation = validateEmailConfig()
		if (!emailValidation.isValid) {
			return NextResponse.json(
				{
					success: false,
					error: 'Email configuration invalid',
					issues: emailValidation.issues
				},
				{ status: 400 }
			)
		}

		// =========================================================================
		// GET CONSULTATION BILLS (Same as GET endpoint)
		// =========================================================================

		const todayStr = new Date().toISOString().slice(0, 10)

		const { data, error } = await supabase.rpc('get_consultation_billing', {
			today_date: todayStr
		})

		if (error) {
			return NextResponse.json(
				{ success: false, error: error.message },
				{ status: 500 }
			)
		}

		// Transform data (same as GET endpoint)
		let consultations = (data || []).map((row: any) => ({
			booking_id: row.booking_id,
			scheduled_date: row.scheduled_date,
			consultation_date: row.consultation_date, // Add consultation date for email
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

		// Filter by specific booking IDs if provided
		if (booking_ids && Array.isArray(booking_ids)) {
			consultations = consultations.filter((c: any) =>
				booking_ids.includes(c.booking_id)
			)
		}

		if (consultations.length === 0) {
			return NextResponse.json({
				success: true,
				message: 'No consultation bills to process',
				total: 0,
				emails_sent: 0,
				emails_failed: 0,
				results: [],
				errors: []
			})
		}

		// =========================================================================
		// DRY RUN - Preview what would be sent
		// =========================================================================

		if (dry_run) {
			const preview = consultations.map((consultation: any) => ({
				booking_id: consultation.booking_id,
				client_email: consultation.client.email,
				client_name: consultation.client.name,
				amount: consultation.amount,
				trigger: consultation.trigger,
				subject:
					consultation.trigger === 'before_consultation'
						? `Factura de Consulta - Pago Requerido | ${consultation.consultation_date}`
						: `Factura de Consulta Completada | ${consultation.consultation_date}`
			}))

			return NextResponse.json({
				success: true,
				dry_run: true,
				message: `Would send ${preview.length} emails`,
				total: preview.length,
				preview
			})
		}

		// =========================================================================
		// PREPARE EMAIL DATA
		// =========================================================================

		const emailData = consultations.map((consultation: any) => ({
			to: consultation.client.email,
			clientName: consultation.client.name,
			consultationDate:
				consultation.consultation_date || consultation.scheduled_date,
			amount: consultation.amount,
			billingTrigger: consultation.trigger,
			practitionerName: 'Tu Profesional', // TODO: Get from user profile
			bookingId: consultation.booking_id
		}))

		// =========================================================================
		// SEND EMAILS
		// =========================================================================

		console.log(
			`📧 [API] Sending ${emailData.length} consultation billing emails`
		)

		const emailResults = await sendBulkConsultationBills(emailData)

		// =========================================================================
		// UPDATE BILLING SCHEDULE STATUS
		// =========================================================================

		// Mark successful emails as 'processed' in billing_schedule
		const successfulBookingIds = emailResults.results
			.filter((r: any) => r.status === 'sent')
			.map((r: any) => r.bookingId)

		if (successfulBookingIds.length > 0) {
			const { error: updateError } = await supabase
				.from('billing_schedule')
				.update({
					status: 'processed',
					processed_at: new Date().toISOString()
				})
				.in('booking_id', successfulBookingIds)

			if (updateError) {
				console.error(
					'❌ [API] Failed to update billing_schedule status:',
					updateError
				)
				// Don't fail the whole request, but log the error
			} else {
				console.log(
					`✅ [API] Marked ${successfulBookingIds.length} billing entries as processed`
				)
			}
		}

		// =========================================================================
		// API RESPONSE
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
		console.error('❌ [API] Error in consultation billing:', error)

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
