import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
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
			(searchParams.get('statusFilter') as 'all' | 'pending' | 'scheduled' | 'completed' | 'canceled' | null) ||
			'all'
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

		// Pre-sign invoice PDF URLs for 1 year (31536000 seconds)
		const service = createServiceRoleClient()
		const pdfPaths = rows
			.flatMap((r) => [r.invoice_pdf_path, ...(r.credit_note_pdf_paths || [])])
			.filter((p): p is string => typeof p === 'string' && p.length > 0)
		let signedUrlByPath: Record<string, string> = {}
		if (pdfPaths.length > 0) {
			const keys = pdfPaths.map((p) => p.replace(/^invoices\//, ''))
			const { data: signedList } = await service.storage.from('invoices').createSignedUrls(keys, 31536000)
			if (signedList && signedList.length === keys.length) {
				for (let i = 0; i < keys.length; i++) {
					const origPath = pdfPaths[i]
					const signed = signedList[i]?.signedUrl || ''
					signedUrlByPath[origPath] = signed
				}
			}
		}

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
				const ddmmyyyy = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
				const hhmm = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`

				const creditNumbers = (r.credit_note_numbers || []).join(' | ')
				const creditLinks = (r.credit_note_pdf_paths || [])
					.map((p) => (p ? signedUrlByPath[p] || '' : ''))
					.filter((u) => u)
					.join(' | ')

				const importeNeto = (
					(typeof r.amount === 'number' ? r.amount : 0) - (r.credit_note_total_abs || 0)
				).toFixed(2)

				return {
					id_cita: r.booking_id,
					nombre_del_cliente: r.client_first_name || '',
					apellido_del_cliente: r.client_last_name || '',
					email_del_cliente: r.client_email || '',
					dni_del_cliente: r.client_national_id || '',
					direccion_del_cliente: r.client_address || '',
					fecha_de_la_cita_utc: ddmmyyyy(start),
					hora_de_la_cita_utc: hhmm(start),
					estado: toEsBookingStatus(r.booking_status),
					estado_de_pago: toEsPaymentStatus(r.payment_status),
					importe: (typeof r.amount === 'number' ? r.amount : 0).toFixed(2),
					importe_neto: importeNeto,
					moneda: r.currency,
					pagado_el_utc: paidAt ? `${ddmmyyyy(paidAt)} ${hhmm(paidAt)}` : '',
					importe_reembolso: (r.refund_amount || 0).toFixed(2),
					servicio: r.service_name,
					zona_horaria: r.timezone,
					numero_de_factura:
						r.invoice_series && typeof r.invoice_number === 'number'
							? `${r.invoice_series}-${r.invoice_number}`
							: '',
					url_factura_pdf: r.invoice_pdf_path ? signedUrlByPath[r.invoice_pdf_path] || '' : '',
					numeros_de_rectificativas: creditNumbers,
					urls_rectificativas_pdf: creditLinks,
					total_rectificado_abs: (r.credit_note_total_abs || 0).toFixed(2)
				}
			})

			const headers = [
				'id_cita',
				'nombre_del_cliente',
				'apellido_del_cliente',
				'email_del_cliente',
				'dni_del_cliente',
				'direccion_del_cliente',
				'fecha_de_la_cita_utc',
				'hora_de_la_cita_utc',
				'estado',
				'estado_de_pago',
				'importe',
				'importe_neto',
				'moneda',
				'pagado_el_utc',
				'importe_reembolso',
				'servicio',
				'zona_horaria',
				'numero_de_factura',
				'url_factura_pdf',
				'numeros_de_rectificativas',
				'urls_rectificativas_pdf',
				'total_rectificado_abs'
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
