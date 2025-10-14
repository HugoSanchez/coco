import React from 'react'
import { format } from 'date-fns'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface InvoicePdfProps {
	practitionerName: string
	practitionerEmail?: string | null
	practitionerTaxId?: string | null
	practitionerAddress?: {
		line1?: string | null
		line2?: string | null
		postalCode?: string | null
		city?: string | null
		province?: string | null
	} | null
	clientName: string
	clientEmail?: string | null
	invoiceId: string
	series?: string | null
	number?: number | null
	issuedAt?: string | null
	currency: string
	subtotal: number
	taxTotal: number
	total: number
	kind?: 'invoice' | 'credit_note'
	rectifiesDisplay?: string | null
	items: Array<{
		description: string
		qty?: number | null
		unit_price?: number | null
		amount?: number | null
		tax_rate_percent?: number | null
		tax_amount?: number | null
	}>
}

const styles = StyleSheet.create({
	page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica' },
	header: { marginBottom: 16 },
	headerTitle: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
	headerLine: { marginBottom: 3 },
	row: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between' },
	section: { marginBottom: 12 },
	label: { fontWeight: 700, marginBottom: 4 },
	infoLine: { marginBottom: 3 },
	tableHeader: { flexDirection: 'row', borderBottom: '1 solid #000', paddingBottom: 6, marginTop: 8 },
	th: { flex: 1, fontWeight: 700 },
	tr: { flexDirection: 'row', borderBottom: '0.5 solid #ccc', paddingVertical: 6 },
	td: { flex: 1 },
	tdRight: { flex: 1, textAlign: 'right' },
	// Narrow, right-aligned column for quantity to avoid visual merging with the amount column
	qtyCol: { width: 40, textAlign: 'center' },
	// Fixed widths for numeric columns to ensure perfect alignment with headers
	amountCol: { width: 120, textAlign: 'center' },
	ivaPctCol: { width: 80, textAlign: 'center' },
	ivaCol: { width: 100, textAlign: 'center' },
	totals: { marginTop: 10, alignSelf: 'flex-start', width: 240 },
	totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
	rectifiesBox: { backgroundColor: '#FFF9C4', padding: 6, borderRadius: 2 },
	legalNote: { marginTop: 14, fontSize: 9, color: '#444' },
	footerNote: { marginTop: 20, fontSize: 8, color: '#777', textAlign: 'center' }
})

export function InvoicePdfDocument(props: InvoicePdfProps) {
	const {
		practitionerName,
		practitionerEmail,
		practitionerTaxId,
		practitionerAddress,
		clientName,
		clientEmail,
		invoiceId,
		series,
		number,
		issuedAt,
		currency,
		subtotal,
		taxTotal,
		total,
		items
	} = props

	const issuedStr = issuedAt ? format(new Date(issuedAt), 'dd/MM/yyyy') : ''
	const displayNumber = series && number != null ? `${series}-${number}` : invoiceId.slice(0, 8)
	const isCredit = props.kind === 'credit_note'

	return (
		<Document>
			<Page size="A4" style={styles.page}>
				<View style={styles.header}>
					<Text style={styles.headerTitle}>{isCredit ? 'Factura rectificativa' : 'Factura'}</Text>
					{issuedStr ? <Text style={styles.headerLine}>Fecha de emisión: {issuedStr}</Text> : null}
					<Text style={styles.headerLine}>ID: CAPP-{displayNumber}</Text>
				</View>

				{isCredit && props.rectifiesDisplay ? (
					<View style={[styles.section, styles.rectifiesBox]}>
						<Text>Rectifica la Factura Nº {props.rectifiesDisplay}</Text>
					</View>
				) : null}

				<View style={[styles.section, { maxWidth: 340 }]}>
					<Text style={styles.label}>Emisor</Text>
					<Text style={styles.infoLine}>{(practitionerName || '').toUpperCase()}</Text>
					{practitionerEmail ? <Text style={styles.infoLine}>{practitionerEmail}</Text> : null}
					{practitionerTaxId ? <Text style={styles.infoLine}>NIF: {practitionerTaxId}</Text> : null}
					{practitionerAddress ? (
						<>
							{practitionerAddress.line1 ? (
								<Text style={styles.infoLine}>{practitionerAddress.line1}</Text>
							) : null}
							{practitionerAddress.line2 ? (
								<Text style={styles.infoLine}>{practitionerAddress.line2}</Text>
							) : null}
							{practitionerAddress.postalCode ||
							practitionerAddress.city ||
							practitionerAddress.province ? (
								<Text style={styles.infoLine}>
									{practitionerAddress.postalCode || ''}
									{practitionerAddress.city ? ` ${practitionerAddress.city}` : ''}
									{practitionerAddress.province ? `, ${practitionerAddress.province}` : ''}
								</Text>
							) : null}
						</>
					) : null}
				</View>

				<View style={styles.section}>
					<Text style={styles.label}>Cliente</Text>
					<Text style={styles.infoLine}>{clientName}</Text>
					{clientEmail ? <Text style={styles.infoLine}>{clientEmail}</Text> : null}
				</View>

				<View style={styles.section}>
					<View style={styles.tableHeader}>
						<Text style={styles.th}>Concepto</Text>
						<Text style={[styles.th, { width: 40, textAlign: 'right' }]}>Cantidad</Text>
						<Text style={[styles.th, { width: 100, textAlign: 'right' }]}>Importe</Text>
						<Text style={[styles.th, { width: 80, textAlign: 'right' }]}>IVA %</Text>
						<Text style={[styles.th, { width: 100, textAlign: 'right' }]}>IVA</Text>
					</View>
					{items.map((it, idx) => (
						<View key={idx} style={styles.tr}>
							<Text style={styles.td}>{it.description}</Text>
							<Text style={[styles.qtyCol, { width: 40, textAlign: 'center' }]}>
								{(it.qty ?? 1).toString()}
							</Text>
							<Text style={[styles.amountCol, { width: 120, textAlign: 'center' }]}>
								{(it.amount ?? 0).toFixed(2)} {currency}
							</Text>
							<Text style={[styles.ivaPctCol, { width: 80, textAlign: 'right' }]}>
								{(it.tax_rate_percent ?? 0).toFixed(2)}%
							</Text>
							<Text style={[styles.ivaCol, { width: 100, textAlign: 'right' }]}>
								{(it.tax_amount ?? 0).toFixed(2)} {currency}
							</Text>
						</View>
					))}
				</View>

				<View style={styles.totals}>
					<View style={styles.totalRow}>
						<Text>Subtotal</Text>
						<Text>
							{subtotal.toFixed(2)} {currency}
						</Text>
					</View>
					<View style={styles.totalRow}>
						<Text>Impuestos</Text>
						<Text>
							{taxTotal.toFixed(2)} {currency}
						</Text>
					</View>
					<View style={styles.totalRow}>
						<Text style={{ fontWeight: 700 }}>Total</Text>
						<Text style={{ fontWeight: 700 }}>
							{total.toFixed(2)} {currency}
						</Text>
					</View>
				</View>

				{/* Nota legal IVA (España) */}
				<View style={styles.legalNote}>
					<Text>IVA exento según art. 20.Uno.3 Ley 37/1992</Text>
				</View>

				{/* Pie de página discreto */}
				<View>
					<Text style={styles.footerNote}>Factura generada por Coco (itscoco.app)</Text>
				</View>
			</Page>
		</Document>
	)
}

export default InvoicePdfDocument
