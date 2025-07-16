'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import confetti from 'canvas-confetti'
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription
} from '@/components/ui/card'
import { Check } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

// Force dynamic rendering since this page uses useSearchParams
export const dynamic = 'force-dynamic'

function BookingConfirmationContent() {
	const searchParams = useSearchParams()
	const bookingId = searchParams.get('booking_id')
	const [loading, setLoading] = useState(true)
	const [bookingDetails, setBookingDetails] = useState<any>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (bookingId) fetchBookingDetails()
	}, [bookingId])

	const fetchBookingDetails = async () => {
		try {
			const response = await fetch(`/api/bookings/${bookingId}`)
			const data = await response.json()
			setBookingDetails(data)
			setLoading(false)
			confetti({ particleCount: 20 })
		} catch (err) {
			setError('No se pudieron cargar los detalles de la cita')
			setLoading(false)
		}
	}

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center flex items-center gap-4">
					<Spinner color="dark" size="sm" />
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<h1 className="text-xl font-semibold mb-2">Error</h1>
					<p className="text-gray-600 mb-4">{error}</p>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen flex items-center lg:max-w-3xl mx-auto px-4">
			<div className="flex flex-col items-center justify-center mb-20">
				<CardHeader className="text-center gap-4">
					<Check className="h-12 w-12 text-accent mx-auto" />
					<h1 className="text-4xl font-black text-primary">
						¡Cita confirmada!
					</h1>

					<p className="text-lg text-gray-600">
						Enhorabuena, tu cita con{' '}
						{bookingDetails.practitionerName} para el{' '}
						<span className="font-bold text-primary">
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
							{'h '}
						</span>
						está confirmada. En breves recibirás un email con los
						detalles.
					</p>
				</CardHeader>
				<p className="text-gray-600 text-sm text-normal">
					Puedes cerrar esta página.
				</p>
			</div>
		</div>
	)
}

export default function BookingConfirmationPage() {
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
			<BookingConfirmationContent />
		</Suspense>
	)
}
