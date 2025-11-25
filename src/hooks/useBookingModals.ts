/**
 * useBookingModals Hook
 *
 * This hook manages the state for all booking-related modals and confirmation dialogs.
 * It handles:
 * - Refund confirmation modal
 * - Mark as paid confirmation modal
 * - Cancel booking confirmation modal
 * - Cancel series confirmation modal
 * - Reschedule form modal
 *
 * The hook provides simple open/close functions for each modal, keeping the modal
 * state management separate from the actual booking actions (which are handled by
 * useBookingActions).
 *
 * @example
 * ```tsx
 * const {
 *   refundingBookingId,
 *   markingAsPaidBookingId,
 *   cancelingBookingId,
 *   cancelingSeriesId,
 *   isRescheduleOpen,
 *   reschedulingBookingId,
 *   openRefundModal,
 *   closeRefundModal,
 *   openMarkAsPaidModal,
 *   closeMarkAsPaidModal,
 *   openCancelBookingModal,
 *   closeCancelBookingModal,
 *   openCancelSeriesModal,
 *   closeCancelSeriesModal,
 *   openRescheduleModal,
 *   closeRescheduleModal
 * } = useBookingModals()
 *
 * // Open refund modal for a booking
 * openRefundModal(bookingId)
 *
 * // Render modal
 * {refundingBookingId && (
 *   <RefundConfirmationModal
 *     bookingId={refundingBookingId}
 *     onConfirm={async () => {
 *       await processRefund(refundingBookingId)
 *       closeRefundModal()
 *     }}
 *     onOpenChange={(open) => !open && closeRefundModal()}
 *   />
 * )}
 * ```
 */

import { useState, useCallback } from 'react'

/**
 * Return type for useBookingModals hook
 */
interface UseBookingModalsReturn {
	/**
	 * The ID of the booking currently being refunded, or null if refund modal is closed
	 */
	refundingBookingId: string | null

	/**
	 * The ID of the booking currently being marked as paid, or null if modal is closed
	 */
	markingAsPaidBookingId: string | null

	/**
	 * The ID of the booking currently being canceled, or null if cancel modal is closed
	 */
	cancelingBookingId: string | null

	/**
	 * The ID of the series currently being canceled, or null if cancel series modal is closed
	 */
	cancelingSeriesId: string | null

	/**
	 * Whether the reschedule form modal is open
	 */
	isRescheduleOpen: boolean

	/**
	 * The ID of the booking currently being rescheduled, or null if reschedule modal is closed
	 */
	reschedulingBookingId: string | null

	/**
	 * Opens the refund confirmation modal for the given booking
	 *
	 * Steps:
	 * 1. Set the refunding booking ID to open the modal
	 *
	 * @param bookingId - The ID of the booking to refund
	 */
	openRefundModal: (bookingId: string) => void

	/**
	 * Closes the refund confirmation modal
	 *
	 * Steps:
	 * 1. Clear the refunding booking ID
	 */
	closeRefundModal: () => void

	/**
	 * Opens the mark as paid confirmation modal for the given booking
	 *
	 * Steps:
	 * 1. Set the marking as paid booking ID to open the modal
	 *
	 * @param bookingId - The ID of the booking to mark as paid
	 */
	openMarkAsPaidModal: (bookingId: string) => void

	/**
	 * Closes the mark as paid confirmation modal
	 *
	 * Steps:
	 * 1. Clear the marking as paid booking ID
	 */
	closeMarkAsPaidModal: () => void

	/**
	 * Opens the cancel booking confirmation modal for the given booking
	 *
	 * Steps:
	 * 1. Set the canceling booking ID to open the modal
	 *
	 * @param bookingId - The ID of the booking to cancel
	 */
	openCancelBookingModal: (bookingId: string) => void

	/**
	 * Closes the cancel booking confirmation modal
	 *
	 * Steps:
	 * 1. Clear the canceling booking ID
	 */
	closeCancelBookingModal: () => void

	/**
	 * Opens the cancel series confirmation modal for the given series
	 *
	 * Steps:
	 * 1. Set the canceling series ID to open the modal
	 *
	 * @param seriesId - The ID of the series to cancel
	 */
	openCancelSeriesModal: (seriesId: string) => void

	/**
	 * Closes the cancel series confirmation modal
	 *
	 * Steps:
	 * 1. Clear the canceling series ID
	 */
	closeCancelSeriesModal: () => void

	/**
	 * Opens the reschedule form modal for the given booking
	 *
	 * Steps:
	 * 1. Set the rescheduling booking ID
	 * 2. Open the reschedule modal
	 *
	 * @param bookingId - The ID of the booking to reschedule
	 */
	openRescheduleModal: (bookingId: string) => void

	/**
	 * Closes the reschedule form modal
	 *
	 * Steps:
	 * 1. Close the reschedule modal
	 * 2. Clear the rescheduling booking ID
	 */
	closeRescheduleModal: () => void
}

/**
 * Custom hook that manages state for all booking-related modals
 *
 * This hook provides a centralized way to manage modal visibility and which
 * booking/series is being acted upon. The actual booking actions (refund, mark as paid, etc.)
 * are handled separately by useBookingActions.
 *
 * @returns Object containing modal state and open/close functions
 */
export function useBookingModals(): UseBookingModalsReturn {
	// State for refund modal
	const [refundingBookingId, setRefundingBookingId] = useState<string | null>(null)

	// State for mark as paid modal
	const [markingAsPaidBookingId, setMarkingAsPaidBookingId] = useState<string | null>(null)

	// State for cancel booking modal
	const [cancelingBookingId, setCancelingBookingId] = useState<string | null>(null)

	// State for cancel series modal
	const [cancelingSeriesId, setCancelingSeriesId] = useState<string | null>(null)

	// State for reschedule modal
	const [isRescheduleOpen, setIsRescheduleOpen] = useState(false)
	const [reschedulingBookingId, setReschedulingBookingId] = useState<string | null>(null)

	/**
	 * Opens the refund confirmation modal
	 */
	const openRefundModal = useCallback((bookingId: string) => {
		// Step 1: Set the refunding booking ID to open the modal
		setRefundingBookingId(bookingId)
	}, [])

	/**
	 * Closes the refund confirmation modal
	 */
	const closeRefundModal = useCallback(() => {
		// Step 1: Clear the refunding booking ID
		setRefundingBookingId(null)
	}, [])

	/**
	 * Opens the mark as paid confirmation modal
	 */
	const openMarkAsPaidModal = useCallback((bookingId: string) => {
		// Step 1: Set the marking as paid booking ID to open the modal
		setMarkingAsPaidBookingId(bookingId)
	}, [])

	/**
	 * Closes the mark as paid confirmation modal
	 */
	const closeMarkAsPaidModal = useCallback(() => {
		// Step 1: Clear the marking as paid booking ID
		setMarkingAsPaidBookingId(null)
	}, [])

	/**
	 * Opens the cancel booking confirmation modal
	 */
	const openCancelBookingModal = useCallback((bookingId: string) => {
		// Step 1: Set the canceling booking ID to open the modal
		setCancelingBookingId(bookingId)
	}, [])

	/**
	 * Closes the cancel booking confirmation modal
	 */
	const closeCancelBookingModal = useCallback(() => {
		// Step 1: Clear the canceling booking ID
		setCancelingBookingId(null)
	}, [])

	/**
	 * Opens the cancel series confirmation modal
	 */
	const openCancelSeriesModal = useCallback((seriesId: string) => {
		// Step 1: Set the canceling series ID to open the modal
		setCancelingSeriesId(seriesId)
	}, [])

	/**
	 * Closes the cancel series confirmation modal
	 */
	const closeCancelSeriesModal = useCallback(() => {
		// Step 1: Clear the canceling series ID
		setCancelingSeriesId(null)
	}, [])

	/**
	 * Opens the reschedule form modal
	 */
	const openRescheduleModal = useCallback((bookingId: string) => {
		// Step 1: Set the rescheduling booking ID
		setReschedulingBookingId(bookingId)

		// Step 2: Open the reschedule modal
		setIsRescheduleOpen(true)
	}, [])

	/**
	 * Closes the reschedule form modal
	 */
	const closeRescheduleModal = useCallback(() => {
		// Step 1: Close the reschedule modal
		setIsRescheduleOpen(false)

		// Step 2: Clear the rescheduling booking ID
		setReschedulingBookingId(null)
	}, [])

	// Return all modal state and control functions
	return {
		refundingBookingId,
		markingAsPaidBookingId,
		cancelingBookingId,
		cancelingSeriesId,
		isRescheduleOpen,
		reschedulingBookingId,
		openRefundModal,
		closeRefundModal,
		openMarkAsPaidModal,
		closeMarkAsPaidModal,
		openCancelBookingModal,
		closeCancelBookingModal,
		openCancelSeriesModal,
		closeCancelSeriesModal,
		openRescheduleModal,
		closeRescheduleModal
	}
}

