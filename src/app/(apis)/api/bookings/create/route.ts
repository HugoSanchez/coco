import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
	orchestrateBookingCreation,
	CreateBookingRequestWithBilling,
	validateBillingInput,
	validateBookingTimes
} from '@/lib/bookings/booking-orchestration-service'
import * as Sentry from '@sentry/nextjs'
import { captureEvent } from '@/lib/posthog/server'

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
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		////// Step 0: Initialize server client (auth + DB)
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		const supabase = createClient()

		////////////////////////////////////////////////////////////////////////////////////////////////////////
		////// Step 1: Authenticate the user
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()

		if (authError || !user) {
			Sentry.captureMessage('bookings:create unauthorized', {
				level: 'warning',
				tags: { component: 'api:bookings' }
			})
			return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
		}

		////////////////////////////////////////////////////////////////////////////////////////////////////////
		////// Step 2: Parse and validate request body (booking + billing contract)
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		const { booking, billing } = await request.json()

		if (!booking || !billing) {
			Sentry.captureMessage('bookings:create missing_fields', {
				level: 'warning',
				tags: { component: 'api:bookings' }
			})
			return NextResponse.json(
				{
					error: 'Missing required payload: booking and billing'
				},
				{ status: 400 }
			)
		}

		if (!booking.clientId || !booking.startTime || !booking.endTime) {
			return NextResponse.json({ error: 'Missing required booking fields' }, { status: 400 })
		}

		try {
			validateBookingTimes(booking.startTime, booking.endTime)
			validateBillingInput(billing)
		} catch (e) {
			return NextResponse.json({ error: (e as Error).message }, { status: 400 })
		}

		////////////////////////////////////////////////////////////////////////////////////////////////////////
		////// Step 3: Build orchestrator request (unified contract)
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		const bookingRequest: CreateBookingRequestWithBilling = {
			userId: user.id,
			clientId: booking.clientId,
			startTime: booking.startTime,
			endTime: booking.endTime,
			notes: booking.notes,
			status: booking.status,
			consultationType: booking.consultationType,
			mode: booking.mode === 'in_person' ? 'in_person' : 'online',
			locationText:
				booking.mode === 'in_person' && typeof booking.locationText === 'string' ? booking.locationText : null,
			billing
		}

		////////////////////////////////////////////////////////////////////////////////////////////////////////
		////// Step 4: Create booking via orchestrator
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		const suppressEmail = billing?.suppressEmail === true
		const result = await orchestrateBookingCreation(
			bookingRequest,
			billing,
			supabase,
			suppressEmail ? { suppressEmail: true } : undefined
		)

		////////////////////////////////////////////////////////////////////////////////////////////////////////
		////// Step 5: Capture analytics event (best-effort)
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		await captureEvent({
			userId: user.id,
			event: 'booking_created',
			userEmail: user.email,
			properties: {
				booking_id: result.booking.id,
				client_id: result.booking.client_id,
				user_id: result.booking.user_id,
				requires_payment: result.requiresPayment,
				amount: result.bill?.amount,
				currency: result.bill?.currency,
				patient_created: false
			}
		})

		////////////////////////////////////////////////////////////////////////////////////////////////////////
		////// Step 6: Return success response
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		return NextResponse.json({
			success: true,
			booking: result.booking,
			bill: result.bill,
			requiresPayment: result.requiresPayment,
			paymentUrl: result.paymentUrl
		})
	} catch (error) {
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		////// Step E: Error handling and response
		////////////////////////////////////////////////////////////////////////////////////////////////////////
		console.error('Error creating booking (API):', error)
		Sentry.captureException(error, {
			tags: { component: 'api:bookings', method: 'create' },
			extra: {
				request: request.body
			}
		})
		const message = error instanceof Error ? error.message : 'Unknown server error'
		return NextResponse.json(
			{
				error: 'Failed to create booking',
				details: message
			},
			{ status: 500 }
		)
	}
}
