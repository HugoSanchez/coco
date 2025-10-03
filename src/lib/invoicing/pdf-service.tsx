import React from 'react'
import { renderToStream } from '@react-pdf/renderer'
import crypto, { type BinaryLike } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getInvoiceById, setInvoicePdfInfo } from '@/lib/db/invoices'
import { listInvoiceItems } from '@/lib/db/invoice-items'
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

	// Fetch header and lines
	const invoice = await getInvoiceById(invoiceId, supabase)
	if (!invoice) throw new Error('Invoice not found')
	const items = await listInvoiceItems(invoiceId, supabase)
	const practitionerProfile = await getProfileById(invoice.user_id, supabase)
	const practitionerName = practitionerProfile?.name || ''

	// Prepare React-PDF document props
	const pdfElement = (
		<InvoicePdfDocument
			practitionerName={practitionerName}
			practitionerEmail={null}
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
			items={items}
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
