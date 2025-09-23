import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Check, Clock, AlertCircle } from 'lucide-react'

interface BookingDetailsPanelProps {
	details: any
}

export function BookingDetailsPanel({ details }: BookingDetailsPanelProps) {
	const bill = details?.bill

	const fmt = (iso?: string | null, pattern: string = 'dd/MM/yyyy HH:mm') =>
		iso ? format(new Date(iso), pattern, { locale: es }) : null

	const paymentUrl = details?.bookingId
		? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/payments/${details.bookingId}`
		: undefined

	const capFirst = (s?: string | null) =>
		s ? s.charAt(0).toUpperCase() + s.slice(1) : null

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
				return 'text-gray-700 border-gray-200 font-normal bg-white py-1 px-3'
			case 'scheduled':
				return 'bg-teal-100 border-teal-200 border text-teal-800 font-medium py-1 px-3'
			case 'completed':
				return 'bg-teal-100 border-0 text-teal-800 font-medium py-1 px-3'
			case 'canceled':
				return 'bg-red-50 text-red-800 border-0 font-medium py-1 px-3'
			default:
				return 'bg-gray-100 text-gray-700 border-gray-200 py-1 px-3'
		}
	}

	type PaymentStatus =
		| 'not_applicable'
		| 'pending'
		| 'paid'
		| 'disputed'
		| 'canceled'
		| 'refunded'
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
				return 'Devuelto'
			default:
				return status
		}
	}

	const getPaymentStatusColor = (status: PaymentStatus) => {
		switch (status) {
			case 'not_applicable':
				return 'bg-gray-100 text-gray-500 border-gray-200 py-1 px-3'
			case 'pending':
				return 'bg-white text-gray-700 border-gray-200 font-normal py-1 px-3'
			case 'paid':
				return 'bg-teal-100 border-teal-200 border text-teal-700 font-medium py-1 px-3'
			case 'disputed':
				return 'bg-red-100 text-red-700 border-red-200 py-1 px-3'
			case 'canceled':
				return 'text-gray-700 border-0 font-medium py-1 px-3'
			case 'refunded':
				return 'text-gray-700 border-0 font-medium py-1 px-3'
			default:
				return 'bg-gray-100 text-gray-700 border-gray-200 py-1 px-3'
		}
	}

	const mapBillToPaymentStatus = (bill?: any): PaymentStatus => {
		if (!bill) return 'not_applicable'
		const s = (bill.status || '').toString()
		if (s === 'sent') return 'pending'
		if (s === 'pending') return 'pending'
		if (s === 'paid') return 'paid'
		if (s === 'refunded') return 'refunded'
		if (s === 'canceled') return 'canceled'
		if (s === 'disputed') return 'disputed'
		return 'pending'
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
				<label className="text-xs text-gray-500 block mb-2">
					Paciente
				</label>
				<div className="text-base font-medium text-gray-900">
					{details?.clientName}
					{details?.clientLastName
						? ` ${details.clientLastName}`
						: ''}
				</div>
				{details?.clientEmail && (
					<div className="text-sm text-gray-700">
						{details.clientEmail}
					</div>
				)}
			</div>

			{/* Time */}
			<div className="space-y-1">
				<label className="text-xs text-gray-500 block">
					Fecha y hora
				</label>
				<div className="text-base font-medium">
					{capFirst(
						fmt(
							details?.consultationDate,
							"EEEE, d 'de' MMMM 'de' yyyy, HH:mm"
						)
					)}
					{'h '}
				</div>
			</div>

			{/* Status and Payment badges side-by-side */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div className="space-y-1">
					<label className="text-xs text-gray-500 block">
						Estado
					</label>
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
					<label className="text-xs text-gray-500 block">Pago</label>
					<div>
						{(() => {
							const ps = mapBillToPaymentStatus(bill)
							return (
								<Badge
									variant="outline"
									className={`inline-flex items-center gap-1 text-xs ${getPaymentStatusColor(ps)}`}
								>
									{ps === 'paid' && (
										<Check className="h-4 w-4 mr-1 text-teal-500" />
									)}
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
							{Number(bill.amount).toFixed(2)}{' '}
							{bill.currency || 'EUR'}
						</>
					) : (
						<span className="text-gray-500">
							Sin información de pago
						</span>
					)}
				</div>
				{bill?.status === 'pending' && paymentUrl && (
					<div className="pt-1">
						<Button
							variant="secondary"
							onClick={async () => {
								try {
									await navigator.clipboard.writeText(
										paymentUrl
									)
								} catch (_) {}
							}}
						>
							Copiar link de pago
						</Button>
					</div>
				)}
			</div>

			{/* Communications */}
			<div className="space-y-1">
				<label className="text-xs text-gray-500 inline-flex items-center">
					Comunicaciones{' '}
					{bill?.sent_at ? (
						<Check className="h-4 w-4 text-teal-500 ml-2" />
					) : bill?.email_scheduled_at ? (
						<Clock className="h-4 w-4 text-gray-600 ml-2" />
					) : (
						<AlertCircle className="h-4 w-4 ml-2" />
					)}
				</label>
				<div className="text-sm">
					{bill?.sent_at ? (
						<div className="flex items-start">
							<span className="text-gray-600 text-sm">
								Email de confirmación y pago enviado
								correctamente el {fmt(bill.sent_at)}
								{'h'}.
							</span>
						</div>
					) : bill?.email_scheduled_at ? (
						<div className="flex items-start">
							<span>
								Email de confirmación y pago programado para{' '}
								{fmt(bill.email_scheduled_at)}
								{'h'}.
							</span>
						</div>
					) : (
						<div className="flex items-start text-red-700">
							<span>
								Ha habido un error con el email de confirmación,
								por favor, asegúrate de que el email del
								paciente es correcto.
							</span>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default BookingDetailsPanel
