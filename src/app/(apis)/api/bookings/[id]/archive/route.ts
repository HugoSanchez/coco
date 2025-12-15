import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { archiveBooking, getBookingById } from '@/lib/db/bookings'

/**
 * POST /api/bookings/[id]/archive
 * Soft-archives a booking so it is hidden from default views.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
	try {
		const supabase = createClient()

		// Auth
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()
		if (authError || !user) {
			return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
		}

		const bookingId = params.id
		if (!bookingId) {
			return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 })
		}

		// Ownership check
		const booking = await getBookingById(bookingId, supabase)
		if (!booking) {
			return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
		}
		if (booking.user_id !== user.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
		}

		// Already archived? Idempotent success
		if (booking.archived_at) {
			return NextResponse.json({ success: true, booking })
		}

		const updated = await archiveBooking(bookingId, user.id, supabase)
		return NextResponse.json({ success: true, booking: updated })
	} catch (error) {
		console.error('Archive booking error', error)
		return NextResponse.json(
			{ success: false, error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		)
	}
}
