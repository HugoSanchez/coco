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
		title: 'Parece que ha habido un error',
		message:
			'No se pudo encontrar la cita. Puede que el enlace sea incorrecto o haya expirado. Si tienes alguna duda ponte en contacto con tu profesional.',
		icon: XCircle,
		color: 'text-gray-700'
	},
	booking_canceled: {
		title: 'Esta cita ha sido cancelada',
		message:
			'Esta reserva ha sido cancelada y por lo tanto ya no puede pagarse. Si tienes alguna duda ponte en contacto con tu profesional.',
		icon: XCircle,
		color: 'text-gray-700'
	},
	missing_data: {
		title: 'Parece que ha habido un error',
		message:
			'Faltan algunos datos necesarios para procesar el pago. Por favor, vuelve a intentarlo en unos minutos o contacta con tu profesional.',
		icon: AlertTriangle,
		color: 'text-gray-700'
	},
	checkout_creation_failed: {
		title: '¡Ups! ha habido un error',
		message:
			'Por favor, inténtalo de nuevo en unos minutos. En el caso de que el problema persista, ponte en contacto con tu profesional.',
		icon: XCircle,
		color: 'text-gray-700'
	},
	server_error: {
		title: '¡Ups! ha habido un error',
		message:
			'Ocurrió un error inesperado. Por favor, inténtalo de nuevo más tarde.',
		icon: XCircle,
		color: 'text-gray-900'
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

				<p className="text-gray-600 text-sm text-normal">
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
