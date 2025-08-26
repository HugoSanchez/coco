'use client'

import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface CancelConfirmationModalProps {
	isOpen: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: () => void
	isLoading?: boolean
	isPaid?: boolean
	title?: string
	description?: string
}

export function CancelConfirmationModal({
	isOpen,
	onOpenChange,
	onConfirm,
	isLoading = false,
	isPaid = false,
	title,
	description
}: CancelConfirmationModalProps) {
	// Compute defaults based on payment status when custom text is not provided
	const computedTitle =
		title ??
		(isPaid ? 'Confirmar cancelación y reembolso' : 'Confirmar cancelación')
	const computedDescription =
		description ??
		(isPaid
			? 'Al cancelar una cita confirmada, también se procederá a reembolsar al paciente. Ninguna de estas acciones se puede deshacer.'
			: 'Esta acción no se puede deshacer.')

	// Handle escape key + scroll lock
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isOpen) {
				onOpenChange(false)
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
	}, [isOpen, onOpenChange])

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onOpenChange(false)
		}
	}

	if (!isOpen) return null

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onClick={handleBackdropClick}
		>
			<div
				className="relative w-full max-w-lg mx-4 bg-white rounded-lg shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="p-8">
					<div className="flex items-center gap-5 mb-6">
						<div className="flex h-12 w-12 aspect-square flex-shrink-0 items-center justify-center rounded-full bg-gray-200">
							<AlertTriangle className="h-5 w-5 text-gray-700" />
						</div>
						<div>
							<h2 className="text-lg font-semibold text-left">
								{computedTitle}
							</h2>
							<p className="text-sm text-gray-600 text-left">
								{computedDescription}
							</p>
						</div>
					</div>

					<div className="flex gap-3 mt-4">
						<Button
							onClick={() => onOpenChange(false)}
							disabled={isLoading}
							variant="outline"
							className="flex-1 hover:bg-gray-100/90"
						>
							Cancelar
						</Button>
						<Button
							onClick={onConfirm}
							disabled={isLoading}
							className="flex-1 bg-teal-400 hover:bg-teal-400/90 font-normal focus:ring-teal-4"
						>
							{isLoading ? 'Procesando...' : 'Confirmar'}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
