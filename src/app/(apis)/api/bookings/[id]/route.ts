import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/db/bookings'
import { getClientById } from '@/lib/db/clients'
import { getProfileById } from '@/lib/db/profiles'
import { getBillsForBooking } from '@/lib/db/bills'

/**
 * GET /api/bookings/[id]
 *
 * Retrieves booking details by ID for display on the payment success page.
 * This endpoint is used by clients (not authenticated users) to display
 * confirmation information after successful payment.
 *
 * Returns:
 * - Client name and consultation date
 * - Practitioner name for confirmation
 * - Basic booking information for display
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
	try {
		const bookingId = params.id

		if (!bookingId) {
			return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 })
		}

		const supabase = createClient()
		const booking = await getBookingById(bookingId, supabase)
		if (!booking) {
			return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
		}
		const client = booking.client_id ? await getClientById(booking.client_id, supabase) : null
		const practitioner = await getProfileById(booking.user_id, supabase)
		const bills = await getBillsForBooking(booking.id, supabase)

		// Format the response for display
		const response = {
			bookingId: booking.id,
			clientName: client?.name || 'Cliente',
			clientLastName: client?.last_name || null,
			clientEmail: client?.email || null,
			practitionerName: practitioner?.name || 'Profesional',
			consultationDate: booking.start_time,
			consultationTime: booking.start_time,
			status: booking.status,
			amount: bills?.[0]?.amount || 0,
			currency: bills?.[0]?.currency || 'EUR',
			bill: bills && bills.length > 0 ? bills[0] : null
		}

		return NextResponse.json(response)
	} catch (error) {
		console.error('Error fetching booking details:', error)
		return NextResponse.json(
			{
				error: 'Failed to fetch booking details',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
