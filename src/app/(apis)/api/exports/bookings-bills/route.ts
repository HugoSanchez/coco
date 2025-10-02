import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBookingsForExport } from '@/lib/db/bookings'
import { toCsv } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * GET /api/exports/bookings-bills
 * Returns JSON rows for bookings + billing fields based on current filters.
 * Step 1 of export feature: validate data shape from UI before CSV streaming.
 *
 * Query params (same semantics as dashboard filters):
 * - customerSearch (string)
 * - statusFilter ('all' | 'pending' | 'scheduled' | 'completed' | 'canceled')
 * - startDate (YYYY-MM-DD or ISO)
 * - endDate (YYYY-MM-DD or ISO)
 */
export async function GET(request: NextRequest) {
	try {
		const supabase = createClient()

		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()
		if (authError || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const customerSearch = searchParams.get('customerSearch') || undefined
		const statusFilter =
			(searchParams.get('statusFilter') as
				| 'all'
				| 'pending'
				| 'scheduled'
				| 'completed'
				| 'canceled'
				| null) || 'all'
		const startDate = searchParams.get('startDate') || undefined
		const endDate = searchParams.get('endDate') || undefined

		const rows = await getBookingsForExport(
			user.id,
			{
				customerSearch,
				statusFilter: statusFilter || 'all',
				startDate,
				endDate
			},
			supabase
		)

		const formatParam = (searchParams.get('format') || 'json').toLowerCase()

		if (formatParam === 'csv') {
			// Prepare formatted rows for CSV (Spanish headers and values)
			const toEsBookingStatus = (s: string): string => {
				switch (s) {
					case 'pending':
						return 'Por confirmar'
					case 'scheduled':
						return 'Confirmada'
					case 'completed':
						return 'Completada'
					case 'canceled':
						return 'Cancelada'
					default:
						return s
				}
			}

			const toEsPaymentStatus = (s: string): string => {
				switch (s) {
					case 'not_applicable':
						return 'N/A'
					case 'pending':
						return 'Pendiente'
					case 'paid':
						return 'Pagada'
					case 'disputed':
						return 'Disputado'
					case 'canceled':
						return 'Cancelado'
					case 'refunded':
						return 'Reembolsado'
					default:
						return s
				}
			}

			const formatted = rows.map((r) => {
				const start = new Date(r.booking_start_time_iso)
				const end = new Date(r.booking_end_time_iso)
				const paidAt = r.paid_at_iso ? new Date(r.paid_at_iso) : null
				const pad = (n: number) => String(n).padStart(2, '0')
				const ddmmyyyy = (d: Date) =>
					`${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
				const hhmm = (d: Date) =>
					`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`

				return {
					id_cita: r.booking_id,
					nombre_del_cliente: r.client_first_name || '',
					apellido_del_cliente: r.client_last_name || '',
					email_del_cliente: r.client_email || '',
					fecha_de_la_cita_utc: ddmmyyyy(start),
					hora_de_la_cita_utc: hhmm(start),
					estado: toEsBookingStatus(r.booking_status),
					estado_de_pago: toEsPaymentStatus(r.payment_status),
					importe: (typeof r.amount === 'number'
						? r.amount
						: 0
					).toFixed(2),
					moneda: r.currency,
					pagado_el_utc: paidAt
						? `${ddmmyyyy(paidAt)} ${hhmm(paidAt)}`
						: '',
					importe_reembolso: (r.refund_amount || 0).toFixed(2),
					url_recibo: r.receipt_url || '',
					servicio: r.service_name,
					zona_horaria: r.timezone
				}
			})

			const headers = [
				'id_cita',
				'nombre_del_cliente',
				'apellido_del_cliente',
				'email_del_cliente',
				'fecha_de_la_cita_utc',
				'hora_de_la_cita_utc',
				'estado',
				'estado_de_pago',
				'importe',
				'moneda',
				'pagado_el_utc',
				'importe_reembolso',
				'url_recibo',
				'servicio',
				'zona_horaria'
			]

			const csv = toCsv(headers, formatted)
			const filename = 'citas-y-facturas.csv'
			return new NextResponse(csv, {
				status: 200,
				headers: {
					'Content-Type': 'text/csv; charset=utf-8',
					'Content-Disposition': `attachment; filename=${filename}`
				}
			})
		}

		return NextResponse.json({ success: true, rows })
	} catch (error) {
		console.error('export:bookings-bills error', error)
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
