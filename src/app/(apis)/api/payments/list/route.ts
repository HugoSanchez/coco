import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { getStripeAccountForPayments } from '@/lib/db/stripe-accounts'

// Force dynamic because we hit external APIs and read auth cookies
export const dynamic = 'force-dynamic'

type PaymentRow = {
	paymentIntentId: string
	created: number
	amount: number
	currency: string
	paymentStatus: Stripe.PaymentIntent.Status
	bookingId?: string
	chargeId?: string
	net?: number
	fee?: number
	availableOn?: number
}

export async function GET(request: NextRequest) {
	try {
		// 1) Authenticated user
		const supabase = createClient()
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()

		if (authError || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// 2) Get user's Stripe connected account id
		const stripeAccount = await getStripeAccountForPayments(
			user.id,
			supabase
		)
		if (!stripeAccount?.stripe_account_id) {
			return NextResponse.json({ rows: [] })
		}

		const url = new URL(request.url)
		const sinceParam = url.searchParams.get('since') // epoch seconds
		const limitParam = url.searchParams.get('limit')
		const pageParam = url.searchParams.get('page') // Stripe search page token
		const since = sinceParam ? Number(sinceParam) : undefined
		const limit = limitParam ? Math.min(Number(limitParam), 100) : 50

		const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

		// 3) Search PaymentIntents on the PLATFORM account filtered by on_behalf_of
		// Our Checkout sets payment_intent_data.on_behalf_of and transfer_data.destination
		// PaymentIntents live on the platform; use on_behalf_of for filtering (supported)
		const queryParts: string[] = [
			`on_behalf_of:'${stripeAccount.stripe_account_id}'`
		]
		if (!Number.isNaN(since!) && since) {
			queryParts.push(`created>:${since}`)
		}
		const query = queryParts.join(' AND ')

		const paymentIntents = await stripe.paymentIntents.search({
			query,
			limit,
			page: pageParam || undefined,
			expand: ['data.latest_charge.balance_transaction']
		})

		const rows: PaymentRow[] = paymentIntents.data.map((pi) => {
			const charge =
				pi.latest_charge && typeof pi.latest_charge !== 'string'
					? (pi.latest_charge as Stripe.Charge)
					: undefined
			const bt =
				(charge?.balance_transaction as Stripe.BalanceTransaction | null) ||
				null
			const availableOn = bt?.available_on || undefined

			return {
				paymentIntentId: pi.id,
				created: pi.created,
				amount: pi.amount,
				currency: (pi.currency || 'eur').toUpperCase(),
				paymentStatus: pi.status,
				bookingId: (pi.metadata?.booking_id as string) || undefined,
				chargeId: charge?.id,
				net: bt?.net ?? undefined,
				fee: bt?.fee ?? undefined,
				availableOn
			}
		})

		return NextResponse.json({
			rows,
			nextPage: (paymentIntents as any).next_page || null,
			hasMore: (paymentIntents as any).has_more ?? false
		})
	} catch (error) {
		console.error('Error fetching payments:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		)
	}
}
