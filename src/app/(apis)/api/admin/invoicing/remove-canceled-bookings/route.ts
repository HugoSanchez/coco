import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { computeInvoiceTotalsFromBills } from '@/lib/db/invoices'

interface CleanupRequestBody {
	userId?: string
	invoiceIds?: string[]
	dryRun?: boolean
	includePaidInvoices?: boolean
}

const AUTH_TOKEN = process.env.CRON_SECRET
const BILL_STATUSES = ['scheduled', 'pending', 'sent', 'canceled'] as const

export async function POST(request: NextRequest) {
	try {
		if (!AUTH_TOKEN) {
			return NextResponse.json({ error: 'Server missing CRON_SECRET' }, { status: 500 })
		}

		const authHeader = request.headers.get('authorization')
		if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		let body: CleanupRequestBody
		try {
			body = (await request.json()) ?? {}
		} catch {
			return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
		}

		const { userId, invoiceIds, dryRun = false, includePaidInvoices = false } = body
		if (!userId) {
			return NextResponse.json({ error: 'userId is required' }, { status: 400 })
		}

		const supabase = createServiceRoleClient()

		let query = supabase
			.from('bills')
			.select(
				`
				id,
				status,
				notes,
				invoice_id,
				client_name,
				sent_at,
				booking:bookings(status),
				invoice:invoices!bills_invoice_id_fkey(status)
			`
			)
			.eq('user_id', userId)
			.eq('billing_type', 'monthly')
			.not('invoice_id', 'is', null)
			.in('status', BILL_STATUSES as unknown as string[])

		if (invoiceIds?.length) {
			query = query.in('invoice_id', invoiceIds)
		}

		const { data, error } = await query

		if (error) {
			console.error('[cleanup] fetch error', error)
			return NextResponse.json({ error: 'Failed to load bills' }, { status: 500 })
		}

		const invoiceMeta = new Map<
			string,
			{
				clients: Set<string>
				billIds: string[]
				status?: string | null
			}
		>()

		const bills = (data || []).filter((bill: any) => {
			const isBookingCanceled = bill.booking?.status === 'canceled'
			const invoiceStatus = bill.invoice?.status
			const invoiceAllowed =
				includePaidInvoices || !invoiceStatus || invoiceStatus === 'draft' || invoiceStatus === 'issued'
			if (isBookingCanceled && invoiceAllowed && bill.invoice_id) {
				if (!invoiceMeta.has(bill.invoice_id)) {
					invoiceMeta.set(bill.invoice_id, {
						clients: new Set<string>(),
						billIds: [],
						status: bill.invoice?.status
					})
				}
				const meta = invoiceMeta.get(bill.invoice_id)!
				if (bill.client_name) {
					meta.clients.add(bill.client_name)
				}
				meta.billIds.push(bill.id)
			}
			return isBookingCanceled && invoiceAllowed
		})

		if (bills.length === 0) {
			return NextResponse.json({
				dryRun,
				cancelledBills: 0,
				updatedInvoices: [],
				message: 'No bills matched the criteria'
			})
		}

		const affectedInvoices = new Set<string>()

		if (!dryRun) {
			for (const bill of bills) {
				const auditNote = '[cleanup] Removed from invoice due to canceled booking.'
				const updatedNotes = bill.notes ? `${bill.notes}\n${auditNote}` : auditNote
				const { error: updateError } = await supabase
					.from('bills')
					.update({
						status: 'canceled',
						invoice_id: null,
						sent_at: null,
						notes: updatedNotes
					})
					.eq('id', bill.id)

				if (updateError) {
					console.error('[cleanup] failed to update bill', bill.id, updateError)
					return NextResponse.json({ error: `Failed to update bill ${bill.id}` }, { status: 500 })
				}

				if (bill.invoice_id) {
					affectedInvoices.add(bill.invoice_id)
				}
			}
		} else {
			for (const bill of bills) {
				if (bill.invoice_id) {
					affectedInvoices.add(bill.invoice_id)
				}
			}
		}

		const invoiceSummaries: Array<{ invoiceId: string; remainingBills: number; status: string }> = []
		if (!dryRun && affectedInvoices.size > 0) {
			for (const invoiceId of Array.from(affectedInvoices)) {
				const { data: remaining, error: remainingError } = await supabase
					.from('bills')
					.select('id')
					.eq('invoice_id', invoiceId)

				if (remainingError) {
					console.error('[cleanup] failed to load remaining bills', invoiceId, remainingError)
					return NextResponse.json({ error: 'Failed to refresh invoice totals' }, { status: 500 })
				}

				const remainingCount = remaining?.length || 0

				if (remainingCount === 0) {
					const { error: cancelInvoiceError } = await supabase
						.from('invoices')
						.update({
							status: 'canceled',
							subtotal: 0,
							tax_total: 0,
							total: 0
						})
						.eq('id', invoiceId)

					if (cancelInvoiceError) {
						console.error('[cleanup] failed to cancel invoice', invoiceId, cancelInvoiceError)
						return NextResponse.json({ error: 'Failed to cancel empty invoice' }, { status: 500 })
					}

					invoiceSummaries.push({ invoiceId, remainingBills: 0, status: 'canceled' })
				} else {
					await computeInvoiceTotalsFromBills(invoiceId, supabase)
					invoiceSummaries.push({ invoiceId, remainingBills: remainingCount, status: 'draft' })
				}
			}
		} else if (dryRun) {
			for (const invoiceId of Array.from(affectedInvoices)) {
				invoiceSummaries.push({ invoiceId, remainingBills: NaN, status: 'pending-update' })
			}
		}

		const affectedInvoicesDetails = Array.from(invoiceMeta.entries()).map(([invoiceId, meta]) => ({
			invoiceId,
			status: meta.status ?? 'unknown',
			billIds: meta.billIds,
			clients: Array.from(meta.clients)
		}))

		return NextResponse.json({
			dryRun,
			cancelledBills: bills.length,
			invoicesTouched: Array.from(affectedInvoices),
			affectedInvoices: affectedInvoicesDetails,
			updatedInvoices: invoiceSummaries
		})
	} catch (error) {
		console.error('[cleanup] unexpected error', error)
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
	}
}
