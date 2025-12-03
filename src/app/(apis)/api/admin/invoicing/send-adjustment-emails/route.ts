import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getProfileById } from '@/lib/db/profiles'
import { sendBulkInvoiceAdjustments } from '@/lib/emails/email-service'

interface NotificationInput {
	invoiceId: string
	clientEmail?: string
	clientName?: string
	monthLabel?: string
	paymentUrl?: string
	practitionerName?: string
	amount?: number
	currency?: string
	forceSend?: boolean
}

interface RequestBody {
	userId?: string
	invoiceIds?: string[]
	notifications?: NotificationInput[]
	dryRun?: boolean
	preview?: boolean
	previewRecipient?: string
}

const AUTH_TOKEN = process.env.CRON_SECRET

export async function POST(request: NextRequest) {
	try {
		if (!AUTH_TOKEN) {
			return NextResponse.json({ error: 'Server missing CRON_SECRET' }, { status: 500 })
		}

		const authHeader = request.headers.get('authorization')
		if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		let body: RequestBody
		try {
			body = (await request.json()) ?? {}
		} catch {
			return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
		}

		const { userId, invoiceIds = [], notifications = [], dryRun = false, preview = false, previewRecipient } = body
		if (!userId) {
			return NextResponse.json({ error: 'userId is required' }, { status: 400 })
		}

		if (!invoiceIds.length && notifications.length === 0) {
			return NextResponse.json(
				{ error: 'Provide invoiceIds or a notifications array to send emails' },
				{ status: 400 }
			)
		}

		const supabase = createServiceRoleClient()
		const practitioner = await getProfileById(userId, supabase)
		const practitionerName =
			notifications[0]?.practitionerName || practitioner?.full_name || practitioner?.name || 'Tu profesional'
		const baseUrl = resolveBaseUrl()

		const explicitNotifications = new Map<string, NotificationInput>()
		for (const entry of notifications) {
			if (entry.invoiceId) {
				explicitNotifications.set(entry.invoiceId, entry)
			}
		}

		const invoicesToFetch = invoiceIds.length
			? invoiceIds
			: Array.from(new Set(notifications.map((n) => n.invoiceId))).filter(Boolean)

		let invoiceRows: any[] = []
		if (invoicesToFetch.length) {
			const { data, error } = await supabase
				.from('invoices')
				.select(
					'id, user_id, client_name_snapshot, client_email_snapshot, billing_period_start, total, currency, status'
				)
				.in('id', invoicesToFetch)
				.eq('user_id', userId)

			if (error) {
				console.error('[emails] failed to fetch invoices', error)
				return NextResponse.json({ error: 'Failed to load invoices' }, { status: 500 })
			}
			invoiceRows = (data || []).filter(
				(row) => row.status !== 'paid' && row.status !== 'refunded' && row.status !== 'canceled'
			)
		}

		const resolved: NotificationInput[] = []

		for (const row of invoiceRows) {
			const explicit = explicitNotifications.get(row.id)
			const paymentUrl =
				explicit?.paymentUrl || (baseUrl ? `${baseUrl}/api/payments/invoices/${row.id}` : undefined)

			if (!(explicit?.clientEmail || row.client_email_snapshot)) {
				continue
			}

			resolved.push({
				invoiceId: row.id,
				clientEmail: explicit?.clientEmail || row.client_email_snapshot,
				clientName: explicit?.clientName || row.client_name_snapshot || 'Paciente',
				monthLabel: explicit?.monthLabel || monthLabelFromIso(row.billing_period_start),
				paymentUrl,
				practitionerName:
					explicit?.practitionerName || practitioner?.full_name || practitioner?.name || practitionerName,
				amount: explicit?.amount ?? row.total ?? undefined,
				currency: explicit?.currency || row.currency || 'EUR'
			})
			explicitNotifications.delete(row.id)
		}

		// Include explicit notifications that were not fetched from DB (already fully specified)
		for (const entry of Array.from(explicitNotifications.values())) {
			if (!entry.clientEmail || !entry.paymentUrl) continue

			let allowSend = false
			if (entry.forceSend) {
				allowSend = true
			} else if (entry.invoiceId) {
				const { data, error } = await supabase
					.from('invoices')
					.select('status')
					.eq('id', entry.invoiceId)
					.eq('user_id', userId)
					.single()

				if (error) {
					console.warn(
						'[emails] skipping explicit notification, invoice fetch failed',
						entry.invoiceId,
						error
					)
				} else if (data && !['paid', 'refunded', 'canceled'].includes(data.status)) {
					allowSend = true
				}
			}

			if (!allowSend) continue

			resolved.push({
				invoiceId: entry.invoiceId,
				clientEmail: entry.clientEmail,
				clientName: entry.clientName || 'Paciente',
				monthLabel: entry.monthLabel,
				paymentUrl: entry.paymentUrl,
				practitionerName: entry.practitionerName || practitionerName,
				amount: entry.amount,
				currency: entry.currency || 'EUR'
			})
		}

		if (resolved.length === 0) {
			return NextResponse.json({
				dryRun,
				total: 0,
				notifications: [],
				message: 'No notifications to send'
			})
		}

		if (dryRun) {
			return NextResponse.json({
				dryRun: true,
				total: resolved.length,
				notifications: resolved
			})
		}

		const recipientOverride = preview && previewRecipient ? previewRecipient : undefined

		const sendResult = await sendBulkInvoiceAdjustments(
			resolved.map((entry) => ({
				to: recipientOverride || entry.clientEmail!,
				clientName: entry.clientName || 'Paciente',
				monthLabel: entry.monthLabel,
				paymentUrl: entry.paymentUrl,
				practitionerName: entry.practitionerName || practitionerName,
				amount: entry.amount,
				currency: entry.currency,
				notes:
					preview && recipientOverride
						? `Email original para ${entry.clientName || 'Paciente'} (${entry.clientEmail})`
						: undefined
			}))
		)

		return NextResponse.json({
			dryRun: false,
			preview,
			previewRecipient: recipientOverride || null,
			total: resolved.length,
			sendResult
		})
	} catch (error) {
		console.error('[emails] unexpected error', error)
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
	}
}

function resolveBaseUrl() {
	const envUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
	if (!envUrl) return undefined
	return envUrl.startsWith('http') ? envUrl.replace(/\/$/, '') : `https://${envUrl.replace(/\/$/, '')}`
}

function monthLabelFromIso(iso?: string | null) {
	if (!iso) return undefined
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return undefined
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
