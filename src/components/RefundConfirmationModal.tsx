'use client'

import { AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * RefundConfirmationModal Component
 *
 * A comprehensive confirmation dialog for processing booking refunds.
 * This modal provides:
 * - Clear warning about the irreversible nature of refunds
 * - Booking details display for context
 * - Optional reason input field
 * - Proper confirmation flow with cancel option
 *
 * @param isOpen - Controls modal visibility
 * @param onOpenChange - Callback when modal open state changes
 * @param onConfirm - Callback when refund is confirmed (receives optional reason)
 * @param bookingDetails - Booking information to display
 * @param isLoading - Shows loading state on confirm button
 */

interface BookingDetails {
	id: string
	customerName: string
	customerEmail: string
	amount: number
	currency: string
	date: string
}

interface RefundConfirmationModalProps {
	isOpen: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: (reason?: string) => void
	bookingDetails: BookingDetails
	isLoading?: boolean
}

export function RefundConfirmationModal({
	isOpen,
	onOpenChange,
	onConfirm,
	bookingDetails,
	isLoading = false
}: RefundConfirmationModalProps) {
	const [reason, setReason] = useState('')

	// Reset form when modal opens
	useEffect(() => {
		if (isOpen) {
			setReason('')
		}
	}, [isOpen, bookingDetails.id])

	// Handle escape key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isOpen) {
				handleCancel()
			}
		}

		if (isOpen) {
			document.addEventListener('keydown', handleEscape)
			document.body.style.overflow = 'hidden' // Prevent background scrolling
		}

		return () => {
			document.removeEventListener('keydown', handleEscape)
			document.body.style.overflow = 'unset' // Restore scrolling
		}
	}, [isOpen])

	const handleConfirm = () => {
		onConfirm(reason.trim() || undefined)
		setReason('')
		onOpenChange(false)
	}

	const handleCancel = () => {
		setReason('')
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
				className="relative w-full max-w-lg mx-4 bg-white rounded-lg shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="p-8">
					{/* Header */}
					<div className="flex items-center gap-5 mb-6">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
							<AlertTriangle className="h-5 w-5 text-gray-700" />
						</div>
						<div>
							<h2 className="text-lg font-semibold text-left">
								Confirmar Reembolso
							</h2>
							<p className="text-sm text-gray-600 text-left">
								¿Estás seguro? Esta acción no se puede deshacer
							</p>
						</div>
					</div>

					{/* Footer */}
					<div className="flex gap-3 mt-4">
						<Button
							onClick={handleCancel}
							disabled={isLoading}
							variant="outline"
							className="flex-1 hover:bg-gray-100/90"
						>
							Cancelar
						</Button>

						<Button
							onClick={handleConfirm}
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

/**
 * RefundConfirmationTrigger Component
 *
 * A wrapper component that provides a trigger button for the refund modal.
 * This is useful when you want the modal trigger and content in the same component.
 *
 * @param children - The trigger element (usually a button)
 * @param bookingDetails - Booking information to display in modal
 * @param onConfirm - Callback when refund is confirmed
 * @param isLoading - Shows loading state
 */

interface RefundConfirmationTriggerProps {
	children: React.ReactNode
	bookingDetails: BookingDetails
	onConfirm: (reason?: string) => void
	isLoading?: boolean
}

export function RefundConfirmationTrigger({
	children,
	bookingDetails,
	onConfirm,
	isLoading = false
}: RefundConfirmationTriggerProps) {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<>
			<div onClick={() => setIsOpen(true)}>{children}</div>
			<RefundConfirmationModal
				isOpen={isOpen}
				onOpenChange={setIsOpen}
				onConfirm={onConfirm}
				bookingDetails={bookingDetails}
				isLoading={isLoading}
			/>
		</>
	)
}
