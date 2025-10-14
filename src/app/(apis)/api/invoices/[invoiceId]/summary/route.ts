import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getInvoiceById } from '@/lib/db/invoices'
import { getBookingById } from '@/lib/db/bookings'
import { getProfileById } from '@/lib/db/profiles'

export async function GET(_req: NextRequest, { params }: { params: { invoiceId: string } }) {
	try {
		const supabase = createServiceRoleClient()
		const invoiceId = params.invoiceId
		const invoice = await getInvoiceById(invoiceId, supabase)
		if (!invoice) return NextResponse.json({ error: 'not_found' }, { status: 404 })

		const isMonthly = Boolean(invoice.billing_period_start)

		if (!isMonthly) {
			// Per-booking invoices: try to infer booking from bills linked to this invoice
			const { data: bills } = await supabase
				.from('bills')
				.select('booking_id')
				.eq('invoice_id', invoice.id)
				.limit(1)
			const firstBookingId = (bills || [])[0]?.booking_id as string | undefined
			if (!firstBookingId) return NextResponse.json({ type: 'per_booking' })
			const booking = await getBookingById(firstBookingId, supabase)
			if (!booking) return NextResponse.json({ error: 'booking_not_found' }, { status: 404 })
			const practitioner = await getProfileById(booking.user_id, supabase)
			return NextResponse.json({
				type: 'per_booking',
				practitionerName: practitioner?.name || 'Tu profesional',
				consultationDate: booking.start_time
			})
		}

		// Monthly invoice: provide month label and practitioner name
		const practitioner = await getProfileById(invoice.user_id, supabase)
		const iso = invoice.billing_period_start || invoice.issued_at || new Date().toISOString()
		const monthLabel = new Date(iso).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
		return NextResponse.json({
			type: 'monthly',
			periodStart: invoice.billing_period_start,
			periodEnd: invoice.billing_period_end,
			month: monthLabel,
			practitionerName: practitioner?.name || 'Tu profesional'
		})
	} catch (error) {
		Sentry.captureException(error, { tags: { component: 'api', route: 'invoices/[invoiceId]/summary' } })
		return NextResponse.json({ error: 'server_error' }, { status: 500 })
	}
}
