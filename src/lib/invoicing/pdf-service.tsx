import React from 'react'
import { renderToStream } from '@react-pdf/renderer'
import crypto, { type BinaryLike } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getInvoiceById, setInvoicePdfInfo } from '@/lib/db/invoices'
import InvoicePdfDocument from '@/lib/invoicing/invoice-pdf'
import { getProfileById } from '@/lib/db/profiles'

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
	const practitionerName = practitionerProfile?.name || ''

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

	// Prepare React-PDF document props
	const rectifies = invoice.rectifies_invoice_id ? await getInvoiceById(invoice.rectifies_invoice_id, supabase) : null
	const rectifiesDisplay =
		rectifies?.series && rectifies?.number != null
			? `${rectifies.series}-${rectifies.number}`
			: rectifies?.id?.slice(0, 8) || null

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
			clientName={invoice.client_name_snapshot}
			clientEmail={invoice.client_email_snapshot}
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
			items={[
				{
					description: 'Consulta',
					qty: 1,
					unit_price: invoice.subtotal,
					amount: invoice.subtotal,
					tax_rate_percent: 0,
					tax_amount: invoice.tax_total
				}
			]}
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
	const { error: uploadErr } = await supabase.storage.from('invoices').upload(key, buffer, {
		contentType: 'application/pdf',
		upsert: true
	})
	if (uploadErr) throw uploadErr

	// Persist path/hash
	await setInvoicePdfInfo(invoiceId, storagePath, sha256, supabase)

	return { storagePath }
}
