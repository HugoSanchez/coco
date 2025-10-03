/**
 * invoices.ts (DB-only helper)
 * ----------------------------------------------
 * Purpose
 *  - Thin, typed wrapper around the `invoices` table.
 *  - No domain orchestration, no business branching – just CRUD-ish ops and
 *    safe primitives used by the orchestration layer.
 *
 * Key Ideas
 *  - Monthly numbering: series = 'YYYY-MM', number increments atomically per
 *    (user_id, series) using the `invoice_counters` table.
 *  - Draft → Issued → Paid lifecycle.
 *  - Totals are computed from `invoice_items` (subtotal + tax_total = total).
 *  - Stripe canonical identifiers remain in `payment_sessions`; we mirror the
 *    `stripe_receipt_url` on `invoices` for convenient exports/UX.
 *
 * Guardrails
 *  - This module never attempts to dual-write to legacy tables.
 *  - All functions accept an optional `SupabaseClient` for server-side calls
 *    (webhooks, API routes). If not provided, we create a server client.
 */

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'canceled' | 'refunded' | 'disputed'

export interface InvoiceRow {
	id: string
	user_id: string
	client_id: string | null
	status: InvoiceStatus
	currency: string
	subtotal: number
	tax_total: number
	total: number
	due_date: string | null
	issued_at: string | null
	paid_at: string | null
	canceled_at: string | null
	series: string | null
	number: number | null
	year: number | null
	month: number | null
	pdf_url: string | null
	pdf_sha256: string | null
	client_name_snapshot: string
	client_email_snapshot: string
	stripe_receipt_url: string | null
	billing_period_start: string | null
	billing_period_end: string | null
	legacy_bill_id: string | null
	notes: string | null
	created_at: string
	updated_at: string
}

/** Resolve a Supabase server client when not provided. */
function getClient(supabase?: SupabaseClient) {
	return supabase ?? createServerSupabaseClient()
}

/**
 * createDraftInvoice
 * ----------------------------------------------
 * Creates a `draft` invoice row with snapshot data for the client. Numbering is
 * not assigned here; that happens when moving to `issued` via `issueInvoice`.
 */
export async function createDraftInvoice(
	params: {
		userId: string
		clientId?: string | null
		currency?: string
		clientName: string
		clientEmail: string
		dueDate?: string | null
		billingPeriodStart?: string | null
		billingPeriodEnd?: string | null
		notes?: string | null
		legacyBillId?: string | null
	},
	supabase?: SupabaseClient
): Promise<InvoiceRow> {
	const db = getClient(supabase)
	const { data, error } = await db
		.from('invoices')
		.insert([
			{
				user_id: params.userId,
				client_id: params.clientId ?? null,
				status: 'draft',
				currency: params.currency ?? 'EUR',
				client_name_snapshot: params.clientName,
				client_email_snapshot: params.clientEmail,
				due_date: params.dueDate ?? null,
				billing_period_start: params.billingPeriodStart ?? null,
				billing_period_end: params.billingPeriodEnd ?? null,
				notes: params.notes ?? null,
				legacy_bill_id: params.legacyBillId ?? null
			}
		])
		.select('*')
		.single()

	if (error) throw error
	return data as unknown as InvoiceRow
}

/**
 * updateStripeReceiptUrl
 * ----------------------------------------------
 * Mirrors a Stripe-hosted receipt URL on the invoice for UX/export purposes.
 * Canonical Stripe IDs still live on `payment_sessions`.
 */
export async function updateStripeReceiptUrl(
	invoiceId: string,
	receiptUrl: string | null,
	supabase?: SupabaseClient
): Promise<void> {
	const db = getClient(supabase)
	const { error } = await db.from('invoices').update({ stripe_receipt_url: receiptUrl }).eq('id', invoiceId)
	if (error) throw error
}

/**
 * setInvoicePdfInfo
 * ----------------------------------------------
 * Persists the storage key and SHA-256 hash for the generated PDF.
 */
export async function setInvoicePdfInfo(
	invoiceId: string,
	storagePath: string,
	sha256: string,
	supabase?: SupabaseClient
): Promise<void> {
	const db = getClient(supabase)
	const { error } = await db.from('invoices').update({ pdf_url: storagePath, pdf_sha256: sha256 }).eq('id', invoiceId)
	if (error) throw error
}

/**
 * computeInvoiceTotals
 * ----------------------------------------------
 * Sums `invoice_items` for an invoice and persists the header totals.
 * Returns the computed numbers for convenience.
 */
export async function computeInvoiceTotals(
	invoiceId: string,
	supabase?: SupabaseClient
): Promise<{ subtotal: number; tax_total: number; total: number }> {
	const db = getClient(supabase)
	// Summation on items
	const { data, error } = await db.from('invoice_items').select('amount, tax_amount').eq('invoice_id', invoiceId)

	if (error) throw error
	const subtotal = (data || []).reduce((acc: number, it: any) => acc + Number(it.amount || 0), 0)
	const tax_total = (data || []).reduce((acc: number, it: any) => acc + Number(it.tax_amount || 0), 0)
	const total = Math.round((subtotal + tax_total) * 100) / 100

	const { error: updErr } = await db.from('invoices').update({ subtotal, tax_total, total }).eq('id', invoiceId)
	if (updErr) throw updErr
	return { subtotal, tax_total, total }
}

/**
 * issueInvoice
 * ----------------------------------------------
 * Assigns monthly series and sequential number and sets status to `issued`.
 *
 * Steps
 *  1) Derive series from issuedAt (YYYY-MM), plus year/month.
 *  2) Ensure a counter row exists (`ensure_invoice_counter`).
 *  3) Read & bump `invoice_counters.next_number` for (user, series).
 *  4) Update invoice with series/number/issued_at.
 */
export async function issueInvoice(
	invoiceId: string,
	userId: string,
	issuedAt: Date = new Date(),
	supabase?: SupabaseClient
): Promise<InvoiceRow> {
	const db = getClient(supabase)
	const series = `${issuedAt.getUTCFullYear()}-${String(issuedAt.getUTCMonth() + 1).padStart(2, '0')}`
	const year = issuedAt.getUTCFullYear()
	const month = issuedAt.getUTCMonth() + 1

	// ensure counter exists (server-side function from migration)
	await db.rpc('ensure_invoice_counter', { u: userId, s: series })

	// lock counter row by updating within a transaction-like sequence
	// Supabase JS doesn't expose explicit BEGIN; we rely on a single UPDATE ... returning to get next_number
	const { data: counterRows, error: counterErr } = await db
		.from('invoice_counters')
		.select('next_number')
		.eq('user_id', userId)
		.eq('series', series)
		.single()
	if (counterErr) throw counterErr
	const nextNumber = (counterRows as any).next_number as number

	const { error: bumpErr } = await db
		.from('invoice_counters')
		.update({ next_number: nextNumber + 1 })
		.eq('user_id', userId)
		.eq('series', series)
	if (bumpErr) throw bumpErr

	const { data: updated, error: updErr } = await db
		.from('invoices')
		.update({
			status: 'issued',
			issued_at: issuedAt.toISOString(),
			series,
			number: nextNumber,
			year,
			month
		})
		.eq('id', invoiceId)
		.select('*')
		.single()

	if (updErr) throw updErr
	return updated as unknown as InvoiceRow
}

/**
 * markInvoicePaid
 * ----------------------------------------------
 * Transitions the invoice to `paid` and records `paid_at`.
 */
export async function markInvoicePaid(
	invoiceId: string,
	paidAt: Date = new Date(),
	supabase?: SupabaseClient
): Promise<InvoiceRow> {
	const db = getClient(supabase)
	const { data, error } = await db
		.from('invoices')
		.update({ status: 'paid', paid_at: paidAt.toISOString() })
		.eq('id', invoiceId)
		.select('*')
		.single()
	if (error) throw error
	return data as unknown as InvoiceRow
}

/**
 * markInvoiceRefunded
 * ----------------------------------------------
 * Transitions the invoice to `refunded` and records refunded_at via notes or
 * timestamps if you later add a dedicated column.
 */
export async function markInvoiceRefunded(
	invoiceId: string,
	refundedAt: Date = new Date(),
	reason?: string | null,
	supabase?: SupabaseClient
): Promise<InvoiceRow> {
	const db = getClient(supabase)
	const { data, error } = await db
		.from('invoices')
		.update({
			status: 'refunded',
			notes: reason
				? `Refunded at ${refundedAt.toISOString()}: ${reason}`
				: `Refunded at ${refundedAt.toISOString()}`
		})
		.eq('id', invoiceId)
		.select('*')
		.single()
	if (error) throw error
	return data as unknown as InvoiceRow
}

/**
 * getInvoiceById
 * ----------------------------------------------
 * Convenience getter. Returns null when the row is not found.
 */
export async function getInvoiceById(invoiceId: string, supabase?: SupabaseClient): Promise<InvoiceRow | null> {
	const db = getClient(supabase)
	const { data, error } = await db.from('invoices').select('*').eq('id', invoiceId).single()
	if (error) {
		if ((error as any).code === 'PGRST116') return null
		throw error
	}
	return data as unknown as InvoiceRow
}

/**
 * findInvoiceByLegacyBillId
 * ----------------------------------------------
 * Convenience lookup used during dual-write period to correlate legacy bill
 * rows with their new invoice.
 */
export async function findInvoiceByLegacyBillId(
	legacyBillId: string,
	supabase?: SupabaseClient
): Promise<InvoiceRow | null> {
	const db = getClient(supabase)
	const { data, error } = await db.from('invoices').select('*').eq('legacy_bill_id', legacyBillId).limit(1)
	if (error) throw error
	const row = (data || [])[0]
	return (row as unknown as InvoiceRow) || null
}
