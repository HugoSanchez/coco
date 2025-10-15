import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { computeMonthlySlots } from '@/lib/calendar/availability-orchestration'
import { findOrCreateClientByEmail } from '@/lib/db/clients'
import { getUserDefaultBillingSettings } from '@/lib/db/billing-settings'
import { orchestrateBookingCreation } from '@/lib/bookings/booking-orchestration-service'
import { getUserIdByUsername } from '@/lib/db/profiles'

export const dynamic = 'force-dynamic'

/**
 * POST /api/public/bookings
 *
 * Creates a booking for a practitioner identified by username.
 * Steps:
 * 1) Resolve practitioner by username → userId
 * 2) Validate inputs; normalize ISO
 * 3) Re-check availability for overlap safety
 * 4) Find-or-create client by email
 * 5) Resolve price from practitioner default; fallback 0
 * 6) Call orchestrator to create booking + billing flow (email immediate)
 * 7) Return minimal success payload
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json()
		const { username, start, end, patient, mode, locationText, consultationType } = body || {}

		if (!username || !start || !end || !patient?.email || !patient?.name) {
			return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
		}

		const startIso = new Date(start).toISOString()
		const endIso = new Date(end).toISOString()
		if (
			Number.isNaN(new Date(startIso).getTime()) ||
			Number.isNaN(new Date(endIso).getTime()) ||
			new Date(endIso) <= new Date(startIso)
		) {
			return NextResponse.json({ error: 'invalid_time_range' }, { status: 400 })
		}

		const service = createServiceRoleClient()

		// Step 1: resolve practitioner by username
		const userId = await getUserIdByUsername(username, service as any)
		if (!userId) return NextResponse.json({ error: 'practitioner_not_found' }, { status: 404 })

		// Step 3: re-check availability quickly using existing monthly slots (CET window)
		const monthIso = new Date(startIso).toISOString()
		const slotsResult = await computeMonthlySlots({
			userId,
			monthIso,
			tz: 'Europe/Madrid',
			window: '08:00-20:00',
			durationMin: 60,
			supabase: service as any
		})
		const startDay = startIso.slice(0, 10)
		const slotsForDay = slotsResult.slotsByDay[startDay] || []
		const conflicts = !slotsForDay.some((s) => s.start === startIso && s.end === endIso)
		if (conflicts) return NextResponse.json({ error: 'slot_conflict' }, { status: 409 })

		// Step 4: find or create client for practitioner
		const client = await findOrCreateClientByEmail(userId, patient.name, patient.email, service as any)

		// Step 5: resolve price from default settings; consider first consultation if requested
		const defaults = await getUserDefaultBillingSettings(userId, service as any)
		let amount = defaults?.billing_amount ?? 0
		if (consultationType === 'first' && (defaults as any)?.first_consultation_amount != null) {
			amount = (defaults as any).first_consultation_amount as number
		}

		// Step 6: orchestrate booking creation
		const billing = { type: 'per_booking' as const, amount, currency: 'EUR', paymentEmailLeadHours: 0 }
		const requestPayload = {
			userId,
			clientId: client.id,
			startTime: startIso,
			endTime: endIso,
			mode: mode === 'in_person' ? 'in_person' : 'online',
			locationText: mode === 'in_person' ? locationText || null : null
		}

		const result = await orchestrateBookingCreation(requestPayload as any, billing as any, service as any)

		return NextResponse.json({ success: true, bookingId: result.booking.id })
	} catch (e) {
		console.error('public bookings create error', e)
		return NextResponse.json({ error: 'server_error' }, { status: 500 })
	}
}
