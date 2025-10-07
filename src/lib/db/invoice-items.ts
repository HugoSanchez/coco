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
