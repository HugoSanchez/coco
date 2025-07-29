'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

// Force dynamic rendering since this page uses useSearchParams
export const dynamic = 'force-dynamic'

const errorMessages = {
	booking_not_found: {
		title: 'Reserva no encontrada',
		message:
			'No se pudo encontrar la reserva solicitada. Puede que el enlace sea incorrecto o haya expirado.',
		icon: XCircle,
		color: 'text-red-500'
	},
	booking_canceled: {
		title: 'Reserva cancelada',
		message: 'Esta reserva ha sido cancelada y ya no requiere pago.',
		icon: XCircle,
		color: 'text-red-500'
	},
	booking_completed: {
		title: 'Reserva completada',
		message:
			'Esta reserva ya ha sido completada y no requiere pago adicional.',
		icon: CheckCircle,
		color: 'text-green-500'
	},
	already_paid: {
		title: 'Ya pagado',
		message:
			'Esta reserva ya ha sido pagada. No se requiere pago adicional.',
		icon: CheckCircle,
		color: 'text-green-500'
	},
	no_payment_required: {
		title: 'Sin pago requerido',
		message: 'Esta reserva no requiere pago.',
		icon: CheckCircle,
		color: 'text-green-500'
	},
	missing_data: {
		title: 'Datos incompletos',
		message:
			'Faltan datos necesarios para procesar el pago. Por favor, contacta con tu profesional.',
		icon: AlertTriangle,
		color: 'text-yellow-500'
	},
	invalid_data: {
		title: 'Datos inválidos',
		message:
			'Los datos de la reserva son inválidos. Por favor, contacta con tu profesional.',
		icon: AlertTriangle,
		color: 'text-yellow-500'
	},
	checkout_creation_failed: {
		title: 'Error al crear pago',
		message:
			'No se pudo crear la sesión de pago. Por favor, inténtalo de nuevo más tarde.',
		icon: XCircle,
		color: 'text-red-500'
	},
	server_error: {
		title: 'Error del servidor',
		message:
			'Ocurrió un error inesperado. Por favor, inténtalo de nuevo más tarde.',
		icon: XCircle,
		color: 'text-red-500'
	}
}

function PaymentErrorContent() {
	const searchParams = useSearchParams()
	const reason =
		(searchParams.get('reason') as keyof typeof errorMessages) ||
		'server_error'

	const errorInfo = errorMessages[reason] || errorMessages.server_error
	const IconComponent = errorInfo.icon

	return (
		<div className="min-h-screen flex items-center lg:max-w-3xl mx-auto px-4">
			<div className="flex flex-col items-center justify-center mb-20">
				<CardHeader className="text-center gap-4">
					<h1 className="text-4xl font-black text-primary">
						{errorInfo.title}
					</h1>

					<p className="text-lg text-gray-600">{errorInfo.message}</p>
				</CardHeader>

				<p className="text-gray-600 text-sm text-normal mt-6">
					Puedes cerrar esta página.
				</p>
			</div>
		</div>
	)
}

export default function PaymentErrorPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center">
					<div className="text-center flex items-center gap-4">
						<Spinner color="dark" size="sm" />
					</div>
				</div>
			}
		>
			<PaymentErrorContent />
		</Suspense>
	)
}
