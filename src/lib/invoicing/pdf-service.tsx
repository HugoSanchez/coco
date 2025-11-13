import React from 'react'
import { renderToStream } from '@react-pdf/renderer'
import crypto, { type BinaryLike } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getInvoiceById, setInvoicePdfInfo } from '@/lib/db/invoices'
import InvoicePdfDocument from '@/lib/invoicing/invoice-pdf'
import { getBillsForInvoice } from '@/lib/db/bills'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { getProfileById } from '@/lib/db/profiles'
import { getClientById } from '@/lib/db/clients'

/**
 * Generates an invoice PDF and stores it in Supabase Storage.
 * - Bucket: invoices (private)
 * - Path: invoices/{userId}/{YYYY}/{MM}/{invoiceId}.pdf
 * - Saves pdf_url (storage path) and pdf_sha256 on invoices
 */
export async function generateAndStoreInvoicePdf(invoiceId: string): Promise<{ storagePath: string }> {
	const supabase = createServiceRoleClient()

	// Fetch header
	const invoice = await getInvoiceById(invoiceId, supabase)
	if (!invoice) throw new Error('Invoice not found')
	const practitionerProfile = await getProfileById(invoice.user_id, supabase)
	const practitionerName = (practitionerProfile as any)?.full_name || practitionerProfile?.name || ''

	// Skip PDF generation if issuer fiscal data is missing (proxy for invoicing setup)
	const missingFiscal =
		!practitionerProfile?.tax_id ||
		!practitionerProfile?.fiscal_address_line1 ||
		!practitionerProfile?.fiscal_city ||
		!practitionerProfile?.fiscal_province ||
		!practitionerProfile?.fiscal_postal_code
	if (missingFiscal) {
		// No-op: do not generate PDF, but return a placeholder path info
		return { storagePath: '' }
	}

	// Resolve client info (prefer fresh client row over snapshots)
	let clientName = invoice.client_name_snapshot
	let clientNationalId = invoice.client_national_id_snapshot
	let clientAddress = invoice.client_address_snapshot
	if (invoice.client_id) {
		try {
			const fresh = await getClientById(invoice.client_id, supabase)
			if (fresh) {
				clientName =
					[fresh.name || '', (fresh as any).last_name || ''].filter(Boolean).join(' ').trim() || clientName
				// Use fresh data if available, otherwise fall back to snapshot
				clientNationalId = (fresh as any).national_id || clientNationalId
				clientAddress = (fresh as any).address || clientAddress
			}
		} catch (_) {}
	}

	// Prepare React-PDF document props
	const rectifies = invoice.rectifies_invoice_id ? await getInvoiceById(invoice.rectifies_invoice_id, supabase) : null
	const rectifiesDisplay =
		rectifies?.series && rectifies?.number != null
			? `${rectifies.series}-${rectifies.number}`
			: rectifies?.id?.slice(0, 8) || null

	// Build items from linked bills for display
	let items: Array<{
		description: string
		qty?: number | null
		unit_price?: number | null
		amount?: number | null
		tax_rate_percent?: number | null
		tax_amount?: number | null
	}> = []
	let allItemsHaveZeroVat = true
	try {
		const bills = await getBillsForInvoice(invoice.id, supabase)
		items = bills.map((b: any) => {
			const iso = Array.isArray(b?.booking) ? b.booking[0]?.start_time : b?.booking?.start_time
			const when = iso ? new Date(iso) : null
			const display = when
				? `Consulta – ${formatInTimeZone(when, 'Europe/Madrid', 'dd/MM/yyyy', { locale: es })}`
				: 'Consulta'
			const taxRate = Number(b.tax_rate_percent || 0)
			const taxAmount = Number(b.tax_amount || 0)
			const totalAmount = Number(b.amount || 0)

			// Track if any item has VAT > 0
			if (taxRate > 0) {
				allItemsHaveZeroVat = false
			}

			// When VAT is applied, the "Importe" (base amount) should be amount - vat_amount
			// The booking amount is the total including VAT
			const baseAmount = taxAmount > 0 ? totalAmount - taxAmount : totalAmount

			return {
				description: display,
				qty: 1,
				unit_price: baseAmount,
				amount: baseAmount,
				tax_rate_percent: taxRate,
				tax_amount: taxAmount
			}
		})
	} catch (_) {
		// Fallback: use invoice totals (shouldn't happen in normal flow)
		items = [
			{
				description: 'Consulta',
				qty: 1,
				unit_price: invoice.subtotal,
				amount: invoice.subtotal,
				tax_rate_percent: invoice.tax_total > 0 ? null : 0, // Unknown rate if tax exists
				tax_amount: invoice.tax_total
			}
		]
		allItemsHaveZeroVat = invoice.tax_total === 0
	}

	const pdfElement = (
		<InvoicePdfDocument
			practitionerName={practitionerName}
			practitionerEmail={null}
			practitionerTaxId={practitionerProfile?.tax_id || null}
			practitionerAddress={{
				line1: practitionerProfile?.fiscal_address_line1 || null,
				line2: practitionerProfile?.fiscal_address_line2 || null,
				postalCode: practitionerProfile?.fiscal_postal_code || null,
				city: practitionerProfile?.fiscal_city || null,
				province: practitionerProfile?.fiscal_province || null
			}}
			clientName={clientName}
			clientNationalId={clientNationalId}
			clientAddress={clientAddress}
			invoiceId={invoice.id}
			series={invoice.series}
			number={invoice.number}
			issuedAt={invoice.issued_at}
			currency={invoice.currency}
			subtotal={invoice.subtotal}
			taxTotal={invoice.tax_total}
			total={invoice.total}
			kind={(invoice as any).document_kind}
			rectifiesDisplay={rectifiesDisplay}
			items={items}
			showVatExemptNote={allItemsHaveZeroVat}
		/>
	)

	// Render to Buffer
	const stream = await renderToStream(pdfElement)
	const chunks: Uint8Array[] = []
	await new Promise<void>((resolve, reject) => {
		stream.on('data', (chunk: Uint8Array) => chunks.push(chunk))
		stream.on('end', () => resolve())
		stream.on('error', reject)
	})
	const buffer = Buffer.concat(chunks)

	// Hash
	const sha256 = crypto
		.createHash('sha256')
		.update(buffer as unknown as BinaryLike)
		.digest('hex')

	// Build storage path
	const issued = invoice.issued_at ? new Date(invoice.issued_at) : new Date()
	const year = issued.getUTCFullYear()
	const month = String(issued.getUTCMonth() + 1).padStart(2, '0')
	const storagePath = `invoices/${invoice.user_id}/${year}/${month}/${invoice.id}.pdf`

	// Upload (path relative to bucket)
	const key = storagePath.replace(/^invoices\//, '')
	// Delete any existing file to avoid stale PDFs due to upsert caching
	try {
		await supabase.storage.from('invoices').remove([key])
	} catch (_) {}
	const { error: uploadErr } = await supabase.storage.from('invoices').upload(key, buffer, {
		contentType: 'application/pdf',
		upsert: true
	})
	if (uploadErr) throw uploadErr

	// Persist path/hash
	await setInvoicePdfInfo(invoiceId, storagePath, sha256, supabase)

	return { storagePath }
}
