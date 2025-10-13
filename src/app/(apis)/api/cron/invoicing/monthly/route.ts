import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { runMonthlyConsolidation, computeUtcPeriodFromLabel } from '@/lib/invoicing/monthly-invoicing-service'

/**
 * Monthly Invoicing Cron Endpoint
 * ------------------------------------------------------------
 * PURPOSE
 * - Aggregate monthly-cadence bills into one draft invoice per (user, client, month),
 *   link those bills to the invoice, set invoice totals from linked bills, and email clients
 *   a payment link for the consolidated invoice.
 *
 * AUTHZ
 * - Protected by header X-CRON-KEY matching process.env.CRON_SECRET.
 *
 * USAGE
 * - GET /api/cron/invoicing/monthly?period=YYYY-MM&dryRun=true
 * - If period omitted, uses previous month.
 */
export async function GET(request: NextRequest) {
	try {
		// ------------------------------------------------------------
		// 1) Guard: cron secret header
		// ------------------------------------------------------------
		const secret = request.headers.get('x-cron-key') || request.headers.get('X-CRON-KEY')
		if (!secret || secret !== process.env.CRON_SECRET) {
			return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
		}

		// ------------------------------------------------------------
		// 2) Resolve period label (YYYY-MM) and dryRun flag
		// ------------------------------------------------------------
		const url = new URL(request.url)
		const periodLabel = url.searchParams.get('period') || previousMonthLabelUtc()
		const dryRun = (url.searchParams.get('dryRun') || 'false').toLowerCase() === 'true'

		// Validate period
		try {
			computeUtcPeriodFromLabel(periodLabel)
		} catch {
			return NextResponse.json({ error: 'invalid period' }, { status: 400 })
		}

		// ------------------------------------------------------------
		// 3) Execute consolidation
		// ------------------------------------------------------------
		const result = await runMonthlyConsolidation({ periodLabel, dryRun })

		return NextResponse.json({ ok: true, dryRun, period: result.period, summary: result })
	} catch (error) {
		Sentry.captureException(error, { tags: { component: 'cron', scope: 'monthly-invoicing' } })
		return NextResponse.json({ error: error instanceof Error ? error.message : 'server_error' }, { status: 500 })
	}
}

function previousMonthLabelUtc(): string {
	const now = new Date()
	const y = now.getUTCFullYear()
	const m = now.getUTCMonth() // 0-based
	const prevY = m === 0 ? y - 1 : y
	const prevM = m === 0 ? 12 : m
	return `${prevY}-${String(prevM).padStart(2, '0')}`
}
