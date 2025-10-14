'use client'

import { CardHeader } from '@/components/ui/card'

export default function PaymentCancelledPage() {
	return (
		<>
			<div className="min-h-screen flex items-center justify-center lg:max-w-3xl mx-auto px-4">
				<div className="flex flex-col items-center justify-center">
					<CardHeader className="text-center gap-4">
						<h1 className="text-3xl font-black text-primary">Pago cancelado</h1>
						<p className="text-gray-600">
							No se ha procesado ningún pago. Puedes intentar nuevamente cuando estés listo.
						</p>
					</CardHeader>
					<p className="text-gray-600 text-sm text-normal">Puedes cerrar esta página.</p>
				</div>
			</div>
		</>
	)
}
