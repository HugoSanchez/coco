import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { paymentOrchestrationService } from '@/lib/payments/payment-orchestration-service'

// Force dynamic rendering - never cache this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/payments/invoices/[invoiceId]
 * Creates a Stripe Checkout Session for an invoice and redirects the client.
 * This endpoint always fetches fresh data and creates new checkout sessions.
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
				const redirectUrl = new URL(`/payment/error?reason=already_paid&invoice_id=${invoiceId}`, request.url)
				return NextResponse.redirect(redirectUrl, {
					headers: {
						'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
						'Pragma': 'no-cache',
						'Expires': '0'
					}
				})
			}

			Sentry.captureMessage('payments:invoice_checkout_failed', {
				level: 'warning',
				tags: { component: 'payments-route', scope: 'invoice' },
				extra: { invoiceId, error: errorMessage }
			})
			const redirectUrl = new URL(`/payment/error?reason=checkout_creation_failed&invoice_id=${invoiceId}`, request.url)
			return NextResponse.redirect(redirectUrl, {
				headers: {
					'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
					'Pragma': 'no-cache',
					'Expires': '0'
				}
			})
		}

		// Redirect to Stripe checkout with cache-busting headers
		return NextResponse.redirect(result.checkoutUrl, {
			headers: {
				'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
				'Pragma': 'no-cache',
				'Expires': '0'
			}
		})
	} catch (error) {
		console.error('[payments][invoice] error', error)
		Sentry.captureException(error, {
			tags: { component: 'payments-route', scope: 'invoice' },
			extra: { invoiceId }
		})
		const redirectUrl = new URL(`/payment/error?reason=server_error`, request.url)
		return NextResponse.redirect(redirectUrl, {
			headers: {
				'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
				'Pragma': 'no-cache',
				'Expires': '0'
			}
		})
	}
}
