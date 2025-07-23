'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * StripeConfigurationModal Component
 *
 * A simple confirmation dialog for when users need to complete Stripe onboarding
 * before creating bookings. This modal provides:
 * - Clear warning about Stripe configuration requirement
 * - Direct link to configure Stripe payments
 * - Simple configure/cancel flow
 */

interface StripeConfigurationModalProps {
	isOpen: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: () => void
	isLoading?: boolean
}

export function StripeConfigurationModal({
	isOpen,
	onOpenChange,
	onConfirm,
	isLoading = false
}: StripeConfigurationModalProps) {
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
					<div className="flex items-start gap-4 mb-4">
						<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
							<svg
								className="h-5 w-5 text-gray-700"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
								/>
							</svg>
						</div>
						<div className="min-w-0 flex-1">
							<h2 className="text-lg font-semibold text-left">
								Configuración de pagos pendiente
							</h2>
							<p className="text-sm text-gray-600 text-left mt-1">
								Necesitas completar la configuración de Stripe
								antes de crear citas.
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
							{isLoading ? 'Redirigiendo...' : 'Configurar ahora'}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
