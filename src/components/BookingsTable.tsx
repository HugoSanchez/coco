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
	billingStatus: 'pending' | 'billed'
	paymentStatus: 'pending' | 'paid'
	amount: number
}

interface BookingsTableProps {
	bookings: Booking[]
	loading?: boolean
	onStatusChange: (
		bookingId: string,
		type: 'billing' | 'payment',
		status: string
	) => void
	onCancelBooking: (bookingId: string) => void
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
							<TableHead className="font-medium">
								Paciente
							</TableHead>
							<TableHead className="hidden md:table-cell font-semibold">
								Fecha
							</TableHead>
							<TableHead className="hidden sm:table-cell font-semibold">
								Factura
							</TableHead>
							<TableHead className="hidden sm:table-cell font-semibold">
								Pago
							</TableHead>
							<TableHead className="text-right font-semibold">
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
									className="hover:bg-gray-50/50 transition-colors"
								>
									<TableCell>
										<div className="font-medium">
											{booking.customerName}
										</div>
										<div className="hidden text-sm text-muted-foreground md:inline">
											{booking.customerEmail}
										</div>
									</TableCell>

									<TableCell className="hidden md:table-cell">
										<div className="flex items-center gap-2">
											<span className="font-light">
												{format(
													booking.bookingDate,
													'dd MMM yyyy',
													{ locale: es }
												)}
											</span>
										</div>
									</TableCell>

									<TableCell className="hidden sm:table-cell">
										<Badge
											variant="outline"
											className={`cursor-pointer transition-all duration-200 py-1 rounded-md text-gray-700 font-light border-gray-200 ${
												booking.billingStatus ===
												'billed'
													? ''
													: 'border-gray-200 text-gray-700'
											}`}
											onClick={() => {
												const newStatus =
													booking.billingStatus ===
													'pending'
														? 'billed'
														: 'pending'
												onStatusChange(
													booking.id,
													'billing',
													newStatus
												)
											}}
										>
											{booking.billingStatus !==
											'billed' ? null : (
												<CircleCheck className="h-4 w-4 text-white fill-teal-500 mr-2" />
											)}
											{booking.billingStatus === 'billed'
												? 'Enviada'
												: 'Por enviar'}
										</Badge>
									</TableCell>

									<TableCell className="hidden sm:table-cell">
										<Badge
											variant="outline"
											className={`cursor-pointer transition-all duration-200 py-1 rounded-md text-gray-700 font-light border-gray-200 ${
												booking.paymentStatus === 'paid'
													? 'bg-teal-100 text-teal-700'
													: 'border-gray-200 text-gray-700'
											}`}
											onClick={() => {
												const newStatus =
													booking.paymentStatus ===
													'pending'
														? 'paid'
														: 'pending'
												onStatusChange(
													booking.id,
													'payment',
													newStatus
												)
											}}
										>
											{booking.paymentStatus !==
											'paid' ? (
												<Loader className="h-3 w-3 text-teal-500 mr-2" />
											) : (
												<CircleCheck className="h-4 w-4 text-white fill-teal-500 mr-2" />
											)}
											{booking.paymentStatus === 'paid'
												? 'Realizado'
												: 'Pendiente'}
										</Badge>
									</TableCell>

									<TableCell className="text-right font-light">
										€{booking.amount.toFixed(2)}
									</TableCell>

									<TableCell className="text-right">
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
