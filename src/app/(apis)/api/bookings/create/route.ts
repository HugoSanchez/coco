import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
	createBookingSimple,
	CreateBookingRequest
} from '@/lib/bookings/booking-orchestration-service'

// Force dynamic rendering since this route uses cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * POST /api/bookings/create
 *
 * Creates a booking with complete business logic on the server-side.
 * Handles payment links and email sending with proper environment variables.
 */
export async function POST(request: NextRequest) {
	try {
		const supabase = createClient()

		// Step 1: Authenticate the user
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()

		if (authError || !user) {
			return NextResponse.json(
				{ error: 'Authentication required' },
				{ status: 401 }
			)
		}

		// Step 2: Parse and validate request body
		const { clientId, startTime, endTime, notes, status } =
			await request.json()

		if (!clientId || !startTime || !endTime) {
			return NextResponse.json(
				{
					error: 'Missing required fields: clientId, startTime, endTime'
				},
				{ status: 400 }
			)
		}

		// Step 3: Create booking request
		const bookingRequest: CreateBookingRequest = {
			userId: user.id,
			clientId,
			startTime,
			endTime,
			notes,
			status
		}

		// Step 4: Create booking using orchestration service
		const result = await createBookingSimple(bookingRequest, supabase)

		// Step 5: Return success response
		return NextResponse.json({
			success: true,
			booking: result.booking,
			bill: result.bill,
			requiresPayment: result.requiresPayment,
			paymentUrl: result.paymentUrl
		})
	} catch (error) {
		console.error('Error creating booking (API):', error)
		const message =
			error instanceof Error ? error.message : 'Unknown server error'
		return NextResponse.json(
			{
				error: 'Failed to create booking',
				details: message
			},
			{ status: 500 }
		)
	}
}
