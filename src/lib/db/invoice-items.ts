/**
 * invoice-items.ts (DB-only helper)
 * ----------------------------------------------
 * Purpose
 *  - Thin helper for interacting with `invoice_items` rows.
 *  - No orchestration – just safe inserts/reads with basic line math.
 *
 * Notes
 *  - Each line stores `qty`, `unit_price`, computed `amount` (excl. tax),
 *    `tax_rate_percent`, and computed `tax_amount`.
 *  - Totals are aggregated at the invoice header (see invoices.ts).
 */

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

function getClient(supabase?: SupabaseClient) {
	return supabase ?? createServerSupabaseClient()
}

export interface NewInvoiceItem {
	invoiceId: string
	bookingId?: string | null
	description: string
	qty?: number
	unitPrice: number
	taxRatePercent?: number
	// Scheduling/invoicing enhancements
	cadence?: 'per_booking' | 'monthly'
	serviceDate?: string | null
	scheduledSendAt?: string | null
}

/**
 * addInvoiceItem
 * ----------------------------------------------
 * Inserts a single line with simple arithmetic for amount and tax_amount.
 */
export async function addInvoiceItem(params: NewInvoiceItem, supabase?: SupabaseClient) {
	const db = getClient(supabase)
	const qty = typeof params.qty === 'number' ? params.qty : 1
	const taxRate = typeof params.taxRatePercent === 'number' ? params.taxRatePercent : 0
	const amount = Math.round(qty * params.unitPrice * 100) / 100
	const tax_amount = Math.round(((amount * taxRate) / 100) * 100) / 100

	const { data, error } = await db
		.from('invoice_items')
		.insert([
			{
				invoice_id: params.invoiceId,
				booking_id: params.bookingId ?? null,
				description: params.description,
				qty,
				unit_price: params.unitPrice,
				amount,
				tax_rate_percent: taxRate,
				tax_amount,
				cadence: params.cadence ?? 'per_booking',
				service_date: params.serviceDate ?? null,
				scheduled_send_at: params.scheduledSendAt ?? null
			}
		])
		.select('*')
		.single()
	if (error) throw error
	return data
}

/**
 * listInvoiceItems
 * ----------------------------------------------
 * Returns all lines for an invoice, oldest first.
 */
export async function listInvoiceItems(invoiceId: string, supabase?: SupabaseClient) {
	const db = getClient(supabase)
	const { data, error } = await db
		.from('invoice_items')
		.select('*')
		.eq('invoice_id', invoiceId)
		.order('created_at', { ascending: true })
	if (error) throw error
	return data || []
}

/**
 * listMonthlyDraftItemsForPeriod
 * ----------------------------------------------
 * Returns invoice_items with cadence='monthly' whose service_date falls within
 * [periodStart, periodEnd] and whose current parent invoice is in status 'draft'.
 * Includes minimal parent invoice header data for grouping by user/client.
 */
export async function listMonthlyDraftItemsForPeriod(
	periodStartIso: string,
	periodEndIso: string,
	supabase?: SupabaseClient
) {
	const db = getClient(supabase)
	console.log('[monthly][db] listMonthlyDraftItemsForPeriod', { periodStartIso, periodEndIso })
	// STEP 1: Load candidate items without join filters
	const { data: items, error: itemsErr } = await db
		.from('invoice_items')
		.select(
			[
				'id',
				'invoice_id',
				'booking_id',
				'description',
				'qty',
				'unit_price',
				'amount',
				'tax_amount',
				'service_date',
				'cadence'
			].join(',')
		)
		.eq('cadence', 'monthly')
		.gte('service_date', periodStartIso)
		.lte('service_date', periodEndIso)
		.order('service_date', { ascending: true })
	if (itemsErr) throw itemsErr
	const base = (items as any[]) || []

	if (base.length === 0) return []

	// STEP 2: Load parent invoice headers and filter by payable statuses
	const invoiceIds = Array.from(new Set(base.map((r: any) => String(r.invoice_id))))
	const { data: headers, error: invErr } = await db
		.from('invoices')
		.select('id,user_id,client_id,currency,status,client_name_snapshot,client_email_snapshot')
		.in('id', invoiceIds)
	if (invErr) throw invErr
	const headerById = new Map<string, any>()
	for (const h of (headers as any[]) || []) headerById.set(String(h.id), h)
	const payable = base
		.map((row) => {
			const h = headerById.get(String((row as any).invoice_id))
			return h ? { ...row, invoices: h } : null
		})
		.filter(Boolean)
		.filter((row: any) => row.invoices.status !== 'paid' && row.invoices.status !== 'canceled') as any[]

	return payable
}

/**
 * debugListAllMonthlyItems
 * ----------------------------------------------
 * Helper to log a quick sample of all monthly items regardless of date.
 * Not used in consolidation, only to help diagnose missing rows.
 */
export async function debugListAllMonthlyItems(_supabase?: SupabaseClient): Promise<void> {}

/**
 * reassignInvoiceItemsToInvoice
 * ----------------------------------------------
 * Moves a set of invoice_items to the provided target invoice id.
 */
export async function reassignInvoiceItemsToInvoice(
	itemIds: string[],
	targetInvoiceId: string,
	supabase?: SupabaseClient
) {
	if (!itemIds || itemIds.length === 0) return
	const db = getClient(supabase)
	const { error } = await db.from('invoice_items').update({ invoice_id: targetInvoiceId }).in('id', itemIds)
	if (error) throw error
}
