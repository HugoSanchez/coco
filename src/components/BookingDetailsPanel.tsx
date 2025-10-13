import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Check, Clock, AlertCircle } from 'lucide-react'
import { useEffect } from 'react'

interface BookingDetailsPanelProps {
	details: any
	onClose?: () => void
}

export function BookingDetailsPanel({ details, onClose }: BookingDetailsPanelProps) {
	const bill = details?.bill

	useEffect(() => {
		if (details) {
			console.log('[BookingDetailsPanel] details debug', {
				bookingId: details?.bookingId,
				bill: details?.bill,
				stripe_receipt_url: details?.bill?.stripe_receipt_url
			})
		}
	}, [details])

	const fmt = (iso?: string | null, pattern: string = 'dd/MM/yyyy HH:mm') =>
		iso ? format(new Date(iso), pattern, { locale: es }) : null

	const paymentUrl = details?.bookingId
		? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/payments/${details.bookingId}`
		: undefined

	const capFirst = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : null)

	// Documents helpers
	const invoiceLink = Array.isArray(details?.invoices)
		? details.invoices.find((inv: any) => inv?.kind === 'invoice' && !!inv?.url)
		: null
	const creditNoteLink = Array.isArray(details?.invoices)
		? details.invoices.find((inv: any) => inv?.kind === 'credit_note' && !!inv?.url)
		: null
	const isMonthly =
		bill?.billing_type === 'monthly' ||
		(Array.isArray(details?.invoice_items) && details.invoice_items.some((it: any) => it?.cadence === 'monthly'))

	// Helpers to match table styles
	const getStatusLabel = (status?: string) => {
		switch (status) {
			case 'pending':
				return 'Programada'
			case 'scheduled':
				return 'Confirmada'
			case 'completed':
				return 'Confirmada'
			case 'canceled':
				return 'Cancelada'
			default:
				return status || ''
		}
	}

	const getStatusColor = (status?: string) => {
		switch (status) {
			case 'pending':
				return 'text-gray-700 border-gray-200 font-normal bg-white py-2 px-4'
			case 'scheduled':
				return 'bg-teal-100 border-teal-200 border text-teal-800 font-medium py-2 px-4'
			case 'completed':
				return 'bg-teal-100 border-0 text-teal-800 font-medium py-2 px-4'
			case 'canceled':
				return 'bg-red-100 text-red-800 border-0 font-medium py-2 px-4'
			default:
				return 'bg-gray-100 text-gray-700 border-gray-200 py-2 px-4'
		}
	}

	type PaymentStatus = 'not_applicable' | 'pending' | 'paid' | 'disputed' | 'canceled' | 'refunded'
	const getPaymentStatusLabel = (status: PaymentStatus) => {
		switch (status) {
			case 'not_applicable':
				return 'N/A'
			case 'pending':
				return 'Pendiente de pago'
			case 'paid':
				return 'Pagada'
			case 'disputed':
				return 'Disputado'
			case 'canceled':
				return 'Cancelado'
			case 'refunded':
				return 'Reembolsado'
			default:
				return status
		}
	}

	const getPaymentStatusColor = (status: PaymentStatus) => {
		switch (status) {
			case 'not_applicable':
				return 'bg-gray-100 text-gray-500 border-gray-200 py-2 px-4'
			case 'pending':
				return 'bg-white text-gray-700 border-gray-200 font-normal py-2 px-4'
			case 'paid':
				return 'bg-teal-100 border-teal-200 border text-teal-700 font-medium py-2 px-4'
			case 'disputed':
				return 'bg-red-100 text-red-700 border-red-200 py-2 px-4'
			case 'canceled':
				return 'text-gray-700 border-0 font-medium py-2 px-4'
			case 'refunded':
				return 'text-gray-700 bg-gray-200 border-1 border-gray-200 font-medium py-2 px-4'
			default:
				return 'bg-gray-100 text-gray-700 border-gray-200 py-2 px-4'
		}
	}

	const mapBillToPaymentStatus = (bill?: any): PaymentStatus => {
		if (!bill) return 'not_applicable'
		// Monthly billing: do not mark as pending until monthly email goes out
		if (bill.billing_type === 'monthly') {
			// Without a send marker, treat as not applicable for per-booking payment
			return 'not_applicable'
		}
		const statusStr = (bill.status || '').toString()
		if (statusStr === 'paid') return 'paid'
		if (statusStr === 'refunded') return 'refunded'
		if (statusStr === 'canceled') return 'canceled'
		if (statusStr === 'disputed') return 'disputed'
		// Only show pending after email was sent
		if (bill.sent_at) return 'pending'
		return 'not_applicable'
	}

	if (!details) {
		return (
			<div className="h-full w-full flex items-center justify-center">
				<Spinner size="sm" color="dark" />
			</div>
		)
	}

	return (
		<div className="space-y-6 py-10">
			{/* Patient */}
			<div className="">
				<label className="text-xs text-gray-500 block mb-2">Paciente</label>
				<div className="text-base font-medium text-gray-900">
					{details?.clientName}
					{details?.clientLastName ? ` ${details.clientLastName}` : ''}
				</div>
				{details?.clientEmail && <div className="text-sm text-gray-700">{details.clientEmail}</div>}
			</div>

			{/* Time */}
			<div className="space-y-1">
				<label className="text-xs text-gray-500 block">Fecha y hora</label>
				<div className="text-base font-medium">
					{capFirst(fmt(details?.consultationDate, "EEEE, d 'de' MMMM 'de' yyyy, HH:mm"))}
					{'h '}
				</div>
			</div>

			{/* Status and Payment badges side-by-side */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div className="space-y-1">
					<label className="text-xs text-gray-500 block mb-2">Estado de agenda</label>
					<div>
						<Badge
							variant="outline"
							className={`inline-flex items-center gap-1 text-xs ${getStatusColor(details?.status)}`}
						>
							{getStatusLabel(details?.status)}
						</Badge>
					</div>
				</div>
				<div className="space-y-1">
					<label className="text-xs text-gray-500 block mb-2">Estado de pago</label>
					<div>
						{(() => {
							const ps = mapBillToPaymentStatus(bill)
							return (
								<Badge
									variant="outline"
									className={`inline-flex items-center gap-1 text-xs ${getPaymentStatusColor(ps)}`}
								>
									{ps === 'paid' && <Check className="h-4 w-4 mr-1 text-teal-500" />}
									{getPaymentStatusLabel(ps)}
								</Badge>
							)
						})()}
					</div>
				</div>
			</div>

			{/* Amount */}
			<div className="space-y-1">
				<label className="text-xs text-gray-500 block">Importe</label>
				<div className="text-base font-medium">
					{bill ? (
						<>
							{Number(bill.amount).toFixed(2)} {bill.currency || 'EUR'}
						</>
					) : (
						<span className="text-gray-500">Sin información de pago</span>
					)}
				</div>
			</div>

			{/* Communications */}
			<div className="space-y-1">
				<label className="text-xs text-gray-500 inline-flex items-center">
					Comunicaciones{' '}
					{bill?.sent_at ? (
						<Check className="h-4 w-4 text-teal-500 ml-2" />
					) : bill?.email_scheduled_at ? (
						<Clock className="h-4 w-4 text-gray-600 ml-2" />
					) : bill?.billing_type === 'monthly' ? (
						<Clock className="h-4 w-4 text-gray-600 ml-2" />
					) : (
						<AlertCircle className="h-4 w-4 ml-2" />
					)}
				</label>
				<div className="text-sm">
					{bill?.sent_at ? (
						<div className="flex items-start">
							<span className="text-gray-600 text-sm">
								Email de confirmación y pago enviado correctamente el {fmt(bill.sent_at)}
								{'h'}.
							</span>
						</div>
					) : bill?.email_scheduled_at ? (
						<div className="flex items-start">
							<span>
								Email de confirmación y pago programado para {fmt(bill.email_scheduled_at)}
								{'h'}.
							</span>
						</div>
					) : bill?.billing_type === 'monthly' ? (
						<div className="flex items-start">
							<span>Facturación mensual programada</span>
						</div>
					) : (
						<div className="flex items-start text-red-700">
							<span>
								Ha habido un error con el email de confirmación, por favor, asegúrate de que el email
								del paciente es correcto.
							</span>
						</div>
					)}
				</div>
			</div>

			{/* Documents: receipt + invoices; show placeholder text when none */}
			<div className="space-y-1">
				<label className="text-xs text-gray-500 block">Facturas y recibos</label>
				<div className="flex flex-wrap items-center gap-2 py-2">
					{details?.documents?.receiptUrl && (
						<a
							href={details.documents.receiptUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm text-gray-800 font-medium border border-gray-200 bg-gray-200 rounded-md p-2 px-4 hover:bg-gray-200"
						>
							Ver recibo
						</a>
					)}
					{invoiceLink && (
						<a
							key={`invoice-${invoiceLink.display}`}
							href={invoiceLink.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm text-gray-800 font-medium border border-gray-200 bg-gray-200 rounded-md p-2 px-4 hover:bg-gray-200"
						>
							Ver factura
						</a>
					)}
					{creditNoteLink && (
						<a
							key={`credit-${creditNoteLink.display}`}
							href={creditNoteLink.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm text-gray-800 font-medium border border-gray-200 bg-gray-200 rounded-md p-2 px-4 hover:bg-gray-200"
						>
							Ver rectificativa
						</a>
					)}
					{!details?.documents?.receiptUrl && !invoiceLink && !creditNoteLink && (
						<span className="text-sm text-gray-700">
							{isMonthly
								? 'Se facturará de forma mensual'
								: mapBillToPaymentStatus(bill) === 'paid'
									? 'No disponible'
									: 'Se mostrarán una vez efectuado el pago'}
						</span>
					)}
				</div>
			</div>
		</div>
	)
}

export default BookingDetailsPanel
