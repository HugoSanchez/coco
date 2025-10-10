import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/db/bookings'
import { getClientById } from '@/lib/db/clients'
import { getProfileById } from '@/lib/db/profiles'
import { getBillsForBooking } from '@/lib/db/bills'
import { findInvoiceByLegacyBillId, listInvoiceItems, getInvoiceById } from '@/lib/db/invoices'

/**
 * GET /api/bookings/[id]
 *
 * Retrieves booking details by ID for display on the payment success page.
 * This endpoint is used by clients (not authenticated users) to display
 * confirmation information after successful payment.
 *
 * Returns:
 * - Client name and consultation date
 * - Practitioner name for confirmation
 * - Basic booking information for display
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
	try {
		const bookingId = params.id

		if (!bookingId) {
			return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 })
		}

		const supabase = createClient()
		const service = createServiceRoleClient()
		const booking = await getBookingById(bookingId, supabase)
		if (!booking) {
			return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
		}
		const client = booking.client_id ? await getClientById(booking.client_id, supabase) : null
		const practitioner = await getProfileById(booking.user_id, supabase)
		const bills = await getBillsForBooking(booking.id, supabase)

		// Build invoice links (PDFs) if dual-write is enabled and an invoice exists
		let invoiceLinks: Array<{
			kind: 'invoice' | 'credit_note'
			display: string
			url: string | null
		}> = []
		// Also include invoice header + items if resolvable from the legacy bill id
		let invoice: any = null
		let invoiceItems: any[] = []
		try {
			if (process.env.ENABLE_INVOICES_DUAL_WRITE === 'true' && bills?.[0]?.id) {
				const inv = await findInvoiceByLegacyBillId(bills[0].id, service as any)
				if (inv) {
					invoice = inv
					try {
						invoiceItems = await listInvoiceItems(inv.id, service as any)
					} catch (_) {}
					const display =
						inv.series && inv.number != null ? `${inv.series}-${inv.number}` : inv.id.slice(0, 8)
					let url: string | null = null
					if (inv.pdf_url) {
						const key = inv.pdf_url.replace(/^invoices\//, '')
						const { data: signed } = await service.storage.from('invoices').createSignedUrl(key, 2592000)
						url = signed?.signedUrl || null
					}
					invoiceLinks.push({ kind: 'invoice', display, url })

					// Credit notes
					const { data: creditNotes } = await service
						.from('invoices')
						.select('*')
						.eq('rectifies_invoice_id', inv.id)
						.order('issued_at', { ascending: true })
					if (creditNotes && creditNotes.length > 0) {
						for (const cn of creditNotes as any[]) {
							const displayCN =
								cn.series && cn.number != null
									? `${cn.series}-${cn.number}`
									: (cn.id as string).slice(0, 8)
							let urlCN: string | null = null
							if (cn.pdf_url) {
								const keyCN = (cn.pdf_url as string).replace(/^invoices\//, '')
								const { data: signedCN } = await service.storage
									.from('invoices')
									.createSignedUrl(keyCN, 2592000)
								urlCN = signedCN?.signedUrl || null
							}
							invoiceLinks.push({
								kind: 'credit_note',
								display: displayCN,
								url: urlCN
							})
						}
					}
				}
			}
		} catch (e) {
			// Non-fatal; continue without invoice links
		}

		// Format the response for display
		const receiptFromInvoice = (invoice as any)?.stripe_receipt_url || null
		const receiptFromBill = (bills?.[0] as any)?.stripe_receipt_url || null
		const documents = {
			receiptUrl: receiptFromInvoice || receiptFromBill || null,
			invoiceLinks,
			hasInvoice: Array.isArray(invoiceLinks) && invoiceLinks.length > 0
		}

		const response = {
			bookingId: booking.id,
			clientName: client?.name || 'Cliente',
			clientLastName: client?.last_name || null,
			clientEmail: client?.email || null,
			practitionerName: practitioner?.name || 'Profesional',
			consultationDate: booking.start_time,
			consultationTime: booking.start_time,
			status: booking.status,
			amount: bills?.[0]?.amount || 0,
			currency: bills?.[0]?.currency || 'EUR',
			bill: bills && bills.length > 0 ? bills[0] : null,
			invoices: invoiceLinks,
			invoice,
			invoice_items: invoiceItems,
			documents
		}

		return NextResponse.json(response)
	} catch (error) {
		console.error('Error fetching booking details:', error)
		return NextResponse.json(
			{
				error: 'Failed to fetch booking details',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
