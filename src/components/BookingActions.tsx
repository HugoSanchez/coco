'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import {
	MoreHorizontal,
	MoreVertical,
	RotateCcw,
	Calendar,
	Copy,
	Loader,
	Send,
	CreditCard,
	UserCheck,
	Ban
} from 'lucide-react'

export type BookingActionBooking = {
	id: string
	status: 'pending' | 'scheduled' | 'completed' | 'canceled'
	payment_status: 'not_applicable' | 'pending' | 'paid' | 'disputed' | 'canceled' | 'refunded'
	series_id?: string // V2: For recurring bookings
}

export function BookingActions({
	isMobile,
	booking,
	onCancelBooking,
	onConfirmBooking,
	onMarkAsPaid,
	onRefundBooking,
	onRescheduleBooking,
	onResendEmail,
	onCancelSeries,
	open,
	onOpenChange
}: {
	isMobile: boolean
	booking: BookingActionBooking
	onCancelBooking: (bookingId: string) => void
	onConfirmBooking: (bookingId: string) => void
	onMarkAsPaid: (bookingId: string) => void
	onRefundBooking: (bookingId: string) => void
	onRescheduleBooking: (bookingId: string) => void
	onResendEmail: (bookingId: string) => void
	onCancelSeries?: (seriesId: string) => void // V2: Optional cancel series handler
	open?: boolean // Controlled open state
	onOpenChange?: (open: boolean) => void // Callback when open state changes
}) {
	const { toast } = useToast()
	const [isResending, setIsResending] = useState(false)

	const handleResendEmail = async () => {
		setIsResending(true)
		try {
			await onResendEmail(booking.id)
			toast({
				title: 'Email reenviado',
				description: 'El email de confirmación ha sido enviado exitosamente.'
			})
		} catch (error) {
			toast({
				title: 'Error al reenviar email',
				description: 'No se pudo reenviar el email. Inténtalo de nuevo.',
				variant: 'destructive'
			})
		} finally {
			setIsResending(false)
		}
	}

	const handleCopyPaymentLink = async () => {
		const paymentUrl = `${window.location.origin}/api/payments/${booking.id}`
		try {
			await navigator.clipboard.writeText(paymentUrl)
			toast({ title: 'Link copiado', description: 'El link de pago ha sido copiado al portapapeles.' })
		} catch (error) {
			toast({
				title: 'Error al copiar',
				description: 'No se pudo copiar el link. Inténtalo de nuevo.',
				variant: 'destructive'
			})
		}
	}

	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
					{isMobile ? <MoreVertical className="h-4 w-4" /> : <MoreHorizontal className="h-4 w-4" />}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				side="right"
				align="start"
				sideOffset={4}
				className="space-y-1 p-2 border border-gray-300 rounded-lg"
			>
				{booking.payment_status === 'paid' && (
					<DropdownMenuItem onClick={() => onRefundBooking(booking.id)} className="flex items-center gap-3">
						<RotateCcw className="h-3 w-3" />
						Reembolsar pago
					</DropdownMenuItem>
				)}
				{booking.status !== 'completed' && booking.status !== 'canceled' && (
					<DropdownMenuItem
						onClick={() => onRescheduleBooking(booking.id)}
						className="flex items-center gap-3"
					>
						<Calendar className="h-3 w-3" />
						Reprogramar cita
					</DropdownMenuItem>
				)}
				{booking.payment_status === 'pending' && (
					<>
						<DropdownMenuItem onClick={handleCopyPaymentLink} className="flex items-center gap-3">
							<Copy className="h-3 w-3" />
							Copiar link de pago
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={handleResendEmail}
							disabled={isResending}
							className="flex items-center gap-3"
						>
							{isResending ? <Loader className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
							{isResending ? 'Reenviando...' : 'Reenviar email de pago'}
						</DropdownMenuItem>
					</>
				)}
				{booking.payment_status !== 'paid' && (
					<DropdownMenuItem onClick={() => onMarkAsPaid(booking.id)} className="flex items-center gap-3">
						<CreditCard className="h-3 w-3" />
						Marcar cita como pagada
					</DropdownMenuItem>
				)}
				{booking.status === 'pending' && (
					<DropdownMenuItem onClick={() => onConfirmBooking(booking.id)} className="flex items-center gap-3">
						<UserCheck className="h-3 w-3" />
						Marcar cita como confirmada
					</DropdownMenuItem>
				)}
				{booking.status !== 'canceled' && (
					<>
						<DropdownMenuItem
							onClick={() => onCancelBooking(booking.id)}
							className="flex items-center gap-3"
						>
							<Ban className="h-3 w-3" />
							Cancelar cita
						</DropdownMenuItem>
						{/* V2: Show cancel series option if this booking is part of a series */}
						{booking.series_id && onCancelSeries && (
							<DropdownMenuItem
								onClick={() => onCancelSeries(booking.series_id!)}
								className="flex items-center gap-3 text-red-800 focus:text-red-700"
							>
								<Ban className="h-3 w-3" />
								Cancelar evento recurrente
							</DropdownMenuItem>
						)}
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
