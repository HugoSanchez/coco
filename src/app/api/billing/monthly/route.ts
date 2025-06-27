import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
//  GET /api/billing/monthly
// ---------------------------------------------------------------------------
// Returns a list of "invoice candidates" for recurring-monthly billing.
//
//  • Only picks schedule rows that are:
//      – status = 'pending'
//      – scheduled_date <= today
//      – booking.billing_settings.billing_type      = 'recurring'
//      – booking.billing_settings.billing_frequency = 'monthly'
//
//  • Groups the results by (client_id, YYYY-MM).
//    Each group represents the bill we'll email to that client for that month.
//
//  • Response shape:
//    [
//      {
//        client_id: string,
//        period:    'YYYY-MM',    // billing month
//        total_amount: number,    // sum of billing_amount for the period
//        bookings:   [            // the individual bookings that make up the bill
//          {
//            booking_id: string,
//            scheduled_date: string,
//            client: {...},      // full clients row
//            billing_settings: {...} // full billing_settings row
//          }
//        ]
//      }
//    ]
//
//  The caller (cron job / UI) can iterate over each object to generate and send
//  an invoice, then mark the corresponding billing_schedule rows as processed.
// ---------------------------------------------------------------------------

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
	// -------- Fetch raw rows --------------------------------------------------
	const todayStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

	const { data, error } = await supabase
		.from('billing_schedule')
		.select(
			`
      booking_id,
      scheduled_date,
      bookings(
        user_id,
        billing_settings:billing_settings!bookings_billing_settings_id_fkey(*),
        client:clients(*)
      )
    `
		)
		.lte('scheduled_date', todayStr)
		.eq('status', 'pending')
		// 🔎 Only recurring-monthly billing
		.eq('bookings.billing_settings.billing_type', 'recurring')
		.eq('bookings.billing_settings.billing_frequency', 'monthly')

	if (error) {
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		)
	}

	// -------- Group rows by (client_id, YYYY-MM) -----------------------------
	interface BookingInfo {
		booking_id: string
		scheduled_date: string
		client: any
		billing_settings: any
	}
	const groups: Record<
		string,
		{
			client_id: string
			period: string
			total_amount: number
			bookings: BookingInfo[]
		}
	> = {}

	;(data ?? []).forEach((row: any) => {
		const booking = row.bookings
		if (!booking) return // safety

		const client = booking.client
		if (!client) return // should never happen if FK is intact

		const clientId = client.id
		const period = row.scheduled_date.slice(0, 7) // YYYY-MM
		const key = `${clientId}-${period}`

		const amount = Number(booking.billing_settings?.billing_amount ?? 0)

		if (!groups[key]) {
			groups[key] = {
				client_id: clientId,
				period,
				total_amount: 0,
				bookings: []
			}
		}

		groups[key].total_amount += amount
		groups[key].bookings.push({
			booking_id: row.booking_id,
			scheduled_date: row.scheduled_date,
			client,
			billing_settings: booking.billing_settings
		})
	})

	// -------- Return ----------------------------------------------------------
	return NextResponse.json(Object.values(groups))
}
