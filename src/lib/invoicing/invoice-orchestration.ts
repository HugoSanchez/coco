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
	findInvoiceByLegacyBillId,
	issueCreditNote
} from '@/lib/db/invoices'
import { addInvoiceItem, listInvoiceItems } from '@/lib/db/invoice-items'
import { linkPaymentSessionToInvoice } from '@/lib/db/payment-sessions'
import { getInvoiceById } from '@/lib/db/invoices'
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
	// Scheduling additions
	cadence?: 'per_booking' | 'monthly'
	serviceDate?: string | null
	scheduledSendAt?: string | null
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
			qty: 1,
			cadence: input.cadence ?? 'per_booking',
			serviceDate: input.serviceDate ?? null,
			scheduledSendAt: input.scheduledSendAt ?? null
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

/**
 * createCreditNoteForInvoice
 * ----------------------------------------------
 * Creates and issues a "Factura rectificativa" that references a prior invoice.
 * If items are omitted, credits all lines; otherwise credits only specified items.
 */
export async function createCreditNoteForInvoice(
	params: {
		invoiceId: string
		userId: string
		reason?: string | null
		stripeRefundId?: string | null
		items?: Array<{ itemId: string }>
	},
	supabase?: SupabaseClient
): Promise<string> {
	// Load original invoice and items
	const original = await getInvoiceById(params.invoiceId, supabase)
	if (!original) throw new Error('Original invoice not found')

	// Draft credit note header
	const credit = await createDraftInvoice(
		{
			userId: params.userId,
			clientId: original.client_id,
			currency: original.currency,
			clientName: original.client_name_snapshot,
			clientEmail: original.client_email_snapshot,
			documentKind: 'credit_note',
			rectifiesInvoiceId: original.id,
			reason: params.reason ?? null,
			stripeRefundId: params.stripeRefundId ?? null
		},
		supabase
	)

	// Build lines
	const allItems = await listInvoiceItems(original.id, supabase)
	const itemMap = new Map(allItems.map((it: any) => [it.id, it]))
	const selected =
		params.items && params.items.length > 0
			? params.items.map((i) => itemMap.get(i.itemId)).filter(Boolean)
			: allItems

	for (const it of selected as any[]) {
		const amount = -Math.abs(Number(it.amount || 0))
		const tax_amount = -Math.abs(Number(it.tax_amount || 0))
		// Always use Spanish concept for rectificativas
		const concept: string = 'Anulación de consulta'
		await supabase!.from('invoice_items').insert({
			invoice_id: credit.id,
			booking_id: it.booking_id ?? null,
			description: concept,
			qty: it.qty,
			unit_price: it.unit_price,
			amount,
			tax_rate_percent: it.tax_rate_percent,
			tax_amount,
			rectifies_item_id: it.id
		})
	}

	await computeInvoiceTotals(credit.id, supabase)
	const issued = await issueCreditNote(credit.id, params.userId, new Date(), supabase)
	await generateAndStoreInvoicePdf(issued.id)
	return issued.id
}
