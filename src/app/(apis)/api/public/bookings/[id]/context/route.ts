import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/db/bookings'
import { getProfileById } from '@/lib/db/profiles'
import { verifyManageSig } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

/**
 * GET /api/public/bookings/:id/context?sig=...&action=reschedule|cancel
 *
 * Verifies the HMAC link for the given action and returns minimal data needed:
 * - username (for fetching slots/profile)
 * - currentStart/currentEnd (ISO)
 * - status (e.g., 'canceled')
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
	try {
		const { id } = params
		const { searchParams } = new URL(request.url)
		const sig = searchParams.get('sig') || ''
		const action = (searchParams.get('action') || 'reschedule') as 'reschedule' | 'cancel'
		if (!id || !sig) return NextResponse.json({ error: 'missing_params' }, { status: 400 })

		const service = createServiceRoleClient()
		const booking = await getBookingById(id, service as any)
		if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 })

		// Validate signature with bookingId + client.email + action
		const clientEmail = booking.client?.email
		if (!clientEmail) return NextResponse.json({ error: 'client_not_found' }, { status: 404 })
		const ok = verifyManageSig(sig, id, clientEmail, action)
		if (!ok) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })

		const profile = await getProfileById(booking.user_id, service as any)
		const rawUsername = (profile as any)?.username || null
		// Normalize: trim whitespace and remove any trailing dashes that may have slipped in
		const username = rawUsername ? String(rawUsername).trim().replace(/-+$/g, '') : null
		console.log('[PublicContext] username raw → normalized', rawUsername, '→', username)

		return NextResponse.json({
			userId: booking.user_id,
			username,
			currentStart: booking.start_time,
			currentEnd: booking.end_time,
			status: booking.status
		})
	} catch (e) {
		console.error('public context error', e)
		return NextResponse.json({ error: 'server_error' }, { status: 500 })
	}
}
