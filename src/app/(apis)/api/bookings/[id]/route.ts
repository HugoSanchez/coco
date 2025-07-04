import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const bookingId = params.id

		if (!bookingId) {
			return NextResponse.json(
				{ error: 'Booking ID is required' },
				{ status: 400 }
			)
		}

		// Use service role client to bypass RLS since client is not authenticated
		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.SUPABASE_SERVICE_ROLE_KEY!
		)

		// First, let's try a simple query without joins to see if the booking exists
		const { data: simpleBooking, error: simpleError } = await supabase
			.from('bookings')
			.select('*')
			.eq('id', bookingId)
			.single()

		// If simple booking doesn't work, return early with debug info
		if (simpleError || !simpleBooking) {
			console.log('Simple booking query failed')
			return NextResponse.json({
				debug: true,
				bookingId,
				simpleError: simpleError?.message,
				simpleBooking
			})
		}

		// Get booking information
		const booking = simpleBooking

		// Get client information
		const { data: client } = await supabase
			.from('clients')
			.select('name, email')
			.eq('id', booking.client_id)
			.single()

		// Get practitioner information
		const { data: practitioner } = await supabase
			.from('profiles')
			.select('name, email')
			.eq('id', booking.user_id)
			.single()

		// Get bill information
		const { data: bills } = await supabase
			.from('bills')
			.select('amount, currency')
			.eq('booking_id', booking.id)

		// Format the response for display
		const response = {
			bookingId: booking.id,
			clientName: client?.name || 'Cliente',
			practitionerName: practitioner?.name || 'Profesional',
			consultationDate: booking.start_time,
			consultationTime: booking.start_time,
			status: booking.status,
			amount: bills?.[0]?.amount || 0,
			currency: bills?.[0]?.currency || 'EUR'
		}

		return NextResponse.json(response)
	} catch (error) {
		console.error('Error fetching booking details:', error)
		return NextResponse.json(
			{
				error: 'Failed to fetch booking details',
				details:
					error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
