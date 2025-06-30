'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function PaymentSuccessPage() {
	const searchParams = useSearchParams()
	const sessionId = searchParams.get('session_id')
	const [loading, setLoading] = useState(true)
	const [paymentDetails, setPaymentDetails] = useState<any>(null)

	useEffect(() => {
		if (sessionId) {
			// In a real implementation, you'd verify the session with Stripe
			// For now, we'll just show a success message
			setLoading(false)
			setPaymentDetails({
				sessionId,
				message: 'Payment completed successfully!'
			})
		} else {
			setLoading(false)
		}
	}, [sessionId])

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

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<div className="flex justify-center mb-4">
						<CheckCircle className="h-16 w-16 text-green-500" />
					</div>
					<CardTitle className="text-2xl text-green-700">
						¡Pago Exitoso!
					</CardTitle>
				</CardHeader>
				<CardContent className="text-center space-y-4">
					<p className="text-gray-600">
						Tu pago ha sido procesado correctamente. Recibirás una
						confirmación por email en breve.
					</p>

					{sessionId && (
						<div className="bg-gray-100 p-3 rounded text-sm">
							<p className="font-medium">ID de Transacción:</p>
							<p className="text-gray-600 break-all">
								{sessionId}
							</p>
						</div>
					)}

					<div className="space-y-2 pt-4">
						<p className="text-sm text-gray-500">
							¿Necesitas ayuda? Contacta con tu profesional.
						</p>

						<Button asChild className="w-full">
							<Link href="/">Volver al Inicio</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
