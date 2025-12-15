'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { Repeat, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useBookingDetails } from '@/hooks/useBookingDetails'

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
	onArchiveBooking: (bookingId: string) => void
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
	onCancelSeries,
	onArchiveBooking
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
	onArchiveBooking: (bookingId: string) => void
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
						onArchiveBooking={onArchiveBooking}
					/>
				</div>
			</div>
		</div>
	)
}

type SortColumn = 'patient' | 'date' | 'payment' | 'amount' | null
type SortDirection = 'asc' | 'desc'

export function BookingsTable({
	bookings,
	loading = false,
	onCancelBooking,
	onConfirmBooking,
	onMarkAsPaid,
	onRefundBooking,
	onRescheduleBooking,
	onResendEmail,
	onCancelSeries,
	onArchiveBooking
}: BookingsTableProps) {
	const router = useRouter()
	const [isMobile, setIsMobile] = useState(false)
	const searchParams = useSearchParams()
	const [sortColumn, setSortColumn] = useState<SortColumn>(null)
	const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

	// Initialize booking details hook with URL sync callbacks
	const {
		details,
		isLoading: detailsLoading,
		isOpen,
		open,
		close
	} = useBookingDetails({
		onOpen: (bookingId) => {
			// Reflect open state in URL for persistence across tab switches / reloads
			try {
				const path = window.location.pathname
				const base = `${path}?panel=booking&id=${bookingId}`
				router.replace(base, { scroll: false })
			} catch (_) {
				// Ignore errors
			}
		},
		onClose: () => {
			// Clear URL when closing
			try {
				router.replace(window.location.pathname, { scroll: false })
			} catch (_) {
				// Ignore errors
			}
		}
	})

	useEffect(() => {
		const onResize = () => setIsMobile(window.innerWidth < 768)
		onResize()
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	}, [])

	// Open details for a booking
	const openDetails = async (b: Booking) => {
		await open(b.id)
	}

	// Handle column header click for sorting
	const handleSort = (column: SortColumn) => {
		if (sortColumn === column) {
			// Toggle direction if clicking the same column
			setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
		} else {
			// Set new column with default direction
			setSortColumn(column)
			// Default directions: date and amount start with desc, others with asc
			setSortDirection(column === 'date' || column === 'amount' ? 'desc' : 'asc')
		}
	}

	// Get payment status string for sorting
	const getPaymentStatusString = (booking: Booking): string => {
		const displayStatus =
			booking.payment_status === 'not_applicable' && booking.billing_status === 'pending'
				? 'scheduled'
				: booking.payment_status === 'not_applicable'
					? 'na'
					: booking.payment_status
		return displayStatus
	}

	// Sort bookings based on current sort state
	const sortedBookings = useMemo(() => {
		if (!sortColumn) return bookings

		const sorted = [...bookings].sort((a, b) => {
			let aValue: string | number | Date
			let bValue: string | number | Date

			switch (sortColumn) {
				case 'patient':
					aValue = a.customerName.toLowerCase()
					bValue = b.customerName.toLowerCase()
					break
				case 'date':
					aValue = a.bookingDate
					bValue = b.bookingDate
					break
				case 'payment':
					aValue = getPaymentStatusString(a)
					bValue = getPaymentStatusString(b)
					break
				case 'amount':
					aValue = a.amount
					bValue = b.amount
					break
				default:
					return 0
			}

			// Compare values
			if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
			if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
			return 0
		})

		return sorted
	}, [bookings, sortColumn, sortDirection])

	// Render sort icon for column header
	const renderSortIcon = (column: SortColumn) => {
		if (sortColumn !== column) {
			return <ArrowUpDown className="h-3 w-3 text-gray-400" />
		}
		return sortDirection === 'asc' ? (
			<ArrowUp className="h-3 w-3 text-gray-700" />
		) : (
			<ArrowDown className="h-3 w-3 text-gray-700" />
		)
	}

	// Sync opening from URL (deep-link / back-forward)
	useEffect(() => {
		try {
			const paramPanel = searchParams.get('panel')
			const paramId = searchParams.get('id')
			if (paramPanel === 'booking' && paramId && !isOpen) {
				// Only open if not already open for this booking
				// The hook will handle fetching details
				open(paramId).catch(() => {
					// Silently handle errors - URL might have invalid booking ID
				})
			} else if (paramPanel !== 'booking' && isOpen) {
				// Close if URL doesn't have panel=booking but panel is open
				close()
			}
		} catch (_) {
			// Ignore errors
		}
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
				{sortedBookings.map((booking) => (
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
						onArchiveBooking={onArchiveBooking}
					/>
				))}
			</div>

			{/* Desktop Table */}
			<div className="hidden md:block">
				<div className="bg-white rounded-lg overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow className=" border-b ">
								<TableHead
									className="font-medium w-[150px] md:w-[150px] cursor-pointer hover:bg-gray-50/50 transition-colors select-none"
									onClick={() => handleSort('patient')}
								>
									<div className="flex items-center gap-2">
										Paciente
										{renderSortIcon('patient')}
									</div>
								</TableHead>
								<TableHead
									className="hidden md:table-cell font-semibold w-[140px] text-center cursor-pointer hover:bg-gray-50/50 transition-colors select-none"
									onClick={() => handleSort('date')}
								>
									<div className="flex items-center justify-center gap-2">
										Fecha
										{renderSortIcon('date')}
									</div>
								</TableHead>
								<TableHead className="hidden md:table-cell font-semibold w-[100px] text-center">
									Hora
								</TableHead>
								<TableHead className="hidden sm:table-cell font-semibold w-[160px] text-center">
									Estado
								</TableHead>
								<TableHead
									className="hidden lg:table-cell font-semibold w-[120px] text-center cursor-pointer hover:bg-gray-50/50 transition-colors select-none"
									onClick={() => handleSort('payment')}
								>
									<div className="flex items-center justify-center gap-2">
										Pago
										{renderSortIcon('payment')}
									</div>
								</TableHead>
								<TableHead
									className="text-right font-semibold w-[120px] cursor-pointer hover:bg-gray-50/50 transition-colors select-none"
									onClick={() => handleSort('amount')}
								>
									<div className="flex items-center justify-end gap-2">
										Honorarios
										{renderSortIcon('amount')}
									</div>
								</TableHead>
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
								sortedBookings.map((booking) => (
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
												onArchiveBooking={onArchiveBooking}
											/>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>
			<SideSheet isOpen={isOpen} onClose={close} title="Detalles de la cita" description={undefined}>
				<BookingDetailsPanel details={details} onClose={close} isLoading={detailsLoading} />
			</SideSheet>
		</div>
	)
}
