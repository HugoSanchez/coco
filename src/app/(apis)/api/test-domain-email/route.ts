import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

// Force dynamic rendering since this route uses environment variables
export const dynamic = 'force-dynamic'

/**
 * Test endpoint to verify domain email setup
 * Sends a test email using your new itscoco.app domain
 */
export async function POST(request: NextRequest) {
	try {
		const { to } = await request.json()

		if (!to) {
			return NextResponse.json(
				{ error: 'Email address required' },
				{ status: 400 }
			)
		}

		const resend = new Resend(process.env.RESEND_API_KEY)

		const result = await resend.emails.send({
			from: process.env.EMAIL_FROM || 'noreply@itscoco.app',
			replyTo: process.env.EMAIL_REPLY_TO || 'support@itscoco.app',
			to: [to],
			subject: 'Test Email from itscoco.app',
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<h1 style="color: #179898;">🎉 Domain Email Test Successful!</h1>
					<p>This email was sent from your new domain <strong>itscoco.app</strong> using Resend.</p>
					<p>Your email setup is working correctly!</p>
					<hr style="margin: 20px 0;">
					<p style="color: #666; font-size: 14px;">
						Sent from: ${process.env.EMAIL_FROM}<br>
						Reply to: ${process.env.EMAIL_REPLY_TO}
					</p>
				</div>
			`
		})

		if (result.error) {
			return NextResponse.json(
				{ error: result.error.message },
				{ status: 500 }
			)
		}

		return NextResponse.json({
			success: true,
			message: 'Test email sent successfully!',
			emailId: result.data?.id,
			from: process.env.EMAIL_FROM,
			replyTo: process.env.EMAIL_REPLY_TO
		})
	} catch (error) {
		console.error('Test email error:', error)
		return NextResponse.json(
			{ error: 'Failed to send test email' },
			{ status: 500 }
		)
	}
}
