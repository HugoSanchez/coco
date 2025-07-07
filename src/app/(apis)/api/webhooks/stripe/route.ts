import { NextRequest, NextResponse } from 'next/server'
import { markPaymentSessionCompleted } from '@/lib/db/payment-sessions'
import { updateBookingStatus } from '@/lib/db/bookings'
import { getBillForBookingAndMarkAsPaid } from '@/lib/db/bills'
import { createCalendarEvent } from '@/lib/db/calendar-events'
import { createCalendarEventWithInvite } from '@/lib/calendar/calendar'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

/**
 * Stripe webhook handler
 *
 * This function is used to handle Stripe webhooks.
 * It is used to update the payment session status, booking status, and bill status.
 *
 * @param request - The request object
 * @returns The response object
 */

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
	try {
		///////////////////////////////////////////////////////////
		///// 1. Create service role client for bypassing RLS
		///////////////////////////////////////////////////////////
		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.SUPABASE_SERVICE_ROLE_KEY!
		)

		///////////////////////////////////////////////////////////
		///// 2. Verify webhook signature
		///////////////////////////////////////////////////////////
		const body = await request.text()
		const sig = request.headers.get('stripe-signature')!
		const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
		// Verify webhook signature logic
		let event: Stripe.Event
		event = stripe.webhooks.constructEvent(body, sig, webhookSecret)

		///////////////////////////////////////////////////////////
		///// 3. Handle checkout session completed
		///////////////////////////////////////////////////////////
		if (event.type === 'checkout.session.completed') {
			// 1. Get session object to get metadata
			const session = event.data.object as Stripe.Checkout.Session
			// 2. Get booking ID from metadata
			const bookingId = session.metadata?.booking_id
			if (!bookingId) return NextResponse.json({ received: true })
			// 3. Update payment session status
			await markPaymentSessionCompleted(
				session.id,
				session.payment_intent as string
			)
			// 4. Update booking status to 'scheduled' (payment received) - using service role client
			await updateBookingStatus(bookingId, 'scheduled', supabase)
			// 5. Update bill status to 'paid' - using service role client
			await getBillForBookingAndMarkAsPaid(bookingId, supabase)

			///////////////////////////////////////////////////////////
			///// 4. Create Google Calendar event
			///////////////////////////////////////////////////////////
			try {
				// Extract all needed data from session metadata (no database calls needed!)
				const clientName = session.metadata?.client_name
				const clientEmail = session.customer_email
				const practitionerName = session.metadata?.practitioner_name
				const practitionerEmail = session.metadata?.practitioner_email
				const practitionerUserId =
					session.metadata?.practitioner_user_id
				const startTime = session.metadata?.start_time
				const endTime = session.metadata?.end_time

				// Validate we have all required data
				if (
					!clientName ||
					!clientEmail ||
					!practitionerName ||
					!practitionerEmail ||
					!practitionerUserId ||
					!startTime ||
					!endTime
				) {
					console.error(
						`Missing metadata in session for booking ${bookingId}:`,
						{
							clientName: !!clientName,
							clientEmail: !!clientEmail,
							practitionerName: !!practitionerName,
							practitionerEmail: !!practitionerEmail,
							practitionerUserId: !!practitionerUserId,
							startTime: !!startTime,
							endTime: !!endTime
						}
					)
					return NextResponse.json({ received: true })
				}

				// Create calendar event with invite
				const calendarResult = await createCalendarEventWithInvite(
					{
						userId: practitionerUserId,
						clientName,
						clientEmail,
						practitionerName,
						practitionerEmail,
						startTime,
						endTime
					},
					supabase
				)

				if (calendarResult.success && calendarResult.googleEventId) {
					// Store calendar event in database
					await createCalendarEvent(
						{
							booking_id: bookingId,
							user_id: practitionerUserId,
							google_event_id: calendarResult.googleEventId,
							google_meet_link: calendarResult.googleMeetLink
						},
						supabase
					)

					console.log(
						`Calendar event created for booking ${bookingId}: ${calendarResult.googleEventId}`
					)
				} else {
					console.error(
						`Failed to create calendar event for booking ${bookingId}:`,
						calendarResult.error
					)
				}
			} catch (calendarError) {
				// Don't fail the webhook if calendar creation fails
				console.error(
					`Calendar creation error for booking ${bookingId}:`,
					calendarError
				)
			}
		}
		// 7. Return success response
		return NextResponse.json({ received: true })
	} catch (error) {
		console.error('Webhook error:', error)
		return NextResponse.json(
			{ error: 'Webhook handler failed' },
			{ status: 500 }
		)
	}
}
