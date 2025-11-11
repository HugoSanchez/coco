'use client'

import { Check, Clock, X, Loader, RefreshCcw } from 'lucide-react'

type PaymentStatus = 'scheduled' | 'pending' | 'paid' | 'disputed' | 'canceled' | 'refunded' | 'na'

interface Booking {
	id: string
	type: 'booking' | 'busy'
	patientName: string
	appointmentType: string
	startTime: string
	endTime: string
	date: string
	status: 'completed' | 'scheduled' | 'canceled' | 'waiting'
	consultation_type?: 'first' | 'followup' | null
	payment_status?: PaymentStatus
}

interface BookingCardProps {
	booking: Booking
	position: { top: string; height: string }
}

const getPaymentBadge = (status: PaymentStatus) => {
	switch (status) {
		case 'paid':
			return {
				bg: 'bg-teal-50',
				text: 'text-teal-700',
				icon: <Check className="h-3 w-3" />,
				label: 'Pagada',
				dotColor: 'bg-teal-500',
				borderColor: 'border-l-teal-500'
			}
		case 'pending':
			return {
				bg: 'bg-orange-50',
				text: 'text-orange-700',
				icon: <Loader className="h-3 w-3" />,
				label: 'Pendiente',
				dotColor: 'bg-orange-500',
				borderColor: 'border-l-orange-500'
			}
		case 'scheduled':
			return {
				bg: 'bg-blue-50',
				text: 'text-blue-700',
				icon: <Clock className="h-3 w-3" />,
				label: 'Programado',
				dotColor: 'bg-blue-500',
				borderColor: 'border-l-blue-500'
			}
		case 'canceled':
			return {
				bg: 'bg-red-50',
				text: 'text-red-700',
				icon: <X className="h-3 w-3" />,
				label: 'Cancelado',
				dotColor: 'bg-red-500',
				borderColor: 'border-l-red-500'
			}
		case 'refunded':
			return {
				bg: 'bg-red-50',
				text: 'text-red-700',
				icon: <RefreshCcw className="h-3 w-3" />,
				label: 'Reembolsado',
				dotColor: 'bg-red-500',
				borderColor: 'border-l-red-500'
			}
		case 'disputed':
			return {
				bg: 'bg-red-50',
				text: 'text-red-700',
				icon: <RefreshCcw className="h-3 w-3" />,
				label: 'Disputado',
				dotColor: 'bg-red-500',
				borderColor: 'border-l-red-500'
			}
		case 'na':
		default:
			return {
				bg: 'bg-gray-50',
				text: 'text-gray-700',
				icon: null,
				label: 'N/A',
				dotColor: 'bg-gray-500',
				borderColor: 'border-l-gray-500'
			}
	}
}

export function WeeklyAgendaBookingCard({ booking, position }: BookingCardProps) {
	// Render busy slots with different styling
	if (booking.type === 'busy') {
		return (
			<div
				key={booking.id}
				className="absolute left-2 right-2 bg-gray-100 rounded border border-gray-300 border-l-4 border-l-gray-400 cursor-not-allowed z-0 overflow-hidden"
				style={{
					top: position.top,
					height: position.height,
					backgroundImage:
						'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)'
				}}
			>
				<div className="p-2 h-full flex flex-col justify-center">
					<div className="text-xs text-gray-500">
						{booking.startTime} - {booking.endTime}
					</div>
					<div className="font-medium text-sm text-gray-600 mt-0.5">
						Ocupado
						<p className="text-xs text-gray-400 font-light">
							Espacio ocupado en tu Google Calendar.
						</p>
					</div>
				</div>
			</div>
		)
	}

	// Render regular bookings
	// Get consultation type label
	const consultationTypeLabel =
		booking.consultation_type === 'first'
			? 'Primera consulta'
			: booking.consultation_type === 'followup'
				? 'Consulta de seguimiento'
				: null

	// Get payment badge (always show, default to 'na' if not available)
	const paymentBadge = getPaymentBadge(booking.payment_status || 'na')

	// Use payment badge border color instead of booking status border color
	const borderColor = paymentBadge.borderColor

	return (
		<div
			key={booking.id}
			className={`absolute left-2 right-2 bg-white rounded border border-gray-200 border-l-4 ${borderColor} cursor-pointer transition-all hover:shadow-md pointer-events-auto z-0 overflow-hidden`}
			style={{
				top: position.top,
				height: position.height
			}}
		>
			<div className="p-2 h-full flex flex-col">
				<div className="flex-1">
					<div className="text-xs text-gray-600">
						{booking.startTime} - {booking.endTime}
					</div>
					<div className="font-semibold text-sm text-gray-900 mt-0.5">
						{booking.patientName}
					</div>
					{consultationTypeLabel && (
						<div className="text-xs text-gray-600 mt-0.5">
							{consultationTypeLabel}
						</div>
					)}
					{booking.appointmentType && (
						<div className="text-xs text-gray-600 mt-0.5">
							{booking.appointmentType}
						</div>
					)}
				</div>
				<div
					className={`flex items-center gap-1.5 mt-2 py-1 pl-2 rounded text-xs font-medium ${paymentBadge.bg} ${paymentBadge.text}`}
				>
					{paymentBadge.icon ? (
						paymentBadge.icon
					) : (
						<div className={`h-2 w-2 ${paymentBadge.dotColor} rounded-full`} />
					)}
					{paymentBadge.label}
				</div>
			</div>
		</div>
	)
}

