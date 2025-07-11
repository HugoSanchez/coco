'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * MarkAsPaidConfirmationModal Component
 *
 * A simple confirmation dialog for marking bookings as paid.
 * This modal provides:
 * - Clear confirmation about marking the booking as paid
 * - Booking details for context
 * - Simple confirm/cancel flow
 */

interface BookingDetails {
	id: string
	customerName: string
	customerEmail: string
	amount: number
	currency: string
	date: string
}

interface MarkAsPaidConfirmationModalProps {
	isOpen: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: () => void
	bookingDetails: BookingDetails
	isLoading?: boolean
}

export function MarkAsPaidConfirmationModal({
	isOpen,
	onOpenChange,
	onConfirm,
	bookingDetails,
	isLoading = false
}: MarkAsPaidConfirmationModalProps) {
	// Handle escape key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isOpen) {
				handleCancel()
			}
		}

		if (isOpen) {
			document.addEventListener('keydown', handleEscape)
			document.body.style.overflow = 'hidden'
		}

		return () => {
			document.removeEventListener('keydown', handleEscape)
			document.body.style.overflow = 'unset'
		}
	}, [isOpen])

	const handleConfirm = () => {
		onConfirm()
		onOpenChange(false)
	}

	const handleCancel = () => {
		onOpenChange(false)
	}

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			handleCancel()
		}
	}

	if (!isOpen) return null

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onClick={handleBackdropClick}
		>
			<div
				className="relative w-full max-w-md mx-4 bg-white rounded-lg shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="p-6">
					{/* Header */}
					<div className="flex items-center gap-4 mb-4">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100">
							<svg
								className="h-5 w-5 text-teal-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M5 13l4 4L19 7"
								/>
							</svg>
						</div>
						<div>
							<h2 className="text-lg font-semibold text-left">
								Marcar como Pagada
							</h2>
							<p className="text-sm text-gray-600 text-left">
								¿Confirmas que has recibido el pago?
							</p>
						</div>
					</div>

					{/* Footer */}
					<div className="flex gap-3 mt-8">
						<Button
							onClick={handleCancel}
							disabled={isLoading}
							variant="outline"
							className="flex-1"
						>
							Cancelar
						</Button>

						<Button
							onClick={handleConfirm}
							disabled={isLoading}
							className="flex-1 bg-teal-500 hover:bg-teal-600"
						>
							{isLoading ? 'Procesando...' : 'Confirmar'}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
