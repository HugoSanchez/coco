import { NextResponse } from 'next/server'
import {
	sendConsultationBillEmail,
	validateEmailConfig,
	testResendConnection
} from '@/lib/emails/email-service'

/**
 * GET /api/test-email
 *
 * TEST EMAIL CONFIGURATION
 * ========================
 *
 * Purpose:
 * Tests the email service configuration and sends a sample consultation bill
 * email to verify that Resend integration is working correctly.
 *
 * This endpoint is useful for:
 * - Verifying Resend API key is valid
 * - Testing email template rendering
 * - Confirming email delivery works
 * - Debugging email issues
 */
export async function GET() {
	try {
		// =========================================================================
		// VALIDATE EMAIL CONFIGURATION
		// =========================================================================

		console.log('🧪 [TEST] Testing email configuration...')

		const validation = validateEmailConfig()
		const connectionTest = testResendConnection()

		if (!validation.isValid || !connectionTest.success) {
			return NextResponse.json(
				{
					success: false,
					error: 'Email configuration invalid',
					issues: validation.issues,
					connection_error: connectionTest.error,
					help: {
						message: 'Please set up these environment variables:',
						required: [
							'RESEND_API_KEY - Your Resend API key',
							'EMAIL_FROM - Your sender email (optional, has default)'
						],
						setup_guide: 'https://resend.com/docs/send-with-nextjs'
					}
				},
				{ status: 400 }
			)
		}

		// =========================================================================
		// SEND TEST EMAIL
		// =========================================================================

		console.log('📧 [TEST] Sending test consultation bill email...')

		const testEmail = {
			to: 'delivered@resend.dev', // Resend's test email address
			clientName: 'Hugo Sanchez',
			consultationDate: '2025-01-20',
			amount: 80,
			billingTrigger: 'before_consultation' as const,
			practitionerName: 'Dr. María González',
			dueDate: '2025-01-18'
		}

		const result = await sendConsultationBillEmail(testEmail)

		// =========================================================================
		// RESPONSE
		// =========================================================================

		if (result.success) {
			return NextResponse.json({
				success: true,
				message: 'Test email sent successfully!',
				email_details: {
					to: testEmail.to,
					subject: `Factura de Consulta - Pago Requerido | ${testEmail.consultationDate}`,
					amount: testEmail.amount,
					trigger: testEmail.billingTrigger
				},
				email_id: result.emailId,
				note: 'Check your email inbox for the test consultation bill'
			})
		} else {
			return NextResponse.json(
				{
					success: false,
					error: result.error,
					message: 'Failed to send test email',
					help: {
						common_issues: [
							'Invalid Resend API key',
							'Invalid sender email domain',
							'Missing environment variables'
						]
					}
				},
				{ status: 500 }
			)
		}
	} catch (error) {
		console.error('❌ [TEST] Error testing email:', error)

		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error
						? error.message
						: 'Unknown error occurred',
				message: 'Test email failed'
			},
			{ status: 500 }
		)
	}
}

/**
 * POST /api/test-email
 *
 * SEND TEST EMAIL TO CUSTOM RECIPIENT
 * ===================================
 *
 * Send a test consultation bill email to a specific recipient.
 * Useful for testing with your actual email address.
 *
 * Request Body:
 * {
 *   "to": "your-email@example.com",
 *   "clientName": "Test Client",
 *   "amount": 100,
 *   "billingTrigger": "before_consultation"
 * }
 */
export async function POST(request: Request) {
	try {
		const body = await request.json()
		const {
			to,
			clientName = 'Test Client',
			amount = 80,
			billingTrigger = 'before_consultation'
		} = body

		if (!to) {
			return NextResponse.json(
				{ success: false, error: 'Email address (to) is required' },
				{ status: 400 }
			)
		}

		// Validate email configuration
		const validation = validateEmailConfig()
		if (!validation.isValid) {
			return NextResponse.json(
				{
					success: false,
					error: 'Email configuration invalid',
					issues: validation.issues
				},
				{ status: 400 }
			)
		}

		// Send test email
		const testEmail = {
			to,
			clientName,
			consultationDate: new Date().toISOString().slice(0, 10),
			amount,
			billingTrigger,
			practitionerName: 'Tu Profesional (Test)'
		}

		const result = await sendConsultationBillEmail(testEmail)

		if (result.success) {
			return NextResponse.json({
				success: true,
				message: `Test email sent successfully to ${to}!`,
				email_id: result.emailId
			})
		} else {
			return NextResponse.json(
				{
					success: false,
					error: result.error,
					message: 'Failed to send test email'
				},
				{ status: 500 }
			)
		}
	} catch (error) {
		console.error('❌ [TEST] Error sending custom test email:', error)

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
