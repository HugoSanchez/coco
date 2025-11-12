import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { paymentOrchestrationService } from '@/lib/payments/payment-orchestration-service'

/**
 * GET /api/payments/invoices/[invoiceId]
 * Creates a Stripe Checkout Session for an invoice and redirects the client.
 */
export async function GET(request: NextRequest, { params }: { params: { invoiceId: string } }) {
	const invoiceId = params.invoiceId
	try {
		if (!invoiceId) {
			return NextResponse.redirect(new URL(`/payment/error?reason=missing_invoice`, request.url))
		}

		const result = await paymentOrchestrationService.orchestrateInvoiceCheckout({ invoiceId })
		if (!result.success || !result.checkoutUrl) {
			const errorMessage = result.error || 'Unknown error'
			const isAlreadyPaid = errorMessage.includes('status=paid')

			// If invoice is already paid, redirect to a friendly "already paid" page
			if (isAlreadyPaid) {
				return NextResponse.redirect(new URL(`/payment/error?reason=already_paid&invoice_id=${invoiceId}`, request.url))
			}

			Sentry.captureMessage('payments:invoice_checkout_failed', {
				level: 'warning',
				tags: { component: 'payments-route', scope: 'invoice' },
				extra: { invoiceId, error: errorMessage }
			})
			return NextResponse.redirect(new URL(`/payment/error?reason=checkout_creation_failed&invoice_id=${invoiceId}`, request.url))
		}

		return NextResponse.redirect(result.checkoutUrl)
	} catch (error) {
		console.error('[payments][invoice] error', error)
		Sentry.captureException(error, {
			tags: { component: 'payments-route', scope: 'invoice' },
			extra: { invoiceId }
		})
		return NextResponse.redirect(new URL(`/payment/error?reason=server_error`, request.url))
	}
}
