'use client'

import { Badge } from '@/components/ui/badge'
import { Check, Clock, Loader, RefreshCcw, X } from 'lucide-react'

type Size = 'sm' | 'lg'

const sizeClasses: Record<Size, string> = {
	sm: 'text-xs py-1 px-2',
	lg: 'text-sm py-2 px-4'
}

export function StatusBadge({
	status,
	size = 'sm'
}: {
	status: 'pending' | 'scheduled' | 'completed' | 'canceled'
	size?: Size
}) {
	switch (status) {
		case 'pending':
			return (
				<Badge
					variant="outline"
					className={`${sizeClasses[size]} bg-white text-gray-700 border-gray-200 font-normal rounded-full`}
				>
					Por confirmar
				</Badge>
			)
		case 'scheduled':
		case 'completed':
			return (
				<Badge
					variant="outline"
					className={`${sizeClasses[size]} px-3 bg-teal-100 border-0 text-teal-800 font-medium`}
				>
					Confirmada
				</Badge>
			)
		case 'canceled':
			return (
				<Badge
					variant="outline"
					className={`${sizeClasses[size]} px-3 bg-red-50 text-red-800 border-0 font-medium`}
				>
					Cancelada
				</Badge>
			)
		default:
			return (
				<Badge variant="outline" className={`${sizeClasses[size]} bg-gray-100 text-gray-700 border-gray-200`}>
					{status}
				</Badge>
			)
	}
}

export type DisplayPaymentStatus = 'scheduled' | 'pending' | 'paid' | 'disputed' | 'canceled' | 'refunded' | 'na'

export function PaymentBadge({ status, size = 'sm' }: { status: DisplayPaymentStatus; size?: Size }) {
	const base = sizeClasses[size]
	switch (status) {
		case 'scheduled':
			return (
				<Badge
					variant="outline"
					className={`${base} bg-white text-gray-700 border-gray-300 border-dashed font-normal rounded-full`}
				>
					<Clock className="h-3 w-3 mr-2 text-gray-500" />
					Programado
				</Badge>
			)
		case 'pending':
			return (
				<Badge
					variant="outline"
					className={`${base} px-3 text-gray-700 border-gray-300 font-normal rounded-full`}
				>
					<Loader className="h-3 w-3 mr-2 text-gray-600" />
					Pendiente
				</Badge>
			)
		case 'paid':
			return (
				<Badge
					variant="outline"
					className={`${base} px-3 border-teal-300 text-gray-700 font-normal rounded-full`}
				>
					<Check className="h-3 w-3 mr-2 text-teal-500" />
					Pagada
				</Badge>
			)
		case 'refunded':
			return (
				<Badge
					variant="outline"
					className={`${base} text-gray-700 border-rose-300 border-dashed font-normal rounded-full`}
				>
					<RefreshCcw className="h-3 w-3 mr-2 text-rose-700" />
					Reembolsado
				</Badge>
			)
		case 'canceled':
			return (
				<Badge variant="outline" className={`${base} text-gray-700 border-rose-300 font-normal rounded-full`}>
					<X className="h-3 w-3 mr-2 text-rose-700" />
					Cancelado
				</Badge>
			)
		case 'disputed':
			return (
				<Badge variant="outline" className={`${base} bg-red-100 text-red-700 border-red-200 rounded-full`}>
					<RefreshCcw className="h-3 w-3 mr-2" />
					Disputado
				</Badge>
			)
		case 'na':
		default:
			return (
				<Badge variant="outline" className={`${base} bg-gray-100 text-gray-500 border-gray-200 rounded-full`}>
					N/A
				</Badge>
			)
	}
}
