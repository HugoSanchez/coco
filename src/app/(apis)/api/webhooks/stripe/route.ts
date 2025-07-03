import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { markPaymentSessionCompleted } from '@/lib/db/payment-sessions'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
	try {
		const body = await request.text()
		const sig = request.headers.get('stripe-signature')!
		const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

		// Verify webhook signature
		let event: Stripe.Event
		try {
			event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
		} catch (err) {
			console.error('Webhook signature verification failed:', err)
			return NextResponse.json(
				{ error: 'Invalid signature' },
				{ status: 400 }
			)
		}

		// Handle checkout session completed
		if (event.type === 'checkout.session.completed') {
			const session = event.data.object as Stripe.Checkout.Session

			console.log('💰 Payment completed for session:', session.id)

			// Get booking ID from metadata
			const bookingId = session.metadata?.booking_id
			if (!bookingId) {
				console.warn('No booking_id in session metadata')
				return NextResponse.json({ received: true })
			}

			// Update payment session status
			try {
				await markPaymentSessionCompleted(
					session.id,
					session.payment_intent as string
				)
				console.log('✅ Updated payment session:', session.id)
			} catch (sessionError) {
				console.error('Failed to update payment session:', sessionError)
			}

			// Update booking payment status
			const { error: bookingError } = await supabase
				.from('bookings')
				.update({
					payment_status: 'paid',
					paid_at: new Date().toISOString()
				})
				.eq('id', bookingId)

			if (bookingError) {
				console.error('Failed to update booking status:', bookingError)
			} else {
				console.log('✅ Updated booking payment status:', bookingId)
			}
		}

		return NextResponse.json({ received: true })
	} catch (error) {
		console.error('Webhook error:', error)
		return NextResponse.json(
			{ error: 'Webhook handler failed' },
			{ status: 500 }
		)
	}
}
