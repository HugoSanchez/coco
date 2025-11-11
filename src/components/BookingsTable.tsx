'use client'

import { useState, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { SideSheet } from '@/components/SideSheet'
import { BookingActions, type BookingActionBooking } from '@/components/BookingActions'
import { StatusBadge, PaymentBadge, SeriesBadge } from '@/components/Badges'
import BookingDetailsPanel from '@/components/BookingDetailsPanel'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Repeat } from 'lucide-react'

export interface Booking {
	id: string
	customerName: string
	customerEmail: string
	bookingDate: Date
	startTime?: Date // Optional for backward compatibility
	status: 'pending' | 'scheduled' | 'completed' | 'canceled'
	billing_status: 'not_generated' | 'pending' | 'sent' | 'canceled'
	payment_status: 'not_applicable' | 'pending' | 'paid' | 'disputed' | 'canceled' | 'refunded'
	amount: number
	currency?: string
	series_id?: string // V2: For recurring bookings
}

interface BookingsTableProps {
	bookings: Booking[]
	loading?: boolean
	onCancelBooking: (bookingId: string) => void
	onConfirmBooking: (bookingId: string) => void
	onMarkAsPaid: (bookingId: string) => void
	onRefundBooking: (bookingId: string) => void
	onRescheduleBooking: (bookingId: string) => void
	onResendEmail: (bookingId: string) => void
	onCancelSeries?: (seriesId: string) => void // V2: Optional cancel series handler
}

function getStatusBadge(status: 'pending' | 'scheduled' | 'completed' | 'canceled') {
	return <StatusBadge status={status} size="sm" />
}

function getPaymentBadge(booking: Booking, isDesktop: boolean = false) {
	const displayStatus =
		booking.payment_status === 'not_applicable' && booking.billing_status === 'pending'
			? 'scheduled'
			: booking.payment_status === 'not_applicable'
				? 'na'
				: (booking.payment_status as any)
	return <PaymentBadge status={displayStatus} size={isDesktop ? 'lg' : 'sm'} />
}

// Reusable Actions Component to avoid logic duplication
// BookingActions moved to components/BookingActions.tsx

// Mobile Card Component
function BookingCard({
	booking,
	onCancelBooking,
	onConfirmBooking,
	onMarkAsPaid,
	onRefundBooking,
	onRescheduleBooking,
	onResendEmail,
	onViewDetails,
	onCancelSeries
}: {
	booking: Booking
	onCancelBooking: (bookingId: string) => void
	onConfirmBooking: (bookingId: string) => void
	onMarkAsPaid: (bookingId: string) => void
	onRefundBooking: (bookingId: string) => void
	onRescheduleBooking: (bookingId: string) => void
	onResendEmail: (bookingId: string) => void
	onViewDetails: (booking: Booking) => void
	onCancelSeries?: (seriesId: string) => void // V2: Optional cancel series handler
}) {
	return (
		<div
			className="bg-white border rounded-lg p-4 mb-3 transition-colors cursor-pointer hover:bg-gray-50/50"
			onClick={() => onViewDetails(booking)}
		>
			<div className="flex justify-between items-center">
				<div className="flex-1 min-w-0">
					{/* Name, Date, and Amount on same line */}
					<div className="flex items-center mb-2">
						<div className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
							{booking.series_id && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Repeat className="h-3.5 w-3.5 text-teal-500 flex-shrink-0" />
										</TooltipTrigger>
										<TooltipContent>
											<p>Evento recurrente</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
							{booking.customerName}
						</div>
						<div className="text-sm text-gray-600 font-light flex-shrink-0 ml-2">
							{format(booking.bookingDate, 'dd MMM yyyy', {
								locale: es
							})}
						</div>
					</div>

					{/* Status badges on same line */}
					<div className="flex gap-2 flex-wrap">
						{getStatusBadge(booking.status)}
						{getPaymentBadge(booking)}
					</div>
				</div>

				{/* Actions */}
				<div className="ml-3 flex-shrink-0">
					<BookingActions
						isMobile={true}
						booking={booking as unknown as BookingActionBooking}
						onCancelBooking={onCancelBooking}
						onConfirmBooking={onConfirmBooking}
						onMarkAsPaid={onMarkAsPaid}
						onRefundBooking={onRefundBooking}
						onRescheduleBooking={onRescheduleBooking}
						onResendEmail={onResendEmail}
						onCancelSeries={onCancelSeries}
					/>
				</div>
			</div>
		</div>
	)
}

export function BookingsTable({
	bookings,
	loading = false,
	onCancelBooking,
	onConfirmBooking,
	onMarkAsPaid,
	onRefundBooking,
	onRescheduleBooking,
	onResendEmail,
	onCancelSeries
}: BookingsTableProps) {
	const router = useRouter()
	const [isMobile, setIsMobile] = useState(false)
	const searchParams = useSearchParams()
	const [detailsOpen, setDetailsOpen] = useState(() => {
		if (typeof window === 'undefined') return false
		const sp = new URLSearchParams(window.location.search)
		return sp.get('panel') === 'booking' && !!sp.get('id')
	})
	const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
	const [details, setDetails] = useState<any>(null)

	useEffect(() => {
		const onResize = () => setIsMobile(window.innerWidth < 768)
		onResize()
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	}, [])

	const openDetails = async (b: Booking) => {
		setSelectedBooking(b)
		setDetails(null)
		setDetailsOpen(true)
		// Reflect open state in URL for persistence across tab switches / reloads
		try {
			const path = window.location.pathname
			const base = `${path}?panel=booking&id=${b.id}`
			router.replace(base)
		} catch (_) {}
		try {
			const res = await fetch(`/api/bookings/${b.id}`)
			if (res.ok) {
				const data = await res.json()
				setDetails(data)
			}
		} catch (_) {}
	}

	// Sync opening from URL (deep-link / back-forward)
	useEffect(() => {
		try {
			const paramPanel = searchParams.get('panel')
			const paramId = searchParams.get('id')
			if (paramPanel === 'booking' && paramId) {
				setDetailsOpen(true)
				if (!selectedBooking || selectedBooking.id !== paramId) {
					setSelectedBooking({
						id: paramId,
						customerName: '',
						customerEmail: '',
						bookingDate: new Date(),
						status: 'pending',
						billing_status: 'pending',
						payment_status: 'pending',
						amount: 0,
						currency: 'EUR'
					} as any)
					;(async () => {
						try {
							const res = await fetch(`/api/bookings/${paramId}`)
							if (res.ok) {
								const data = await res.json()
								setDetails(data)
							}
						} catch (_) {}
					})()
				}
			}
		} catch (_) {}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams])
	if (loading) {
		return (
			<div className="flex justify-center items-center py-8">
				<Spinner size="sm" />
			</div>
		)
	}

	if (bookings.length === 0) {
		return <div className="text-center py-8 text-gray-500">No hay citas programadas</div>
	}

	return (
		<div className="space-y-4">
			{/* Mobile Cards */}
			<div className="md:hidden">
				{bookings.map((booking) => (
					<BookingCard
						key={booking.id}
						booking={booking}
						onCancelBooking={onCancelBooking}
						onConfirmBooking={onConfirmBooking}
						onMarkAsPaid={onMarkAsPaid}
						onRefundBooking={onRefundBooking}
						onRescheduleBooking={onRescheduleBooking}
						onResendEmail={onResendEmail}
						onViewDetails={openDetails}
						onCancelSeries={onCancelSeries}
					/>
				))}
			</div>

			{/* Desktop Table */}
			<div className="hidden md:block">
				<div className="bg-white rounded-lg overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow className=" border-b ">
								<TableHead className="font-medium w-[150px] md:w-[150px]">Paciente</TableHead>
								<TableHead className="hidden md:table-cell font-semibold w-[140px] text-center">
									Fecha
								</TableHead>
								<TableHead className="hidden md:table-cell font-semibold w-[100px] text-center">
									Hora
								</TableHead>
								<TableHead className="hidden sm:table-cell font-semibold w-[160px] text-center">
									Estado
								</TableHead>
								<TableHead className="hidden lg:table-cell font-semibold w-[120px] text-center">
									Pago
								</TableHead>
								<TableHead className="text-right font-semibold w-[120px]">Honorarios</TableHead>
								<TableHead className="w-[50px]"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{bookings.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7} className="h-20">
										<div className="flex items-center justify-center h-full">
											<div className="text-center">
												<p className="text-sm text-gray-400">
													Todavía no hay citas programadas.
												</p>
											</div>
										</div>
									</TableCell>
								</TableRow>
							) : (
								bookings.map((booking) => (
								<TableRow
									key={booking.id}
									className="transition-colors h-14 cursor-pointer hover:bg-gray-50/50"
									onClick={() => openDetails(booking)}
								>
										{/* Client */}
										<TableCell className="py-2 pr-0">
											<div className="font-medium flex items-center gap-2">
												{booking.series_id && (
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<Repeat className="h-3.5 w-3.5 text-teal-500" />
															</TooltipTrigger>
															<TooltipContent>
																<p>Evento recurrente</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												)}
												{booking.customerName}
											</div>
										</TableCell>

										{/* Date */}
										<TableCell className="hidden md:table-cell text-center py-2">
											<span className="font-light">
												{format(booking.bookingDate, 'dd MMM yyyy', { locale: es })}
											</span>
										</TableCell>

										{/* Time */}
										<TableCell className="hidden md:table-cell text-center py-2">
											<span className="font-light">
												{format(booking.startTime || booking.bookingDate, 'HH:mm')}h
											</span>
										</TableCell>

										{/* Booking Status */}
										<TableCell className="hidden sm:table-cell text-center py-2">
											{getStatusBadge(booking.status)}
										</TableCell>

										{/* Payment Status */}
										<TableCell className="hidden lg:table-cell text-center py-2">
											{getPaymentBadge(booking)}
										</TableCell>

										{/* Amount */}
										<TableCell className="text-right font-light py-2">
											<span className="font-semibold">
												{booking.amount.toFixed(2)} {booking.currency || 'EUR'}
											</span>
										</TableCell>

										{/* Actions */}
										<TableCell className="text-right py-2" onClick={(e) => e.stopPropagation()}>
											<BookingActions
												isMobile={isMobile}
												booking={booking as unknown as BookingActionBooking}
												onCancelBooking={onCancelBooking}
												onConfirmBooking={onConfirmBooking}
												onMarkAsPaid={onMarkAsPaid}
												onRefundBooking={onRefundBooking}
												onRescheduleBooking={onRescheduleBooking}
												onResendEmail={onResendEmail}
												onCancelSeries={onCancelSeries}
											/>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>
			<SideSheet
				isOpen={detailsOpen}
				onClose={() => {
					setDetailsOpen(false)
					try {
						router.replace(window.location.pathname)
					} catch (_) {}
				}}
				title="Detalles de la cita"
				description={undefined}
			>
				<BookingDetailsPanel
					details={details}
					onClose={() => {
						setDetailsOpen(false)
						try {
							router.replace(window.location.pathname)
						} catch (_) {}
					}}
				/>
			</SideSheet>
		</div>
	)
}
