'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function PaymentSuccessPage() {
	const searchParams = useSearchParams()
	const bookingId = searchParams.get('booking_id')
	const [loading, setLoading] = useState(true)
	const [bookingDetails, setBookingDetails] = useState<any>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (bookingId) {
			// Fetch booking details for display
			const fetchBookingDetails = async () => {
				try {
					const response = await fetch(`/api/bookings/${bookingId}`)

					if (!response.ok) {
						throw new Error('Failed to fetch booking details')
					}
					console.log('HEREEEEE')
					const data = await response.json()
					console.log('DATA:', data)

					setBookingDetails(data)
				} catch (err) {
					setError('No se pudieron cargar los detalles de la cita')
				} finally {
					setLoading(false)
				}
			}

			fetchBookingDetails()
		} else {
			setError('Información de cita no encontrada')
			setLoading(false)
		}
	}, [bookingId])

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
					<p>Verificando pago...</p>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
				<div className="text-center">
					<h1 className="text-xl font-semibold mb-2">Error</h1>
					<p className="text-gray-600 mb-4">{error}</p>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
					<CardTitle className="text-2xl font-bold text-green-700">
						¡Pago confirmado!
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{bookingDetails && (
						<div className="space-y-3">
							<div className="text-center text-gray-600">
								Tu cita ha sido confirmada exitosamente
							</div>

							<div className="bg-gray-50 p-4 rounded-lg space-y-2">
								<div>
									<span className="font-medium">
										Paciente:
									</span>
									<span className="ml-2">
										{bookingDetails.clientName}
									</span>
								</div>
								<div>
									<span className="font-medium">
										Profesional:
									</span>
									<span className="ml-2">
										{bookingDetails.practitionerName}
									</span>
								</div>
								<div>
									<span className="font-medium">Fecha:</span>
									<span className="ml-2">
										{new Date(
											bookingDetails.consultationDate
										).toLocaleDateString('es-ES', {
											weekday: 'long',
											year: 'numeric',
											month: 'long',
											day: 'numeric',
											hour: '2-digit',
											minute: '2-digit'
										})}
									</span>
								</div>
								<div>
									<span className="font-medium">Monto:</span>
									<span className="ml-2">
										{bookingDetails.amount}€
									</span>
								</div>
							</div>

							<div className="text-center text-sm text-gray-500">
								Recibirás un email de confirmación próximamente
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
