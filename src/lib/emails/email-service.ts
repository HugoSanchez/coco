import { Resend } from 'resend'
import { render } from '@react-email/render'
import ConsultationBillEmail from './consultation-bill'
import RefundNotificationEmail from './refund-notification'
import CancellationNotificationEmail from './cancellation-notification'
import CancellationRefundNotificationEmail from './cancellation-refund-notification'

/**
 * Get Resend client instance
 * Initializes Resend with API key from environment variables
 */
function getResendClient() {
	const apiKey = process.env.RESEND_API_KEY

	if (!apiKey) {
		throw new Error('RESEND_API_KEY environment variable is required')
	}

	return new Resend(apiKey)
}

/**
 * Email Service Configuration
 */
const EMAIL_CONFIG = {
	from: process.env.EMAIL_FROM || 'billing@yourdomain.com',
	replyTo: process.env.EMAIL_REPLY_TO || 'support@yourdomain.com'
} as const

/**
 * Send consultation billing email to client
 */
export async function sendConsultationBillEmail({
	to,
	clientName,
	consultationDate,
	amount,
	billingTrigger,
	practitionerName,
	practitionerEmail,
	practitionerImageUrl,
	dueDate,
	paymentUrl
}: {
	to: string
	clientName: string
	consultationDate: string
	amount: number
	billingTrigger: 'before_consultation' | 'after_consultation'
	practitionerName?: string
	practitionerEmail?: string
	practitionerImageUrl?: string
	dueDate?: string
	paymentUrl?: string
}) {
	try {
		// Render the email template
		const emailHtml = await render(
			ConsultationBillEmail({
				clientName,
				consultationDate,
				amount,
				billingTrigger,
				practitionerName,
				practitionerEmail,
				practitionerImageUrl,
				dueDate,
				paymentUrl
			})
		)

		// Determine subject based on billing trigger
		const subject =
			billingTrigger === 'before_consultation'
				? `Pre-confirmación de Consulta con ${practitionerName} - Pago Requerido`
				: `Factura de Consulta Completada`

		// Send email via Resend
		const resend = getResendClient()
		const result = await resend.emails.send({
			from: EMAIL_CONFIG.from,
			replyTo: EMAIL_CONFIG.replyTo,
			to: [to],
			subject,
			html: emailHtml
		})

		if (result.error) {
			console.error('Email sending failed:', result.error.message)
			throw new Error(`Failed to send email: ${result.error.message}`)
		}

		return {
			success: true,
			emailId: result.data?.id,
			message: 'Email sent successfully'
		}
	} catch (error) {
		console.error(
			'Error sending consultation bill:',
			error instanceof Error ? error.message : 'Unknown error'
		)

		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: 'Unknown error occurred',
			message: 'Failed to send email'
		}
	}
}

/**
 * Send multiple consultation billing emails
 * Handles bulk sending with error tracking
 */
export async function sendBulkConsultationBills(
	bills: Array<{
		to: string
		clientName: string
		consultationDate: string
		amount: number
		billingTrigger: 'before_consultation' | 'after_consultation'
		practitionerName?: string
		practitionerEmail?: string
		practitionerImageUrl?: string
		dueDate?: string
		paymentUrl?: string
	}>
) {
	console.log(
		`📧 [EMAIL] Starting bulk send for ${bills.length} consultation bills`
	)

	const results = []
	const errors = []

	for (const bill of bills) {
		const result = await sendConsultationBillEmail(bill)

		if (result.success) {
			results.push({
				...bill,
				emailId: result.emailId,
				status: 'sent'
			})
		} else {
			errors.push({
				...bill,
				error: result.error,
				status: 'failed'
			})
		}

		// Small delay to avoid rate limiting
		await new Promise((resolve) => setTimeout(resolve, 100))
	}

	console.log(`📧 [EMAIL] Bulk send completed:`, {
		total: bills.length,
		successful: results.length,
		failed: errors.length
	})

	return {
		total: bills.length,
		successful: results.length,
		failed: errors.length,
		results,
		errors
	}
}

/**
 * Send a simple admin notification on new signup
 */
export async function sendSignupNotificationEmail({
	newUserEmail
}: {
	newUserEmail: string
}) {
	try {
		const resend = getResendClient()
		const subject = 'New signup'
		const html = `<p>A new user just signed up: <strong>${
			newUserEmail || 'unknown email'
		}</strong></p>`

		const result = await resend.emails.send({
			from: EMAIL_CONFIG.from,
			replyTo: EMAIL_CONFIG.replyTo,
			to: 'hugo@itsverso.com',
			subject,
			html
		})

		if (result.error) {
			throw new Error(result.error.message)
		}

		return { success: true, emailId: result.data?.id }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}
	}
}

/**
 * Send refund notification to patient
 */
export async function sendRefundNotificationEmail({
	to,
	clientName,
	amount,
	currency = 'EUR',
	practitionerName,
	refundId,
	consultationDate
}: {
	to: string
	clientName: string
	amount: number
	currency?: string
	practitionerName?: string
	refundId?: string
	consultationDate?: string
}) {
	try {
		const resend = getResendClient()
		const html = await render(
			RefundNotificationEmail({
				clientName,
				amount,
				currency,
				practitionerName,
				refundId,
				consultationDate
			})
		)
		const result = await resend.emails.send({
			from: EMAIL_CONFIG.from,
			replyTo: EMAIL_CONFIG.replyTo,
			to: [to],
			subject: 'Confirmación de reembolso',
			html
		})
		if (result.error) throw new Error(result.error.message)
		return { success: true, emailId: result.data?.id }
	} catch (error) {
		console.error('Refund email failed:', error)
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}
	}
}

/**
 * Send cancellation notification to patient
 */
export async function sendCancellationNotificationEmail({
	to,
	clientName,
	consultationDate,
	practitionerName
}: {
	to: string
	clientName: string
	consultationDate?: string
	practitionerName?: string
}) {
	try {
		const resend = getResendClient()
		const html = await render(
			CancellationNotificationEmail({
				clientName,
				consultationDate,
				practitionerName
			})
		)
		const result = await resend.emails.send({
			from: EMAIL_CONFIG.from,
			replyTo: EMAIL_CONFIG.replyTo,
			to: [to],
			subject: 'Cita cancelada',
			html
		})
		if (result.error) throw new Error(result.error.message)
		return { success: true, emailId: result.data?.id }
	} catch (error) {
		console.error('Cancellation email failed:', error)
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}
	}
}

/**
 * Send cancellation + refund notification to patient
 */
export async function sendCancellationRefundNotificationEmail({
	to,
	clientName,
	amount,
	currency = 'EUR',
	practitionerName,
	refundId,
	consultationDate
}: {
	to: string
	clientName: string
	amount: number
	currency?: string
	practitionerName?: string
	refundId?: string
	consultationDate?: string
}) {
	try {
		const resend = getResendClient()
		const html = await render(
			CancellationRefundNotificationEmail({
				clientName,
				amount,
				currency,
				practitionerName,
				refundId,
				consultationDate
			})
		)
		const result = await resend.emails.send({
			from: EMAIL_CONFIG.from,
			replyTo: EMAIL_CONFIG.replyTo,
			to: [to],
			subject: `${practitionerName} ha cancelado tu cita`,
			html
		})
		if (result.error) throw new Error(result.error.message)
		return { success: true, emailId: result.data?.id }
	} catch (error) {
		console.error('Cancellation+Refund email failed:', error)
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}
	}
}

/**
 * Test if Resend client can be initialized
 */
export function testResendConnection() {
	try {
		getResendClient()
		return {
			success: true,
			message: 'Resend client initialized successfully'
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}
	}
}
