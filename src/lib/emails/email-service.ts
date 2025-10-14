import { Resend } from 'resend'
import { render } from '@react-email/render'
import ConsultationBillEmail from './consultation-bill'
import MonthlyBillEmail from './monthly-bill'
import RefundNotificationEmail from './refund-notification'
import CancellationNotificationEmail from './cancellation-notification'
import CancellationRefundNotificationEmail from './cancellation-refund-notification'
import PaymentReceiptEmail from './payment-receipt'

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
				? `Confirma tu consulta con ${practitionerName}`
				: `Factura de consulta con ${practitionerName}`

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
		console.error('Error sending consultation bill:', error instanceof Error ? error.message : 'Unknown error')

		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error occurred',
			message: 'Failed to send email'
		}
	}
}

/**
 * Send monthly consolidated invoice email to client
 */
export async function sendMonthlyBillEmail({
	to,
	clientName,
	amount,
	currency = 'EUR',
	monthLabel,
	practitionerName,
	paymentUrl
}: {
	to: string
	clientName: string
	amount: number
	currency?: string
	monthLabel: string
	practitionerName?: string
	paymentUrl?: string
}) {
	try {
		const html = await render(
			MonthlyBillEmail({
				clientName,
				monthLabel,
				amount,
				currency,
				practitionerName,
				paymentUrl
			})
		)

		const subject = `Factura del mes de ${monthLabel}`
		const resend = getResendClient()
		const result = await resend.emails.send({
			from: EMAIL_CONFIG.from,
			replyTo: EMAIL_CONFIG.replyTo,
			to: [to],
			subject,
			html
		})
		if (result.error) throw new Error(result.error.message)
		return { success: true, emailId: result.data?.id }
	} catch (error) {
		console.error('Monthly bill email failed:', error)
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
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
	console.log(`📧 [EMAIL] Starting bulk send for ${bills.length} consultation bills`)

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
 * Send payment receipt email (links to Stripe-hosted receipt)
 */
export async function sendPaymentReceiptEmail({
	to,
	clientName,
	amount,
	currency = 'EUR',
	practitionerName,
	consultationDate,
	receiptUrl
}: {
	to: string
	clientName: string
	amount: number
	currency?: string
	practitionerName?: string
	consultationDate?: string
	receiptUrl: string
}) {
	return sendReceiptEmail({
		mode: 'booking',
		to,
		clientName,
		practitionerName,
		amount,
		currency,
		receiptUrl,
		consultationDate
	})
}

/**
 * Send invoice (monthly or generic invoice) receipt email
 */
export async function sendInvoiceReceiptEmail({
	to,
	clientName,
	practitionerName,
	amount,
	currency = 'EUR',
	monthLabel,
	receiptUrl
}: {
	to: string
	clientName: string
	practitionerName?: string
	amount: number
	currency?: string
	monthLabel?: string
	receiptUrl: string
}) {
	return sendReceiptEmail({
		mode: 'monthly',
		to,
		clientName,
		practitionerName,
		amount,
		currency,
		receiptUrl,
		monthLabel
	})
}

// Unified receipt sender for both booking and monthly invoices
export async function sendReceiptEmail({
	mode,
	to,
	clientName,
	practitionerName,
	amount,
	currency = 'EUR',
	receiptUrl,
	monthLabel,
	consultationDate
}: {
	mode: 'monthly' | 'booking'
	to: string
	clientName: string
	practitionerName?: string
	amount: number
	currency?: string
	receiptUrl: string
	monthLabel?: string
	consultationDate?: string
}) {
	try {
		const resend = getResendClient()
		const html = await render(
			PaymentReceiptEmail({
				clientName,
				amount,
				currency,
				practitionerName,
				receiptUrl,
				consultationDate,
				isMonthly: mode === 'monthly',
				monthLabel
			})
		)
		const subject =
			mode === 'monthly'
				? monthLabel
					? `Pago confirmado - ${monthLabel.replace(/^[a-z]/, (c) => c.toUpperCase())}`
					: 'Pago confirmado'
				: 'Pago confirmado'
		const result = await resend.emails.send({
			from: EMAIL_CONFIG.from,
			replyTo: EMAIL_CONFIG.replyTo,
			to: [to],
			subject,
			html
		})
		if (result.error) throw new Error(result.error.message)
		return { success: true, emailId: result.data?.id }
	} catch (error) {
		console.error('Receipt email failed:', error)
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
	}
}

/**
 * Send appointment reminder email (simple text email)
 *
 * PURPOSE
 * -------
 * Daily cron sends a concise reminder to each patient with a booking today.
 * This helper composes a plain-text email with optional payment link.
 *
 * NOTES
 * -----
 * - Uses Resend directly (no React template) to keep the message minimal.
 * - Localized time formatting is expected to be handled by the caller
 *   (e.g., formatInTimeZone to Europe/Madrid) and passed as displayTime.
 */
export async function sendAppointmentReminderEmail({
	to,
	patientName,
	practitionerName,
	displayTime,
	paymentUrl
}: {
	to: string
	patientName: string
	practitionerName: string
	displayTime: string
	paymentUrl?: string
}) {
	try {
		const resend = getResendClient()

		// ------------------------------------------------------------
		// Step 1: Build subject and body in Spanish
		// ------------------------------------------------------------
		const subject = 'Recordatorio de consulta'

		const paymentLine = paymentUrl
			? `\n\nRecuerda que puedes pagar tu consulta fácilmente a través de este enlace: ${paymentUrl}`
			: ''

		const text = `Hola ${patientName},\n\nEste email es para recordarte tu consulta de hoy con ${practitionerName} a las ${displayTime}h. En caso de no poder asistir por favor asegúrate de hacérselo saber.${paymentLine}\n\n¡Que tengas un buen día!\n${practitionerName} y el equipo de Coco\n\n\n\n`

		// Also provide a minimal HTML version for better UX (bold + hyperlink)
		const htmlPayment = paymentUrl
			? `<p>Recuerda que puedes pagar tu consulta fácilmente haciendo click <a href="${paymentUrl}" target="_blank" rel="noopener noreferrer">aquí</a>.</p>`
			: ''
		const html = `
				<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;line-height:1.6">
					<p>Hola ${patientName},</p>
					<p>Este email es para recordarte tu consulta de hoy con ${practitionerName} a las ${displayTime}h. En caso de no poder asistir por favor házselo saber.</p>
					${htmlPayment}
					<p>¡Que tengas un buen día!</p>
					<p style="margin-top:16px">${practitionerName} y el equipo de Coco</p>
				</div>`

		// ------------------------------------------------------------
		// Step 2: Send email via Resend (text-only for simplicity)
		// ------------------------------------------------------------
		const result = await resend.emails.send({
			from: EMAIL_CONFIG.from,
			replyTo: EMAIL_CONFIG.replyTo,
			to: [to],
			subject,
			text,
			html
		})

		if (result.error) {
			throw new Error(result.error.message)
		}

		return { success: true, emailId: result.data?.id }
	} catch (error) {
		console.error('Appointment reminder email failed:', error)
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
