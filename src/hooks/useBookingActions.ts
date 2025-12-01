/**
 * useBookingActions Hook
 *
 * This hook provides all booking action handlers that can be used across different pages
 * (Dashboard, Calendar, etc.). It encapsulates the logic for:
 * - Canceling bookings
 * - Confirming bookings
 * - Marking bookings as paid
 * - Processing refunds
 * - Resending payment emails
 * - Canceling recurring booking series
 *
 * The hook accepts callbacks for state updates, allowing each page to manage its own
 * state while sharing the same action logic.
 *
 * @example
 * ```tsx
 * const { cancelBooking, confirmBooking, markAsPaid } = useBookingActions({
 *   onBookingUpdated: (bookingId, updates) => {
 *     // Update your local bookings state
 *   },
 *   onStatsRefresh: () => {
 *     // Refresh your dashboard stats
 *   }
 * })
 * ```
 */

import { useToast } from '@/components/ui/use-toast'

/**
 * Callback function type for updating a single booking in local state
 * @param bookingId - The ID of the booking to update
 * @param updates - Partial booking object with fields to update
 */
type BookingUpdateCallback = (bookingId: string, updates: Partial<any>) => void

/**
 * Callback function type for removing bookings from local state
 * @param predicate - Function that returns true for bookings to remove
 */
type BookingRemoveCallback = (predicate: (booking: any) => boolean) => void

/**
 * Configuration options for the useBookingActions hook
 */
interface UseBookingActionsOptions {
	/**
	 * Callback invoked when a booking needs to be updated in local state.
	 * This is called after successful API operations to keep UI in sync.
	 *
	 * @example
	 * onBookingUpdated: (bookingId, { status: 'canceled', payment_status: 'refunded' })
	 */
	onBookingUpdated?: BookingUpdateCallback

	/**
	 * Callback invoked when bookings need to be removed from local state.
	 * Used for series cancellations where multiple bookings are deleted.
	 *
	 * @example
	 * onBookingsRemoved: (predicate) => {
	 *   setBookings(prev => prev.filter(predicate))
	 * }
	 */
	onBookingsRemoved?: BookingRemoveCallback

	/**
	 * Optional callback to refresh dashboard statistics after major state changes.
	 * Called after successful cancel, confirm, mark as paid, refund, or series cancel operations.
	 */
	onStatsRefresh?: () => void
}

interface CancelBookingOptions {
	/**
	 * Whether a cancellation email should be sent when the booking is not paid.
	 * Defaults to false, and paid bookings always send their refund notification.
	 */
	sendEmail?: boolean
}

/**
 * Return type for useBookingActions hook
 */
interface UseBookingActionsReturn {
	/**
	 * Cancels a booking and optionally processes a refund if payment was made.
	 * Updates booking status to 'canceled' and payment status accordingly.
	 *
	 * Steps:
	 * 1. Show loading toast
	 * 2. Call cancellation API endpoint
	 * 3. Update local booking state (status: 'canceled', payment_status updated if refunded)
	 * 4. Show success toast
	 * 5. Refresh stats if callback provided
	 *
	 * @param bookingId - The ID of the booking to cancel
	 * @param options - Additional cancellation behavior (email preference)
	 */
	cancelBooking: (bookingId: string, options?: CancelBookingOptions) => Promise<void>

	/**
	 * Confirms a pending booking, sending calendar invite to patient.
	 * Updates booking status from 'pending' to 'scheduled'.
	 *
	 * Steps:
	 * 1. Show loading toast
	 * 2. Call confirmation API endpoint
	 * 3. Update local booking state (status: 'scheduled')
	 * 4. Show success toast
	 * 5. Refresh stats if callback provided
	 *
	 * @param bookingId - The ID of the booking to confirm
	 */
	confirmBooking: (bookingId: string) => Promise<void>

	/**
	 * Marks a booking as manually paid (for offline payments or manual reconciliation).
	 * Updates payment_status to 'paid'.
	 *
	 * Steps:
	 * 1. Show loading toast
	 * 2. Call mark-as-paid API endpoint
	 * 3. Update local booking state (payment_status: 'paid')
	 * 4. Show success toast
	 * 5. Refresh stats if callback provided
	 *
	 * @param bookingId - The ID of the booking to mark as paid
	 */
	markAsPaid: (bookingId: string) => Promise<void>

	/**
	 * Processes a refund for a paid booking through Stripe.
	 * Updates payment_status to 'refunded'.
	 *
	 * Steps:
	 * 1. Show loading toast
	 * 2. Call refund API endpoint with optional reason
	 * 3. Update local booking state (payment_status: 'refunded')
	 * 4. Show success toast
	 * 5. Refresh stats if callback provided
	 *
	 * @param bookingId - The ID of the booking to refund
	 * @param reason - Optional reason for the refund
	 */
	processRefund: (bookingId: string, reason?: string) => Promise<void>

	/**
	 * Resends the payment email to the patient for a booking.
	 * Does not update booking state, only sends email.
	 *
	 * Steps:
	 * 1. Show loading toast
	 * 2. Call resend-email API endpoint
	 * 3. Show success toast
	 *
	 * @param bookingId - The ID of the booking to resend email for
	 */
	resendEmail: (bookingId: string) => Promise<void>

	/**
	 * Cancels an entire recurring booking series (all future bookings).
	 * Removes all future bookings from the series from local state.
	 *
	 * Steps:
	 * 1. Show loading toast
	 * 2. Call series cancellation API endpoint
	 * 3. Remove all bookings with matching series_id from local state
	 * 4. Show success toast
	 * 5. Refresh stats if callback provided
	 *
	 * @param seriesId - The ID of the booking series to cancel
	 */
	cancelSeries: (seriesId: string) => Promise<void>
}

/**
 * Custom hook that provides booking action handlers
 *
 * @param options - Configuration options for callbacks
 * @returns Object containing all booking action handlers
 */
export function useBookingActions(
	options: UseBookingActionsOptions = {}
): UseBookingActionsReturn {
	const { toast } = useToast()
	const { onBookingUpdated, onBookingsRemoved, onStatsRefresh } = options

	/**
	 * Cancels a booking
	 *
	 * Handles the complete cancellation flow including:
	 * - API call to cancel endpoint
	 * - State updates for booking status and payment status
	 * - Handling refunds if applicable
	 */
	const cancelBooking = async (bookingId: string, options?: CancelBookingOptions): Promise<void> => {
		try {
			// Step 1: Show immediate feedback to user
			toast({
				title: 'Cancelando cita...',
				description: 'Procesando la cancelación de la cita.',
				variant: 'default',
				color: 'loading'
			})

			// Step 2: Call cancellation API endpoint
			const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					sendEmail: options?.sendEmail ?? false
				})
			})

			// Step 3: Handle API errors
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to cancel booking')
			}

			const result = await response.json()

			// Step 4: Update local state with cancellation result
			// The server response indicates if a refund was processed
			const updates: Partial<any> = {
				status: 'canceled' as const
			}

			// If server indicates a refund occurred/will occur, update payment status
			if (result?.willRefund) {
				updates.payment_status = 'refunded' as const
			} else {
				// Otherwise, mark payment as canceled if it was pending
				updates.payment_status = 'canceled' as const
			}

			// Step 5: Notify parent component to update its state
			onBookingUpdated?.(bookingId, updates)

			// Step 6: Show success message
			toast({
				title: 'Cita cancelada',
				description: 'La cita ha sido cancelada correctamente.',
				variant: 'default',
				color: 'success'
			})

			// Step 7: Refresh dashboard statistics if callback provided
			onStatsRefresh?.()
		} catch (error) {
			// Handle errors with user-friendly message
			toast({
				title: 'Error',
				description: 'Failed to cancel booking. Please try again.',
				variant: 'destructive'
			})
			// Re-throw to allow caller to handle if needed
			throw error
		}
	}

	/**
	 * Confirms a pending booking
	 *
	 * Sends calendar invite to patient and updates booking status to 'scheduled'
	 */
	const confirmBooking = async (bookingId: string): Promise<void> => {
		try {
			// Step 1: Show immediate feedback
			toast({
				title: 'Confirmando cita...',
				description: 'Procesando la confirmación de la cita.',
				variant: 'default',
				color: 'loading'
			})

			// Step 2: Call confirmation API endpoint
			const response = await fetch(`/api/bookings/${bookingId}/confirm`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			})

			// Step 3: Handle API errors
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to confirm booking')
			}

			// Step 4: Update local state - booking is now confirmed
			onBookingUpdated?.(bookingId, {
				status: 'scheduled' as const
			})

			// Step 5: Show success message
			toast({
				title: 'Cita marcada como confirmada',
				description: 'Hemos enviado la invitación al paciente por correo.',
				variant: 'default',
				color: 'success'
			})

			// Step 6: Refresh stats
			onStatsRefresh?.()
		} catch (error) {
			// Handle errors
			toast({
				title: 'Error',
				description: 'Failed to confirm booking. Please try again.',
				variant: 'destructive'
			})
			throw error
		}
	}

	/**
	 * Marks a booking as manually paid
	 *
	 * Used for offline payments or manual reconciliation
	 */
	const markAsPaid = async (bookingId: string): Promise<void> => {
		try {
			// Step 1: Show immediate feedback
			toast({
				title: 'Marcando como pagada...',
				description: 'Procesando el registro de pago.',
				variant: 'default',
				color: 'loading'
			})

			// Step 2: Call mark-as-paid API endpoint
			const response = await fetch(`/api/bookings/${bookingId}/mark-paid`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			})

			// Step 3: Handle API errors
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to mark as paid')
			}

			// Step 4: Update local state - payment is now marked as paid
			onBookingUpdated?.(bookingId, {
				payment_status: 'paid' as const
			})

			// Step 5: Show success message
			toast({
				title: 'Pago registrado',
				description: 'La factura ha sido marcada como pagada.',
				variant: 'default',
				color: 'success'
			})

			// Step 6: Refresh stats
			onStatsRefresh?.()
		} catch (error) {
			// Handle errors
			toast({
				title: 'Error',
				description: 'Failed to mark as paid. Please try again.',
				variant: 'destructive'
			})
			throw error
		}
	}

	/**
	 * Processes a refund for a paid booking
	 *
	 * Initiates refund through Stripe and updates payment status
	 */
	const processRefund = async (bookingId: string, reason?: string): Promise<void> => {
		try {
			// Step 1: Show immediate feedback
			toast({
				title: 'Procesando reembolso...',
				description: 'Enviando solicitud de reembolso a Stripe.',
				variant: 'default',
				color: 'loading'
			})

			// Step 2: Call refund API endpoint with optional reason
			const response = await fetch(`/api/bookings/${bookingId}/refund`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ reason })
			})

			// Step 3: Handle API errors
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to process refund')
			}

			// Step 4: Update local state - payment is now refunded
			onBookingUpdated?.(bookingId, {
				payment_status: 'refunded' as const
			})

			// Step 5: Show success message
			toast({
				title: 'Reembolso procesado',
				description: 'El reembolso se ha procesado correctamente.',
				variant: 'default',
				color: 'success'
			})

			// Step 6: Refresh stats
			onStatsRefresh?.()
		} catch (error) {
			// Handle errors
			toast({
				title: 'Error',
				description: 'Failed to process refund. Please try again.',
				variant: 'destructive'
			})
			throw error
		}
	}

	/**
	 * Resends payment email to patient
	 *
	 * Does not modify booking state, only sends email
	 */
	const resendEmail = async (bookingId: string): Promise<void> => {
		try {
			// Step 1: Show immediate feedback
			toast({
				title: 'Reenviando email...',
				description: 'Enviando email de confirmación con nuevo enlace de pago.',
				variant: 'default',
				color: 'loading'
			})

			// Step 2: Call resend-email API endpoint
			const response = await fetch(`/api/bookings/${bookingId}/resend-email`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			})

			// Step 3: Handle API errors
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to resend email')
			}

			// Step 4: Show success message (no state update needed)
			toast({
				title: 'Email reenviado',
				description: 'El email de pago ha sido enviado correctamente.',
				variant: 'default',
				color: 'success'
			})
		} catch (error) {
			// Handle errors
			console.error('Error resending email:', error)
			toast({
				title: 'Error al reenviar email',
				description:
					error instanceof Error ? error.message : 'No se pudo reenviar el email. Inténtalo de nuevo.',
				variant: 'destructive'
			})
			throw error
		}
	}

	/**
	 * Cancels an entire recurring booking series
	 *
	 * Removes all future bookings from the series
	 */
	const cancelSeries = async (seriesId: string): Promise<void> => {
		try {
			// Step 1: Show immediate feedback
			toast({
				title: 'Cancelando serie...',
				description: 'Procesando la cancelación de la serie recurrente.',
				variant: 'default',
				color: 'loading'
			})

			// Step 2: Call series cancellation API endpoint
			const response = await fetch('/api/booking-series/cancel', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					series_id: seriesId,
					cancel_future: true, // Cancel all future bookings
					delete_future: true // Delete eligible future bookings (no financial artifacts)
				})
			})

			// Step 3: Handle API errors
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to cancel series')
			}

			// Step 4: Remove all bookings from this series from local state
			onBookingsRemoved?.((booking) => booking.series_id === seriesId)

			// Step 5: Show success message
			toast({
				title: 'Evento recurrente cancelado',
				description: `Se han cancelado todas las citas futuras de este evento.`,
				variant: 'default',
				color: 'success'
			})

			// Step 6: Refresh stats
			onStatsRefresh?.()
		} catch (error) {
			// Handle errors
			console.error('Error canceling series:', error)
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Failed to cancel series. Please try again.',
				variant: 'destructive'
			})
			throw error
		}
	}

	// Return all action handlers
	return {
		cancelBooking,
		confirmBooking,
		markAsPaid,
		processRefund,
		resendEmail,
		cancelSeries
	}
}

