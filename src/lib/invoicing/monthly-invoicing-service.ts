import {
	listMonthlyDraftItemsForPeriod,
	reassignInvoiceItemsToInvoice
} from '@/lib/db/invoice-items'
import {
	findOrCreateMonthlyInvoice,
	computeInvoiceTotals,
	deleteEmptyDraftInvoices
} from '@/lib/db/invoices'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { sendMonthlyBillEmail } from '@/lib/emails/email-service'
import { getProfileById } from '@/lib/db/profiles'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Monthly Invoicing Service
 * -----------------------------------------------------------
 * PURPOSE
 * - Consolidate per-booking draft invoice items (cadence='monthly') into
 *   one invoice per (user, client, period).
 * - Reassign invoice_items to the consolidated invoice.
 * - Delete now-empty per-booking draft invoices.
 * - Email the client with a payment link to the consolidated invoice.
 *
 * NOTES
 * - Period is UTC-based boundaries.
 * - Keeps invoices as 'draft'; the webhook issues-if-draft upon payment.
 * - Idempotent via reassignment: re-running will find no orphaned items.
 */

export interface MonthlyCronResult {
	period: { start: string; end: string; label: string }
	groupsProcessed: number
	invoicesCreated: number
	invoicesReused: number
	itemsMoved: number
	draftsDeleted: number
	errors: Array<{ userId: string; clientId: string | null; error: string }>
}

/**
 * computeUtcPeriodFromLabel
 * -----------------------------------------------------------
 * Given a YYYY-MM label, returns the UTC start/end ISO strings for the full month.
 */
export function computeUtcPeriodFromLabel(label: string): {
	start: string
	end: string
} {
	const [y, m] = label.split('-').map((v) => parseInt(v, 10))
	const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
	const end = new Date(Date.UTC(y, m, 0, 23, 59, 59))
	return { start: start.toISOString(), end: end.toISOString() }
}

function spanishMonthLabelFromPeriodStart(periodStartIso: string) {
	const date = new Date(periodStartIso)
	const monthNames = [
		'Enero',
		'Febrero',
		'Marzo',
		'Abril',
		'Mayo',
		'Junio',
		'Julio',
		'Agosto',
		'Septiembre',
		'Octubre',
		'Noviembre',
		'Diciembre'
	]
	return `${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/**
 * runMonthlyConsolidation
 * -----------------------------------------------------------
 * Main entry point for the cron job.
 * - Loads candidate items
 * - Groups by (user, client)
 * - Finds or creates monthly invoice
 * - Moves items, recomputes totals
 * - Deletes empty drafts
 * - Sends email with payment link
 */
export async function runMonthlyConsolidation(params: {
	periodLabel: string // YYYY-MM
	dryRun?: boolean
	supabase?: SupabaseClient
}): Promise<MonthlyCronResult> {
	const db = params.supabase ?? createServiceRoleClient()
	const { start, end } = computeUtcPeriodFromLabel(params.periodLabel)

	// 1) Collect candidate items (monthly cadence, in period)
	const items = await listMonthlyDraftItemsForPeriod(start, end, db)

	// Group by (user_id, client_id)
	type GroupKey = string
	const groups = new Map<GroupKey, any[]>()
	for (const row of items as any[]) {
		const inv = (row as any).invoices
		if (!inv) continue
		const key = `${inv.user_id}::${inv.client_id || 'null'}`
		if (!groups.has(key)) groups.set(key, [])
		groups.get(key)!.push(row)
	}

	let invoicesCreated = 0
	let invoicesReused = 0
	let itemsMoved = 0
	let draftsDeleted = 0
	const errors: Array<{
		userId: string
		clientId: string | null
		error: string
	}> = []

	// 2) Process each group
	for (const [key, groupRows] of Array.from(groups.entries())) {
		const [userId, clientIdStr] = key.split('::')
		const clientId = clientIdStr === 'null' ? null : clientIdStr
		try {
			// Gather client snapshot & currency from the first item invoice header
			const firstInv = (groupRows[0] as any).invoices
			const clientName = firstInv.client_name_snapshot
			const clientEmail = firstInv.client_email_snapshot
			const currency = firstInv.currency || 'EUR'

			// 2a) Find or create the monthly invoice for this period
			const monthly = await findOrCreateMonthlyInvoice(
				{
					userId,
					clientId,
					clientName,
					clientEmail,
					currency,
					periodStart: start,
					periodEnd: end
				},
				db
			)
			if (monthly.billing_period_start) invoicesReused += 1
			else invoicesCreated += 1

			// 2b) Move items into the monthly invoice
			const itemIds = groupRows.map((r: any) => r.id as string)
			if (!params.dryRun) {
				await reassignInvoiceItemsToInvoice(itemIds, monthly.id, db)
				await computeInvoiceTotals(monthly.id, db)
			}
			itemsMoved += itemIds.length

			// 2c) Delete empty draft invoices that were the old parents for these items
			const sourceInvoiceIds: string[] = Array.from(
				new Set<string>(groupRows.map((r: any) => String(r.invoice_id)))
			)
			if (!params.dryRun) {
				draftsDeleted += await deleteEmptyDraftInvoices(
					sourceInvoiceIds,
					db
				)
			}

			// 2d) Email the client with consolidated invoice payment link (keep draft)
			if (!params.dryRun && clientEmail) {
				try {
					// Practitioner context for subject/body
					const practitioner = await getProfileById(userId, db)
					const practitionerName =
						practitioner?.name || 'Tu profesional'
					const paymentLink = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/invoices/${monthly.id}`
					const monthLabel = spanishMonthLabelFromPeriodStart(start)

					await sendMonthlyBillEmail({
						to: clientEmail,
						clientName: clientName,
						amount: monthly.total,
						currency,
						monthLabel,
						practitionerName,
						paymentUrl: paymentLink
					})
				} catch (emailErr) {
					errors.push({
						userId,
						clientId,
						error: `email_failed: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`
					})
				}
			}
		} catch (e) {
			errors.push({
				userId,
				clientId,
				error: e instanceof Error ? e.message : String(e)
			})
		}
	}

	return {
		period: { start, end, label: params.periodLabel },
		groupsProcessed: groups.size,
		invoicesCreated,
		invoicesReused,
		itemsMoved,
		draftsDeleted,
		errors
	}
}
