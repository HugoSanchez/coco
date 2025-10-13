import { getInvoiceById } from '@/lib/db/invoices'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { sendMonthlyBillEmail } from '@/lib/emails/email-service'
import { getProfileById } from '@/lib/db/profiles'
import { getClientById } from '@/lib/db/clients'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureMonthlyDraftAndLinkBills } from '@/lib/invoicing/invoice-orchestration'

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
	billsLinked: number
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

	// Debug removed: start

	// 1) Collect candidate monthly bills not yet linked to an invoice
	const { data: bills } = await db
		.from('bills')
		.select(`id, user_id, client_id, amount, currency, billing_type, invoice_id, booking:bookings(start_time)`) // embed start_time for period filter
		.eq('billing_type', 'monthly')
		.is('invoice_id', null)

	// Debug removed: fetched candidate bills count

	// Group by (user_id, client_id)
	type GroupKey = string
	const groups = new Map<GroupKey, any[]>()
	for (const row of (bills as any[]) || []) {
		const key = `${row.user_id}::${row.client_id || 'null'}`
		if (!groups.has(key)) groups.set(key, [])
		groups.get(key)!.push(row)
	}
	// Debug removed: group summary

	let invoicesCreated = 0
	let invoicesReused = 0
	let billsLinked = 0
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
			// Debug removed: processing group summary
			// 2a) Ensure/obtain draft invoice for period and link bills
			const { invoiceId, linkedBillIds } = await ensureMonthlyDraftAndLinkBills(
				{ userId, clientId, periodStart: start, periodEnd: end },
				db
			)
			billsLinked += linkedBillIds.length
			// Debug removed: linked bills count

			// Only send when we actually linked at least one bill in this run.
			// This prevents multiple emails for the same client when nothing changed.
			if (linkedBillIds.length === 0) {
				// Debug removed: skip email (no new links this run)
				continue
			}

			// 2b) Load invoice (we'll prefer fresh client data for email)
			const invoice = await getInvoiceById(invoiceId, db)

			// 2c) Email the client with consolidated invoice payment link (keep draft)
			if (!params.dryRun && invoice) {
				try {
					// Prefer fresh client data when available
					let emailTo = invoice.client_email_snapshot
					let clientDisplayName = invoice.client_name_snapshot
					if (invoice.client_id) {
						const fresh = await getClientById(invoice.client_id, db)
						if (fresh) {
							emailTo = (fresh as any).email || emailTo
							clientDisplayName =
								[fresh.name || '', (fresh as any).last_name || ''].filter(Boolean).join(' ').trim() ||
								clientDisplayName
						}
					}

					const practitioner = await getProfileById(userId, db)
					const practitionerName = practitioner?.name || 'Tu profesional'
					const paymentLink = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/invoices/${invoiceId}`
					const monthLabel = spanishMonthLabelFromPeriodStart(start)

					if (!emailTo) {
						// Debug removed: skip email (no recipient)
					} else {
						await sendMonthlyBillEmail({
							to: emailTo,
							clientName: clientDisplayName,
							amount: invoice.total,
							currency: invoice.currency || 'EUR',
							monthLabel,
							practitionerName,
							paymentUrl: paymentLink
						})
						// Mark all linked bills as 'sent' so UI reflects that emails went out
						try {
							await db
								.from('bills')
								.update({ status: 'sent', sent_at: new Date().toISOString() })
								.eq('invoice_id', invoiceId)
						} catch (_) {}
						// Debug removed: email sent
					}
				} catch (emailErr) {
					errors.push({
						userId,
						clientId,
						error: `email_failed: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`
					})
					// Debug removed: email failed
				}
			} else {
				// Debug removed: skip email (dry run)
			}
		} catch (e) {
			errors.push({
				userId,
				clientId,
				error: e instanceof Error ? e.message : String(e)
			})
			// Debug removed: group failed
		}
	}

	return {
		period: { start, end, label: params.periodLabel },
		groupsProcessed: groups.size,
		invoicesCreated,
		invoicesReused,
		billsLinked,
		errors
	}
}
