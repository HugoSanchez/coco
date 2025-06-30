'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'
import Link from 'next/link'

export default function PaymentCancelledPage() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<div className="flex justify-center mb-4">
						<XCircle className="h-16 w-16 text-orange-500" />
					</div>
					<CardTitle className="text-2xl text-orange-700">
						Pago Cancelado
					</CardTitle>
				</CardHeader>
				<CardContent className="text-center space-y-4">
					<p className="text-gray-600">
						No se ha procesado ningún pago. Puedes intentar
						nuevamente cuando estés listo.
					</p>

					<div className="space-y-2 pt-4">
						<p className="text-sm text-gray-500">
							Si tienes problemas con el pago, contacta con tu
							profesional.
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
