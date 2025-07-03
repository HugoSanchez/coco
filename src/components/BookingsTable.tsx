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
import {
	MoreHorizontal,
	Calendar,
	X,
	CircleCheck,
	Search,
	Loader,
	CreditCard
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TestPaymentButton } from './TestPaymentButton'

export interface Booking {
	id: string
	customerName: string
	customerEmail: string
	bookingDate: Date
	startTime?: Date // Optional for backward compatibility
	status: 'pending' | 'scheduled' | 'completed' | 'cancelled'
	billing_status: 'not_generated' | 'pending' | 'sent' | 'canceled'
	payment_status:
		| 'not_applicable'
		| 'pending'
		| 'paid'
		| 'disputed'
		| 'canceled'
	amount: number
	currency?: string
}

interface BookingsTableProps {
	bookings: Booking[]
	loading?: boolean
	onStatusChange: (bookingId: string, status: string) => void
	onCancelBooking: (bookingId: string) => void
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
		case 'cancelled':
			return 'Cancelada'
		default:
			return status
	}
}

// Status colors
const getStatusColor = (status: string) => {
	switch (status) {
		case 'pending':
			return 'bg-gray-100 text-gray-700 border-gray-200 font-normal'
		case 'scheduled':
			return 'bg-teal-100 text-teal-700 border-teal-200'
		case 'completed':
			return 'bg-green-100 text-green-700 border-green-200'
		case 'cancelled':
			return 'bg-gray-100 text-gray-700 border-gray-200'
		default:
			return 'bg-gray-100 text-gray-700 border-gray-200'
	}
}

// Billing status labels in Spanish
const getBillingStatusLabel = (status: string) => {
	switch (status) {
		case 'not_generated':
			return 'No generada'
		case 'pending':
			return 'Pendiente'
		case 'sent':
			return 'Enviada'
		case 'canceled':
			return 'Cancelada'
		default:
			return status
	}
}

// Billing status colors
const getBillingStatusColor = (status: string) => {
	switch (status) {
		case 'not_generated':
			return 'bg-gray-100 text-gray-600 border-gray-200'
		case 'pending':
			return 'bg-yellow-100 text-yellow-700 border-yellow-200'
		case 'sent':
			return 'bg-blue-100 text-blue-700 border-blue-200'
		case 'canceled':
			return 'bg-gray-100 text-gray-700 border-gray-200'
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
			return 'Pagado'
		case 'disputed':
			return 'Disputado'
		case 'canceled':
			return 'Cancelado'
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
			return 'bg-yellow-100 text-yellow-700 border-yellow-200'
		case 'paid':
			return 'bg-green-100 text-green-700 border-green-200'
		case 'disputed':
			return 'bg-red-100 text-red-700 border-red-200'
		case 'canceled':
			return 'bg-gray-100 text-gray-700 border-gray-200'
		default:
			return 'bg-gray-100 text-gray-700 border-gray-200'
	}
}

export function BookingsTable({
	bookings,
	loading = false,
	onStatusChange,
	onCancelBooking
}: BookingsTableProps) {
	if (loading) {
		return (
			<div className="flex items-center justify-center py-8">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
			</div>
		)
	}

	return (
		<div className="space-y-4 relative">
			{/* Table */}
			<div className="bg-white rounded-lg overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow className=" border-b ">
							<TableHead className="font-medium w-[150px]">
								Paciente
							</TableHead>
							<TableHead className="hidden md:table-cell font-semibold w-[140px] text-center">
								Fecha
							</TableHead>
							<TableHead className="hidden sm:table-cell font-semibold w-[100px] text-center">
								Hora
							</TableHead>
							<TableHead className="hidden sm:table-cell font-semibold w-[160px] text-center">
								Estado
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
								<TableCell
									colSpan={6}
									className="text-center py-12"
								>
									<div className="text-gray-400">
										<Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
										<p className="text-sm">
											No bookings found
										</p>
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
									<TableCell className="hidden sm:table-cell text-center py-2">
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

									{/* Amount */}
									<TableCell className="text-right font-light py-2">
										{booking.currency || 'EUR'}{' '}
										{booking.amount.toFixed(2)}
									</TableCell>

									{/* Actions */}
									<TableCell className="text-right py-2">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													className="h-8 w-8 p-0 hover:bg-gray-100"
												>
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem asChild>
													<div className="flex items-center w-full px-2 py-1.5">
														<CreditCard className="mr-2 h-4 w-4" />
														<TestPaymentButton
															bookingId={
																booking.id
															}
														/>
													</div>
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() =>
														onCancelBooking(
															booking.id
														)
													}
													className=""
												>
													<X className="mr-2 h-4 w-4" />
													Cancelar
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	)
}
