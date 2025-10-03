/**
 * invoice-orchestration.ts
 * ----------------------------------------------
 * Purpose
 *  - High-level, business-oriented operations that combine DB helpers from
 *    invoices.ts and invoice-items.ts into usable workflows.
 *  - This is where we decide when to issue, how to build an invoice for a
 *    booking, and how to update the invoice on payment completion.
 *
 * Non-goals
 *  - This file does NOT talk to Stripe directly, nor does it dual-write to the
 *    legacy bills table. Dual-write will be applied by the caller code paths
 *    with a feature flag to minimize risk.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
	createDraftInvoice,
	computeInvoiceTotals,
	issueInvoice,
	markInvoicePaid,
	updateStripeReceiptUrl,
	findInvoiceByLegacyBillId
} from '@/lib/db/invoices'
import { addInvoiceItem } from '@/lib/db/invoice-items'
import { linkPaymentSessionToInvoice } from '@/lib/db/payment-sessions'
import { generateAndStoreInvoicePdf } from '@/lib/invoicing/pdf-service'

export interface CreateInvoiceForBookingInput {
	userId: string
	clientId?: string | null
	clientName: string
	clientEmail: string
	bookingId: string
	description: string
	amount: number
	currency?: string
	issueNow?: boolean
	dueDate?: string | null
	legacyBillId?: string | null
}

export async function createInvoiceForBooking(input: CreateInvoiceForBookingInput, supabase?: SupabaseClient) {
	const invoice = await createDraftInvoice(
		{
			userId: input.userId,
			clientId: input.clientId ?? null,
			currency: input.currency ?? 'EUR',
			clientName: input.clientName,
			clientEmail: input.clientEmail,
			dueDate: input.dueDate ?? null,
			legacyBillId: input.legacyBillId ?? null
		},
		supabase
	)

	await addInvoiceItem(
		{
			invoiceId: invoice.id,
			bookingId: input.bookingId,
			description: input.description,
			unitPrice: input.amount,
			qty: 1
		},
		supabase
	)

	await computeInvoiceTotals(invoice.id, supabase)

	if (input.issueNow) {
		const issued = await issueInvoice(invoice.id, input.userId, new Date(), supabase)
		// Fire-and-forget PDF generation (do not block issuance)
		try {
			await generateAndStoreInvoicePdf(issued.id)
		} catch (e) {
			console.warn('[invoicing] pdf generation failed after issuance', {
				invoiceId: issued.id,
				error: e instanceof Error ? e.message : String(e)
			})
		}
		return issued
	}

	return invoice
}

export async function onPaymentCompletedForInvoice(
	invoiceId: string,
	options: { paidAt?: Date; receiptUrl?: string | null },
	supabase?: SupabaseClient
) {
	const updated = await markInvoicePaid(invoiceId, options.paidAt ?? new Date(), supabase)
	if (typeof options.receiptUrl !== 'undefined') {
		await updateStripeReceiptUrl(invoiceId, options.receiptUrl, supabase)
	}
	return updated
}

/**
 * finalizeInvoiceForBillPayment
 * ----------------------------------------------
 * Dual-write helper used by the webhook layer.
 * Given a legacy bill id and Stripe-derived artifacts, it:
 *  - Finds the invoice created for that bill
 *  - Issues it if still draft (assigns series/number)
 *  - Marks it as paid and mirrors the receipt URL
 *  - Links the payment_session (via stripeSessionId) to the invoice
 */
export async function finalizeInvoiceForBillPayment(
	params: {
		legacyBillId: string
		userId: string
		paidAt?: Date
		receiptUrl?: string | null
		stripeSessionId?: string | null
	},
	supabase?: SupabaseClient
): Promise<void> {
	const invoice = await findInvoiceByLegacyBillId(params.legacyBillId, supabase)
	if (!invoice) {
		console.log('[invoicing] finalize skipped: no invoice for bill', {
			legacyBillId: params.legacyBillId
		})
		return
	}
	console.log('[invoicing] finalize start', {
		invoiceId: invoice.id,
		status: invoice.status,
		legacyBillId: params.legacyBillId
	})
	if (invoice.status === 'draft') {
		await issueInvoice(invoice.id, params.userId, new Date(), supabase)
	}
	await markInvoicePaid(invoice.id, params.paidAt ?? new Date(), supabase)
	if (typeof params.receiptUrl !== 'undefined' && params.receiptUrl) {
		await updateStripeReceiptUrl(invoice.id, params.receiptUrl, supabase)
	}
	if (params.stripeSessionId) {
		await linkPaymentSessionToInvoice(params.stripeSessionId, invoice.id, supabase)
	}
	// Generate and store PDF after issuance/payment
	try {
		await generateAndStoreInvoicePdf(invoice.id)
	} catch (e) {
		console.warn('[invoicing] pdf generation failed on finalize', {
			invoiceId: invoice.id,
			error: e instanceof Error ? e.message : String(e)
		})
	}
	console.log('[invoicing] finalize done', {
		invoiceId: invoice.id,
		hadReceiptUrl: Boolean(params.receiptUrl)
	})
}
