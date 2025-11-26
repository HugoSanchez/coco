'use client'

import { Check, Clock, X, Loader, RefreshCcw, Repeat } from 'lucide-react'
import { BookingActions } from '@/components/BookingActions'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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
	series_id?: string // V2: For recurring bookings
}

interface BookingCardProps {
	booking: Booking
	position: { top: string; height: string }
	onCancelBooking?: (bookingId: string) => void
	onConfirmBooking?: (bookingId: string) => void
	onMarkAsPaid?: (bookingId: string) => void
	onRefundBooking?: (bookingId: string) => void
	onRescheduleBooking?: (bookingId: string) => void
	onResendEmail?: (bookingId: string) => void
	onCancelSeries?: (seriesId: string) => void
	actionMenuOpen?: boolean
	onActionMenuOpenChange?: (open: boolean) => void
	onClick?: (bookingId: string) => void // Handler for clicking on the booking card
}

const getPaymentBadge = (status: PaymentStatus) => {
	switch (status) {
		case 'paid':
			return {
				bg: 'border-teal-300 border border-dashed',
				text: 'text-teal-700',
				label: 'Pagada',
				icon: <Check className="h-3 w-3 text-teal-700" />,
				borderColor: 'border-l-teal-500 border-l-8 bg-[#fdfdfd] border border-gray-300'
			}
		case 'pending':
			return {
				bg: 'border-gray-300 border border-dashed',
				text: 'text-gray-800',
				icon: <Loader className="h-3 w-3 text-black" />,
				label: 'Pago pendiente',
				borderColor: 'border-l-gray-400 border-l-8 bg-[#fdfdfd] border border-gray-300'
			}
		case 'scheduled':
			return {
				bg: 'border-blue-300 border border-dashed',
				text: 'text-blue-800',
				icon: <Clock className="h-3 w-3 text-blue-800" />,
				label: 'Pago programado',
				borderColor: 'border-l-blue-400 border-l-8 bg-[#fdfdfd] border border-gray-300'
			}
		case 'canceled':
			return {
				bg: 'border-red-300 border border-dashed',
				text: 'text-red-700',
				icon: <X className="h-3 w-3 text-red-700" />,
				label: 'Pago cancelado',
				borderColor: 'border-l-red-400 border-l-8 bg-[#fdfdfd] border border-gray-300'
			}
		case 'refunded':
			return {
				bg: 'border-rose-300 border border-dashed',
				text: 'text-rose-700',
				icon: <RefreshCcw className="h-3 w-3" />,
				label: 'Reembolsado',
				borderColor: 'border-l-rose-400 border-l-8 bg-[#fdfdfd] border border-gray-300'
			}
		case 'disputed':
			return {
				bg: 'bg-red-50',
				text: 'text-red-700',
				icon: <RefreshCcw className="h-3 w-3" />,
				label: 'Disputado',
				borderColor: 'border-l-red-500'
			}
		case 'na':
		default:
			return {
				bg: 'bg-gray-50',
				text: 'text-gray-700',
				icon: null,
				label: 'N/A',
				borderColor: 'border-l-gray-500'
			}
	}
}

export function WeeklyAgendaBookingCard({
	booking,
	position,
	onCancelBooking,
	onConfirmBooking,
	onMarkAsPaid,
	onRefundBooking,
	onRescheduleBooking,
	onResendEmail,
	onCancelSeries,
	actionMenuOpen,
	onActionMenuOpenChange,
	onClick
}: BookingCardProps) {
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
						<p className="text-xs text-gray-400 font-light">Espacio ocupado en tu Google Calendar.</p>
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

	// Map booking status and payment_status to BookingActions format
	const mapStatusForActions = (status: Booking['status']): 'pending' | 'scheduled' | 'completed' | 'canceled' => {
		if (status === 'waiting') return 'pending'
		if (status === 'completed') return 'completed'
		if (status === 'canceled') return 'canceled'
		return 'scheduled' // 'scheduled' maps to itself
	}

	const mapPaymentStatusForActions = (
		paymentStatus: PaymentStatus | undefined
	): 'not_applicable' | 'pending' | 'paid' | 'disputed' | 'canceled' | 'refunded' => {
		if (!paymentStatus || paymentStatus === 'na') return 'not_applicable'
		if (paymentStatus === 'scheduled') return 'not_applicable' // Scheduled payments are not yet applicable
		return paymentStatus as 'pending' | 'paid' | 'disputed' | 'canceled' | 'refunded'
	}

	// Only show actions for booking type (not busy slots) and if handlers are provided
	const showActions = booking.type === 'booking' && onCancelBooking

	return (
		<div
			key={booking.id}
			className={`absolute left-2 right-2 rounded  border-l-4 ${borderColor} cursor-pointer transition-all hover:shadow-md pointer-events-auto z-0 overflow-hidden`}
			style={{
				top: position.top,
				height: position.height
			}}
			onClick={(e) => {
				// Only trigger onClick if not clicking on the actions menu
				if (!(e.target as HTMLElement).closest('[data-action-menu]')) {
					onClick?.(booking.id)
				}
			}}
		>
			<div className="p-2 h-full flex flex-col relative">
				{/* Actions menu in top-right corner */}
				{showActions && (
					<div className="absolute top-1 right-1 z-10" onClick={(e) => e.stopPropagation()} data-action-menu>
						<BookingActions
							isMobile={false}
							booking={{
								id: booking.id,
								status: mapStatusForActions(booking.status),
								payment_status: mapPaymentStatusForActions(booking.payment_status),
								series_id: booking.series_id
							}}
							onCancelBooking={onCancelBooking!}
							onConfirmBooking={onConfirmBooking!}
							onMarkAsPaid={onMarkAsPaid!}
							onRefundBooking={onRefundBooking!}
							onRescheduleBooking={onRescheduleBooking!}
							onResendEmail={onResendEmail!}
							onCancelSeries={onCancelSeries}
							open={actionMenuOpen}
							onOpenChange={onActionMenuOpenChange}
						/>
					</div>
				)}
				<div className="flex-1">
					<div className="text-xs text-gray-600 flex items-center gap-1.5">
						<span>
							{booking.startTime}h - {booking.endTime}h
						</span>
						{booking.series_id && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Repeat className="h-3 w-3 ml-1 text-teal-600 flex-shrink-0" />
									</TooltipTrigger>
									<TooltipContent>
										<p>Evento recurrente</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
					</div>
					<div className="font-medium text-sm text-gray-800">{booking.patientName}</div>
					{consultationTypeLabel && <div className="text-xs text-gray-600">{consultationTypeLabel}</div>}
				</div>
				<div
					className={`flex items-center gap-1.5 py-1 pl-2 rounded text-xs font-medium ${paymentBadge.bg} ${paymentBadge.text}`}
				>
					{paymentBadge.icon}
					{paymentBadge.label}
				</div>
			</div>
		</div>
	)
}
