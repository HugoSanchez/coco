import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { stripeService } from '@/lib/payments/stripe-service'
import { updatePaymentSessionStatus } from '@/lib/db/payment-sessions'

// TODO: Populate with the invoice IDs that need their payment sessions invalidated
const TARGET_INVOICE_IDS: string[] = [
	'09185ea2-0dce-414b-a7ba-0a443b96bdce',
	'b6a0148f-53a8-41f4-9bfe-d47e34d01606',
	'ecdd9d19-38e6-4a55-a74a-028df4880995',
	'9220b631-46ef-4df3-bc72-254f11300a57',
	'69df764c-98a7-4fd5-b91e-3bf11a3fbfba',
	'52f99c69-8ef9-4930-8d0e-cf1ee270129d',
	'7bdbbbb1-8ca8-41f4-b8e4-766172ea7bf9',
	'13decf83-26f4-4f50-bb8e-829aeaaeb560'
]

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

		if (TARGET_INVOICE_IDS.length === 0) {
			return NextResponse.json(
				{ error: 'TARGET_INVOICE_IDS array is empty. Populate it before running this endpoint.' },
				{ status: 400 }
			)
		}

		const supabase = createServiceRoleClient()

		const { data: sessions, error } = await supabase
			.from('payment_sessions')
			.select('id, invoice_id, status, stripe_session_id')
			.in('invoice_id', TARGET_INVOICE_IDS)
			.eq('status', 'pending')

		if (error) {
			console.error('[cancel-sessions] fetch error', error)
			return NextResponse.json({ error: 'Failed to load payment sessions' }, { status: 500 })
		}

		if (!sessions || sessions.length === 0) {
			return NextResponse.json({
				message: 'No pending payment sessions found for the provided invoices',
				invoices: TARGET_INVOICE_IDS
			})
		}

		const expired: string[] = []
		const cancelled: string[] = []
		const failures: Array<{ sessionId: string; reason: string }> = []

		for (const session of sessions) {
			if (session.stripe_session_id) {
				const result = await stripeService.expireCheckoutSession(session.stripe_session_id)
				if (result.success) {
					expired.push(session.stripe_session_id)
				} else {
					failures.push({
						sessionId: session.id,
						reason: result.error || 'Unknown Stripe error'
					})
				}
			}

			try {
				await updatePaymentSessionStatus(
					session.id,
					{
						status: 'cancelled'
					},
					supabase
				)
				cancelled.push(session.id)
			} catch (updateError) {
				console.error('[cancel-sessions] failed to update session', session.id, updateError)
				failures.push({
					sessionId: session.id,
					reason: updateError instanceof Error ? updateError.message : 'Failed to update status'
				})
			}
		}

		return NextResponse.json({
			invoices: TARGET_INVOICE_IDS,
			pendingSessionsFound: sessions.length,
			expiredStripeSessions: expired,
			cancelledSessions: cancelled,
			failures
		})
	} catch (error) {
		console.error('[cancel-sessions] unexpected error', error)
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
	}
}
