import { NextRequest, NextResponse } from 'next/server'
import { markPaymentSessionCompleted } from '@/lib/db/payment-sessions'
import { updateBookingStatus } from '@/lib/db/bookings'
import { getBillForBookingAndMarkAsPaid } from '@/lib/db/bills'
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
		}
		// 6. Return success response
		return NextResponse.json({ received: true })
	} catch (error) {
		console.error('Webhook error:', error)
		return NextResponse.json(
			{ error: 'Webhook handler failed' },
			{ status: 500 }
		)
	}
}
