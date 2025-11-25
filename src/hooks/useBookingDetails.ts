/**
 * useBookingDetails Hook
 *
 * This hook manages the state and data fetching for the booking details panel.
 * It handles:
 * - Opening/closing the details panel
 * - Fetching booking details from the API
 * - Managing loading states
 * - Error handling
 *
 * The hook can be used across different pages (Dashboard, Calendar, etc.) to
 * display booking details in a consistent way.
 *
 * @example
 * ```tsx
 * const { details, loading, isOpen, open, close } = useBookingDetails()
 *
 * // Open details for a booking
 * await open(bookingId)
 *
 * // Render panel
 * {isOpen && (
 *   <SideSheet isOpen={isOpen} onClose={close}>
 *     <BookingDetailsPanel details={details} />
 *   </SideSheet>
 * )}
 * ```
 */

import { useState, useCallback } from 'react'

/**
 * Interface for booking details returned from the API
 * Matches the structure returned by /api/bookings/[id]
 */
export interface BookingDetails {
	bookingId: string
	clientName: string
	clientLastName: string | null
	clientEmail: string | null
	practitionerName: string
	consultationDate: string
	consultationTime: string
	status: string
	amount: number
	currency: string
	bill: any | null
	invoices: any[]
	invoice: any | null
	documents: {
		receiptUrl: string | null
		invoiceLinks: any[]
		hasInvoice: boolean
	}
}

/**
 * Configuration options for the useBookingDetails hook
 */
interface UseBookingDetailsOptions {
	/**
	 * Optional callback invoked when details are successfully fetched
	 * @param details - The fetched booking details
	 */
	onDetailsFetched?: (details: BookingDetails) => void

	/**
	 * Optional callback invoked when the panel is opened
	 * @param bookingId - The ID of the booking being viewed
	 */
	onOpen?: (bookingId: string) => void

	/**
	 * Optional callback invoked when the panel is closed
	 */
	onClose?: () => void

	/**
	 * Optional callback invoked when an error occurs while fetching details
	 * @param error - The error that occurred
	 */
	onError?: (error: Error) => void
}

/**
 * Return type for useBookingDetails hook
 */
interface UseBookingDetailsReturn {
	/**
	 * The fetched booking details, or null if not loaded
	 */
	details: BookingDetails | null

	/**
	 * Whether the details are currently being fetched
	 */
	loading: boolean

	/**
	 * Whether the details panel is open
	 */
	isOpen: boolean

	/**
	 * The ID of the currently selected booking, or null if none
	 */
	selectedBookingId: string | null

	/**
	 * Opens the details panel and fetches booking details for the given booking ID
	 *
	 * Steps:
	 * 1. Set loading state to true
	 * 2. Clear previous details
	 * 3. Set panel to open
	 * 4. Call onOpen callback if provided
	 * 5. Fetch booking details from API
	 * 6. Update details state with fetched data
	 * 7. Call onDetailsFetched callback if provided
	 * 8. Set loading state to false
	 * 9. Handle errors with onError callback if provided
	 *
	 * @param bookingId - The ID of the booking to fetch details for
	 */
	open: (bookingId: string) => Promise<void>

	/**
	 * Closes the details panel and clears the selected booking
	 *
	 * Steps:
	 * 1. Set panel to closed
	 * 2. Clear selected booking ID
	 * 3. Optionally clear details (can be kept for smooth re-opening)
	 * 4. Call onClose callback if provided
	 */
	close: () => void

	/**
	 * Refreshes the details for the currently selected booking
	 * Useful when booking data might have changed (e.g., after an action)
	 *
	 * Steps:
	 * 1. If no booking is selected, do nothing
	 * 2. Fetch fresh details for the selected booking
	 * 3. Update details state
	 *
	 * @returns Promise that resolves when refresh is complete
	 */
	refresh: () => Promise<void>
}

/**
 * Custom hook that manages booking details panel state and data fetching
 *
 * @param options - Optional configuration callbacks
 * @returns Object containing details state, loading state, and control functions
 */
export function useBookingDetails(options: UseBookingDetailsOptions = {}): UseBookingDetailsReturn {
	const { onDetailsFetched, onOpen, onClose, onError } = options

	// State for panel visibility
	const [isOpen, setIsOpen] = useState(false)

	// State for fetched booking details
	const [details, setDetails] = useState<BookingDetails | null>(null)

	// State for loading indicator
	const [loading, setLoading] = useState(false)

	// State for currently selected booking ID
	const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)

	/**
	 * Fetches booking details from the API
	 *
	 * This is a private helper function that performs the actual API call.
	 * It's separated from the open function to allow for refreshing without
	 * changing the open/close state.
	 *
	 * @param bookingId - The ID of the booking to fetch
	 * @returns Promise<BookingDetails> - The fetched booking details
	 * @throws Error if the API request fails
	 */
	const fetchDetails = useCallback(async (bookingId: string): Promise<BookingDetails> => {
		// Step 1: Make API request to fetch booking details
		const response = await fetch(`/api/bookings/${bookingId}`)

		// Step 2: Handle API errors
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}))
			throw new Error(errorData.error || 'Failed to fetch booking details')
		}

		// Step 3: Parse and return the response data
		const data = await response.json()
		return data as BookingDetails
	}, [])

	/**
	 * Opens the details panel and fetches booking details
	 */
	const open = useCallback(
		async (bookingId: string): Promise<void> => {
			try {
				// Step 1: Set loading state to show spinner
				setLoading(true)

				// Step 2: Clear previous details to show fresh loading state
				setDetails(null)

				// Step 3: Set selected booking ID
				setSelectedBookingId(bookingId)

				// Step 4: Open the panel
				setIsOpen(true)

				// Step 5: Invoke onOpen callback if provided
				onOpen?.(bookingId)

				// Step 6: Fetch booking details from API
				const fetchedDetails = await fetchDetails(bookingId)

				// Step 7: Update details state with fetched data
				setDetails(fetchedDetails)

				// Step 8: Invoke onDetailsFetched callback if provided
				onDetailsFetched?.(fetchedDetails)

				// Step 9: Set loading state to false
				setLoading(false)
			} catch (error) {
				// Handle errors
				setLoading(false)
				const err = error instanceof Error ? error : new Error('Unknown error occurred')
				onError?.(err)
				// Re-throw to allow caller to handle if needed
				throw err
			}
		},
		[fetchDetails, onDetailsFetched, onOpen, onError]
	)

	/**
	 * Closes the details panel
	 */
	const close = useCallback(() => {
		// Step 1: Close the panel
		setIsOpen(false)

		// Step 2: Clear selected booking ID
		setSelectedBookingId(null)

		// Step 3: Optionally clear details (commented out to keep data for smooth re-opening)
		// setDetails(null)

		// Step 4: Invoke onClose callback if provided
		onClose?.()
	}, [onClose])

	/**
	 * Refreshes the details for the currently selected booking
	 */
	const refresh = useCallback(async (): Promise<void> => {
		// Step 1: Check if there's a selected booking
		if (!selectedBookingId) {
			return
		}

		try {
			// Step 2: Set loading state
			setLoading(true)

			// Step 3: Fetch fresh details
			const fetchedDetails = await fetchDetails(selectedBookingId)

			// Step 4: Update details state
			setDetails(fetchedDetails)

			// Step 5: Invoke onDetailsFetched callback if provided
			onDetailsFetched?.(fetchedDetails)

			// Step 6: Set loading state to false
			setLoading(false)
		} catch (error) {
			// Handle errors
			setLoading(false)
			const err = error instanceof Error ? error : new Error('Unknown error occurred')
			onError?.(err)
			// Re-throw to allow caller to handle if needed
			throw err
		}
	}, [selectedBookingId, fetchDetails, onDetailsFetched, onError])

	// Return all state and control functions
	return {
		details,
		loading,
		isOpen,
		selectedBookingId,
		open,
		close,
		refresh
	}
}
