/**
 * useBookingCreation Hook
 *
 * This hook manages the state for the booking creation form modal.
 * It handles:
 * - Opening/closing the booking form modal
 * - Callbacks for successful booking creation
 * - Callbacks for form cancellation
 *
 * The hook provides a simple interface for managing booking creation UI state,
 * while the actual booking creation logic is handled by the BookingForm component.
 *
 * @example
 * ```tsx
 * const { isFormOpen, openForm, closeForm } = useBookingCreation({
 *   onBookingCreated: () => {
 *     // Refresh bookings list
 *     refreshBookings()
 *   }
 * })
 *
 * // Open form to create new booking
 * openForm()
 *
 * // Render form
 * {isFormOpen && (
 *   <SideSheetHeadless isOpen={isFormOpen} onClose={closeForm}>
 *     <BookingForm
 *       clients={clients}
 *       onSuccess={closeForm}
 *       onCancel={closeForm}
 *     />
 *   </SideSheetHeadless>
 * )}
 * ```
 */

import { useState, useCallback } from 'react'

/**
 * Configuration options for the useBookingCreation hook
 */
interface UseBookingCreationOptions {
	/**
	 * Optional callback invoked when a booking is successfully created
	 * This is called after the form's onSuccess callback
	 */
	onBookingCreated?: () => void

	/**
	 * Optional callback invoked when the form is cancelled
	 */
	onCancel?: () => void
}

/**
 * Return type for useBookingCreation hook
 */
interface UseBookingCreationReturn {
	/**
	 * Whether the booking creation form modal is open
	 */
	isFormOpen: boolean

	/**
	 * Opens the booking creation form modal
	 *
	 * Steps:
	 * 1. Set form open state to true
	 */
	openForm: () => void

	/**
	 * Closes the booking creation form modal
	 *
	 * Steps:
	 * 1. Set form open state to false
	 * 2. Call onCancel callback if provided
	 */
	closeForm: () => void

	/**
	 * Handles successful booking creation
	 * This should be called by the BookingForm's onSuccess callback
	 *
	 * Steps:
	 * 1. Close the form
	 * 2. Call onBookingCreated callback if provided
	 */
	handleBookingCreated: () => void
}

/**
 * Custom hook that manages booking creation form state
 *
 * This hook provides a centralized way to manage the booking creation form visibility.
 * The actual booking creation logic is handled by the BookingForm component, which
 * calls the API and manages its own internal state.
 *
 * @param options - Optional configuration callbacks
 * @returns Object containing form state and control functions
 */
export function useBookingCreation(
	options: UseBookingCreationOptions = {}
): UseBookingCreationReturn {
	const { onBookingCreated, onCancel } = options

	// State for form modal visibility
	const [isFormOpen, setIsFormOpen] = useState(false)

	/**
	 * Opens the booking creation form modal
	 */
	const openForm = useCallback(() => {
		// Step 1: Set form open state to true
		setIsFormOpen(true)
	}, [])

	/**
	 * Closes the booking creation form modal
	 */
	const closeForm = useCallback(() => {
		// Step 1: Set form open state to false
		setIsFormOpen(false)

		// Step 2: Invoke onCancel callback if provided
		onCancel?.()
	}, [onCancel])

	/**
	 * Handles successful booking creation
	 * This should be called by the BookingForm's onSuccess callback
	 */
	const handleBookingCreated = useCallback(() => {
		// Step 1: Close the form
		setIsFormOpen(false)

		// Step 2: Invoke onBookingCreated callback if provided
		onBookingCreated?.()
	}, [onBookingCreated])

	// Return all state and control functions
	return {
		isFormOpen,
		openForm,
		closeForm,
		handleBookingCreated
	}
}

