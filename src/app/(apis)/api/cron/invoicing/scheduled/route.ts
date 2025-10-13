import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { sendBillPaymentEmail } from '@/lib/bookings/booking-orchestration-service'
import { claimDueBillsForEmail, releaseBillEmailLock } from '@/lib/db/bills'

// Force dynamic because this uses environment variables and server-side IO
export const dynamic = 'force-dynamic'

/**
 * Minimal cron endpoint: send due payment emails.
 * Picks pending, unsent bills that are due (email_scheduled_at <= now),
 * atomically locks them, sends email, marks as sent.
 */
export async function GET(request: Request) {
	////////////////////////////////////////////////////////////////
	///// Step 0: Authenticate request
	///////////////////////////////////////////////////////////////

	const auth = process.env.CRON_SECRET
	const header = request.headers.get('authorization')
	if (
		!auth ||
		!header?.startsWith('Bearer ') ||
		header.split(' ')[1] !== auth
	) {
		return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
	}

	///////////////////////////////////////////////////////////////
	///// Step 1: Send due payment emails
	///////////////////////////////////////////////////////////////
	let sent = 0
	let failed = 0
	const supabase = createServiceRoleClient()
	const nowIso = new Date().toISOString()

	// Atomically claim a small batch to avoid long jobs (via DB helper)
	const bills = await claimDueBillsForEmail(nowIso, 25, supabase)

	for (const bill of bills) {
		const result = await sendBillPaymentEmail(bill as any, supabase)
		if (result.success) {
			sent += 1
			// Clear lock explicitly (status update already done in helper)
			await releaseBillEmailLock(bill.id, supabase)
		} else {
			failed += 1
			// Release lock so it can retry next run
			await releaseBillEmailLock(bill.id, supabase)
		}
	}

	return NextResponse.json({ picked: bills.length, sent, failed })
}
