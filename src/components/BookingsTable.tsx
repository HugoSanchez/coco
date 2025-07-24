'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import {
	MoreHorizontal,
	MoreVertical,
	X,
	Check,
	Loader,
	RefreshCcw
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export interface Booking {
	id: string
	customerName: string
	customerEmail: string
	bookingDate: Date
	startTime?: Date // Optional for backward compatibility
	status: 'pending' | 'scheduled' | 'completed' | 'canceled'
	billing_status: 'not_generated' | 'pending' | 'sent' | 'canceled'
	payment_status:
		| 'not_applicable'
		| 'pending'
		| 'paid'
		| 'disputed'
		| 'canceled'
		| 'refunded'
	amount: number
	currency?: string
}

interface BookingsTableProps {
	bookings: Booking[]
	loading?: boolean
	onCancelBooking: (bookingId: string) => void
	onConfirmBooking: (bookingId: string) => void
	onMarkAsPaid: (bookingId: string) => void
	onRefundBooking: (bookingId: string) => void
	onRescheduleBooking: (bookingId: string) => void
}

// Status labels in Spanish
const getStatusLabel = (status: string) => {
	switch (status) {
		case 'pending':
			return 'Por confirmar'
		case 'scheduled':
			return 'Confirmada'
		case 'completed':
			return 'Completada'
		case 'canceled':
			return 'Cancelada'
		default:
			return status
	}
}

// Status colors
const getStatusColor = (status: string) => {
	switch (status) {
		case 'pending':
			return 'text-gray-700 border-gray-200 font-normal'
		case 'scheduled':
			return 'bg-teal-100 border-0 text-teal-800 font-medium'
		case 'completed':
			return 'bg-green-100 text-green-700 border-green-200'
		case 'canceled':
			return 'bg-red-50 text-red-800 border-0 font-medium'
		default:
			return 'bg-gray-100 text-gray-700 border-gray-200'
	}
}

// Payment status labels in Spanish
const getPaymentStatusLabel = (status: string) => {
	switch (status) {
		case 'not_applicable':
			return 'N/A'
		case 'pending':
			return 'Pendiente'
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

// Payment status colors
const getPaymentStatusColor = (status: string) => {
	switch (status) {
		case 'not_applicable':
			return 'bg-gray-100 text-gray-500 border-gray-200'
		case 'pending':
			return 'text-gray-700 border-white font-normal'
		case 'paid':
			return 'border-white text-gray-700 font-normal'
		case 'disputed':
			return 'bg-red-100 text-red-700 border-red-200'
		case 'canceled':
			return 'text-gray-700 border-0 font-medium'
		case 'refunded':
			return 'text-gray-700 border-0 font-medium'
		default:
			return 'bg-gray-100 text-gray-700 border-gray-200'
	}
}

// Reusable Actions Component to avoid logic duplication
function BookingActions({
	isMobile,
	booking,
	onCancelBooking,
	onConfirmBooking,
	onMarkAsPaid,
	onRefundBooking,
	onRescheduleBooking
}: {
	isMobile: boolean
	booking: Booking
	onCancelBooking: (bookingId: string) => void
	onConfirmBooking: (bookingId: string) => void
	onMarkAsPaid: (bookingId: string) => void
	onRefundBooking: (bookingId: string) => void
	onRescheduleBooking: (bookingId: string) => void
}) {
	if (booking.status === 'canceled') return null

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					className="h-8 w-8 p-0 hover:bg-gray-100"
				>
					{isMobile ? (
						<MoreVertical className="h-4 w-4" />
					) : (
						<MoreHorizontal className="h-4 w-4" />
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="">
				{booking.payment_status === 'paid' && (
					<DropdownMenuItem
						onClick={() => onRefundBooking(booking.id)}
					>
						Reembolsar pago
					</DropdownMenuItem>
				)}
				{booking.status !== 'completed' && (
					<DropdownMenuItem
						onClick={() => onRescheduleBooking(booking.id)}
					>
						Reprogramar cita
					</DropdownMenuItem>
				)}
				{booking.payment_status !== 'paid' && (
					<DropdownMenuItem onClick={() => onMarkAsPaid(booking.id)}>
						Marcar cita como pagada
					</DropdownMenuItem>
				)}
				{booking.status === 'pending' && (
					<DropdownMenuItem
						onClick={() => onConfirmBooking(booking.id)}
					>
						Marcar cita como confirmada
					</DropdownMenuItem>
				)}
				{
					<DropdownMenuItem
						onClick={() => onCancelBooking(booking.id)}
					>
						Cancelar cita
					</DropdownMenuItem>
				}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

// Mobile Card Component
function BookingCard({
	booking,
	onCancelBooking,
	onConfirmBooking,
	onMarkAsPaid,
	onRefundBooking,
	onRescheduleBooking
}: {
	booking: Booking
	onCancelBooking: (bookingId: string) => void
	onConfirmBooking: (bookingId: string) => void
	onMarkAsPaid: (bookingId: string) => void
	onRefundBooking: (bookingId: string) => void
	onRescheduleBooking: (bookingId: string) => void
}) {
	return (
		<div className="bg-white border rounded-lg p-4 mb-3 hover:bg-gray-50/50 transition-colors">
			<div className="flex justify-between items-center">
				<div className="flex-1 min-w-0">
					{/* Name, Date, and Amount on same line */}
					<div className="flex items-center mb-2">
						<div className="text-sm font-medium text-gray-900 truncate">
							{booking.customerName}
						</div>
						<div className="text-sm text-gray-600 font-light flex-shrink-0 ml-2">
							{format(booking.bookingDate, 'dd MMM yyyy', {
								locale: es
							})}
						</div>
					</div>

					{/* Status badges on same line */}
					<div className="flex gap-2">
						<Badge
							variant="outline"
							className={`text-xs ${getStatusColor(booking.status)}`}
						>
							{getStatusLabel(booking.status)}
						</Badge>
						<Badge
							variant="outline"
							className={`text-xs ${getPaymentStatusColor(
								booking.payment_status
							)} border border-gray-200 rounded-full`}
						>
							{booking.payment_status === 'paid' ? (
								<Check className="h-3 w-3 mr-1 text-teal-500" />
							) : booking.payment_status === 'pending' ? (
								<Loader className="h-3 w-3 mr-1" />
							) : booking.payment_status === 'refunded' ? (
								<RefreshCcw className="h-3 w-3 mr-1 text-gray-900" />
							) : (
								<X className="h-3 w-3 mr-1 text-red-500" />
							)}
							{getPaymentStatusLabel(booking.payment_status)}
						</Badge>
					</div>
				</div>

				{/* Actions */}
				<div className="ml-3 flex-shrink-0">
					<BookingActions
						isMobile={true}
						booking={booking}
						onCancelBooking={onCancelBooking}
						onConfirmBooking={onConfirmBooking}
						onMarkAsPaid={onMarkAsPaid}
						onRefundBooking={onRefundBooking}
						onRescheduleBooking={onRescheduleBooking}
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
	onRescheduleBooking
}: BookingsTableProps) {
	const isMobile = window.innerWidth > 768
	if (loading) {
		return (
			<div className="flex justify-center items-center py-8">
				<Spinner size="sm" />
			</div>
		)
	}

	if (bookings.length === 0) {
		return (
			<div className="text-center py-8 text-gray-500">
				No hay citas programadas
			</div>
		)
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
					/>
				))}
			</div>

			{/* Desktop Table */}
			<div className="hidden md:block">
				<div className="bg-white rounded-lg overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow className=" border-b ">
								<TableHead className="font-medium w-[150px] md:w-[150px]">
									Paciente
								</TableHead>
								<TableHead className="hidden md:table-cell font-semibold w-[140px] text-center">
									Fecha
								</TableHead>
								<TableHead className="hidden font-semibold w-[100px] text-center">
									Hora
								</TableHead>
								<TableHead className="hidden sm:table-cell font-semibold w-[160px] text-center">
									Estado
								</TableHead>
								<TableHead className="hidden lg:table-cell font-semibold w-[120px] text-center">
									Pago
								</TableHead>
								<TableHead className="text-right font-semibold w-[120px]">
									Honorarios
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
													Todavía no hay citas
													programadas.
												</p>
											</div>
										</div>
									</TableCell>
								</TableRow>
							) : (
								bookings.map((booking) => (
									<TableRow
										key={booking.id}
										className="hover:bg-gray-50/50 transition-colors h-14"
									>
										{/* Client */}
										<TableCell className="py-2">
											<div className="font-medium">
												{booking.customerName}
											</div>
										</TableCell>

										{/* Date */}
										<TableCell className="hidden md:table-cell text-center py-2">
											<span className="font-light">
												{format(
													booking.bookingDate,
													'dd MMM yyyy',
													{ locale: es }
												)}
											</span>
										</TableCell>

										{/* Time */}
										<TableCell className="hidden text-center py-2">
											<span className="font-light">
												{format(
													booking.startTime ||
														booking.bookingDate,
													'HH:mm'
												)}
												h
											</span>
										</TableCell>

										{/* Booking Status */}
										<TableCell className="hidden sm:table-cell text-center py-2">
											<Badge
												variant="outline"
												className={getStatusColor(
													booking.status
												)}
											>
												{getStatusLabel(booking.status)}
											</Badge>
										</TableCell>

										{/* Payment Status */}
										<TableCell className="hidden lg:table-cell text-center py-2">
											<Badge
												variant="outline"
												className={getPaymentStatusColor(
													booking.payment_status
												)}
											>
												{booking.payment_status ===
												'paid' ? (
													<Check className="h-4 w-4 mr-2 text-teal-500" />
												) : booking.payment_status ===
												  'pending' ? (
													<Loader className="h-3 w-3 mr-2" />
												) : booking.payment_status ===
												  'refunded' ? (
													<RefreshCcw className="h-3 w-3 mr-2 text-gray-900" />
												) : (
													<X className="h-3 w-3 mr-2 text-red-500" />
												)}
												{getPaymentStatusLabel(
													booking.payment_status
												)}
											</Badge>
										</TableCell>

										{/* Amount */}
										<TableCell className="text-right font-light py-2">
											<span className="font-semibold">
												{booking.amount.toFixed(2)}{' '}
												{booking.currency || 'EUR'}
											</span>
										</TableCell>

										{/* Actions */}
										<TableCell className="text-right py-2">
											<BookingActions
												isMobile={isMobile}
												booking={booking}
												onCancelBooking={
													onCancelBooking
												}
												onConfirmBooking={
													onConfirmBooking
												}
												onMarkAsPaid={onMarkAsPaid}
												onRefundBooking={
													onRefundBooking
												}
												onRescheduleBooking={
													onRescheduleBooking
												}
											/>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>
		</div>
	)
}
