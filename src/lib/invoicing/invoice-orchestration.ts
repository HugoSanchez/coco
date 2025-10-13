/**
 * invoice-orchestration.ts
 * ----------------------------------------------
 * Purpose
 *  - High-level, business-oriented operations that combine DB helpers from
 *    invoices.ts into usable workflows (no invoice-items dependency).
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
	issueCreditNote,
	findOrCreateMonthlyInvoice
} from '@/lib/db/invoices'
import { linkPaymentSessionToInvoice } from '@/lib/db/payment-sessions'
import { getUnlinkedMonthlyBillsForUserClient, linkBillsToInvoice } from '@/lib/db/bills'
import { getClientById } from '@/lib/db/clients'
import { getInvoiceById } from '@/lib/db/invoices'
import { generateAndStoreInvoicePdf } from '@/lib/invoicing/pdf-service'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'

// removed deprecated helpers: createInvoiceForBooking, onPaymentCompletedForInvoice, finalizeInvoiceForBillPayment

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
	// Load original invoice (mirror totals; items deprecated)
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
	// Mirror totals as full credit of the original
	const db = supabase || createServerSupabaseClient()
	await db
		.from('invoices')
		.update({
			subtotal: -Math.abs(Number(original.subtotal || 0)),
			tax_total: -Math.abs(Number(original.tax_total || 0)),
			total: -Math.abs(Number(original.total || 0))
		})
		.eq('id', credit.id)
	const issued = await issueCreditNote(credit.id, params.userId, new Date(), supabase)
	await generateAndStoreInvoicePdf(issued.id)
	return issued.id
}

/**
 * createCreditNoteForRefund
 * ----------------------------------------------
 * Creates and issues a partial "Factura rectificativa" crediting a specific amount.
 * - Does NOT depend on invoice items; totals are set directly.
 */
export async function createCreditNoteForRefund(
	params: {
		invoiceId: string
		userId: string
		amount: number
		reason?: string | null
		stripeRefundId?: string | null
	},
	supabase?: SupabaseClient
): Promise<string> {
	const db = supabase || createServerSupabaseClient()

	// Create draft credit note header referencing the original invoice
	const credit = await createDraftInvoice(
		{
			userId: params.userId,
			clientId: null, // keep header minimal; snapshots not strictly necessary here
			currency: 'EUR',
			clientName: '',
			clientEmail: '',
			documentKind: 'credit_note',
			rectifiesInvoiceId: params.invoiceId,
			reason: params.reason ?? null,
			stripeRefundId: params.stripeRefundId ?? null
		},
		db
	)

	// Set totals equal to negative refunded amount
	const creditAbs = Math.abs(Number(params.amount || 0))
	await db.from('invoices').update({ subtotal: -creditAbs, tax_total: 0, total: -creditAbs }).eq('id', credit.id)

	// Issue and generate PDF
	const issued = await issueCreditNote(credit.id, params.userId, new Date(), db)
	await generateAndStoreInvoicePdf(issued.id)
	return issued.id
}

/**
 * ensureInvoiceForBillOnPayment
 * ----------------------------------------------
 * Per-booking success path: when a bill is paid, ensure an invoice exists,
 * issue it, mark it paid, mirror receipt URL, and generate/store the PDF.
 * Also links the bill to the created invoice (bills.invoice_id).
 */
export async function ensureInvoiceForBillOnPayment(
	params: {
		billId: string
		userId: string
		snapshot: {
			clientId?: string | null
			clientName: string
			clientEmail: string
			amount: number
			currency?: string
		}
		receiptUrl?: string | null
		stripeSessionId?: string | null
	},
	supabase?: SupabaseClient
): Promise<string> {
	const db = supabase || createServerSupabaseClient()

	// 1) Find existing invoice for this legacy bill (if any)
	let invoice = await findInvoiceByLegacyBillId(params.billId, db)

	// 2) Create draft invoice and set totals if not found
	if (!invoice) {
		invoice = await createDraftInvoice(
			{
				userId: params.userId,
				clientId: params.snapshot.clientId ?? null,
				currency: params.snapshot.currency ?? 'EUR',
				clientName: params.snapshot.clientName,
				clientEmail: params.snapshot.clientEmail,
				dueDate: null,
				legacyBillId: params.billId
			},
			db
		)
		await db
			.from('invoices')
			.update({ subtotal: params.snapshot.amount, tax_total: 0, total: params.snapshot.amount })
			.eq('id', invoice.id)

		// Link the bill to the invoice for traceability
		await db.from('bills').update({ invoice_id: invoice.id }).eq('id', params.billId)
	}

	// 3) Issue if still draft
	if (invoice.status === 'draft') {
		invoice = await issueInvoice(invoice.id, params.userId, new Date(), db)
	}

	// 4) Mark as paid + mirror receipt URL
	await markInvoicePaid(invoice.id, new Date(), db)
	if (typeof params.receiptUrl !== 'undefined') {
		await updateStripeReceiptUrl(invoice.id, params.receiptUrl ?? null, db)
	}

	// 5) Link payment session (optional)
	if (params.stripeSessionId) {
		await linkPaymentSessionToInvoice(params.stripeSessionId, invoice.id, db)
	}

	// 6) Generate/store PDF (fire-and-forget semantics acceptable)
	try {
		await generateAndStoreInvoicePdf(invoice.id)
	} catch (_) {}

	return invoice.id
}

/**
 * ensureMonthlyDraftAndLinkBills
 * ----------------------------------------------
 * Monthly aggregation path: ensures a draft invoice exists for (user, client, period),
 * links all eligible monthly bills for that period, and adds one invoice item per bill
 * so totals are correct. Does NOT issue or mark paid.
 */
export async function ensureMonthlyDraftAndLinkBills(
	params: {
		userId: string
		clientId: string | null
		periodStart: string // inclusive ISO
		periodEnd: string // exclusive ISO
		currency?: string
	},
	supabase?: SupabaseClient
): Promise<{ invoiceId: string; linkedBillIds: string[] }> {
	const db = supabase || createServerSupabaseClient()

	// 1) Ensure/obtain draft invoice for period
	// Resolve client snapshots for email sending (monthly email requires a recipient)
	let clientNameSnap = ''
	let clientEmailSnap = ''
	if (params.clientId) {
		try {
			const clientRow = await getClientById(params.clientId, db)
			if (clientRow) {
				clientNameSnap = ((clientRow as any).full_name_search || clientRow.name || '').trim()
				clientEmailSnap = (clientRow as any).email || ''
			}
		} catch (_) {}
	}

	let invoice = await findOrCreateMonthlyInvoice(
		{
			userId: params.userId,
			clientId: params.clientId,
			clientName: clientNameSnap,
			clientEmail: clientEmailSnap,
			currency: params.currency || 'EUR',
			periodStart: params.periodStart,
			periodEnd: params.periodEnd
		},
		db as any
	)

	// 2) Fetch monthly bills not yet linked to any invoice within the period
	const billsToLinkRaw = await getUnlinkedMonthlyBillsForUserClient(params.userId, params.clientId, db)
	console.log('[monthly-cron] raw monthly bills for group', {
		userId: params.userId,
		clientId: params.clientId,
		count: (billsToLinkRaw || []).length,
		sampleStartTimes: (billsToLinkRaw || [])
			.map((r: any) => (Array.isArray(r?.booking) ? r.booking[0]?.start_time : r?.booking?.start_time))
			.filter(Boolean)
			.slice(0, 5)
	})

	const candidates = (billsToLinkRaw || []).filter((row: any) => {
		const st = Array.isArray(row?.booking)
			? (row.booking[0]?.start_time as string | undefined)
			: (row?.booking?.start_time as string | undefined)
		if (!st) return false
		return st >= params.periodStart && st < params.periodEnd
	})
	// Debug: show the bills we intend to link (id, amount, date)
	try {
		const preview = candidates.map((r: any) => ({
			id: r.id,
			amount: Number(r.amount || 0),
			start:
				Array.isArray(r?.booking) && r.booking[0]?.start_time
					? r.booking[0]?.start_time
					: r?.booking?.start_time || null
		}))
		console.log('[monthly-cron] selected candidates for invoice', {
			userId: params.userId,
			clientId: params.clientId,
			periodStart: params.periodStart,
			periodEnd: params.periodEnd,
			invoiceId: invoice.id,
			candidates: preview
		})
	} catch (_) {}

	// Minimal debug to understand zero-link scenarios
	if ((billsToLinkRaw || []).length > 0 && candidates.length === 0) {
		try {
			console.log('[monthly-cron] ensureMonthlyDraftAndLinkBills: no candidates after period filter', {
				userId: params.userId,
				clientId: params.clientId,
				periodStart: params.periodStart,
				periodEnd: params.periodEnd,
				sampleStartTimes: (billsToLinkRaw as any[])
					.map((r: any) => (Array.isArray(r?.booking) ? r.booking[0]?.start_time : r?.booking?.start_time))
					.filter(Boolean)
					.slice(0, 5)
			})
		} catch (_) {}
	}

	const billIds = candidates.map((b: any) => b.id)
	if (billIds.length === 0) {
		return { invoiceId: invoice.id, linkedBillIds: [] }
	}

	// 3) Replace existing links atomically: unlink stale bills and link the desired set
	try {
		const { data: alreadyLinked } = await db.from('bills').select('id').eq('invoice_id', invoice.id)
		const currentIds = (alreadyLinked || []).map((r: any) => r.id)
		const toUnlink = currentIds.filter((id: string) => !billIds.includes(id))
		if (toUnlink.length > 0) {
			await db.from('bills').update({ invoice_id: null }).in('id', toUnlink)
			console.log('[monthly-cron] unlinked stale bills from invoice', { invoiceId: invoice.id, toUnlink })
		}
	} catch (_) {}

	await linkBillsToInvoice(billIds, invoice.id, db)
	console.log('[monthly-cron] linked invoice_id on bills', { invoiceId: invoice.id, billIds })

	// 4) Set invoice totals from desired candidates only
	const totalAmount = candidates.reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0)
	await db.from('invoices').update({ subtotal: totalAmount, tax_total: 0, total: totalAmount }).eq('id', invoice.id)
	console.log('[monthly-cron] invoice totals set from candidates', {
		invoiceId: invoice.id,
		subtotal: totalAmount,
		total: totalAmount
	})

	return { invoiceId: invoice.id, linkedBillIds: billIds }
}

/**
 * finalizeInvoiceOnPayment
 * ----------------------------------------------
 * Payment success path for monthly invoices: issue if needed, mark paid,
 * mirror receipt URL, generate/store PDF, and mark linked bills as paid.
 */
export async function finalizeInvoiceOnPayment(
	invoiceId: string,
	options: { paidAt?: Date; receiptUrl?: string | null },
	supabase?: SupabaseClient
): Promise<void> {
	const db = supabase || createServerSupabaseClient()
	let invoice = await getInvoiceById(invoiceId, db)
	if (!invoice) return

	// 1) Issue if still draft
	if (invoice.status === 'draft') {
		invoice = await issueInvoice(invoiceId, invoice.user_id, new Date(), db)
	}

	// 2) Mark paid + mirror receipt
	await markInvoicePaid(invoiceId, options.paidAt ?? new Date(), db)
	if (typeof options.receiptUrl !== 'undefined') {
		await updateStripeReceiptUrl(invoiceId, options.receiptUrl ?? null, db)
	}

	// 3) Generate/store PDF
	try {
		await generateAndStoreInvoicePdf(invoiceId)
	} catch (_) {}

	// 4) Mark linked bills as paid (idempotent best-effort)
	await db
		.from('bills')
		.update({ status: 'paid', paid_at: new Date().toISOString() })
		.eq('invoice_id', invoiceId)
		.neq('status', 'paid')
}
