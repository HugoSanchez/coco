import { useState, useEffect } from 'react'

/**
 * Props interface for the BookingInterface component
 *
 * @interface BookingInterfaceProps
 * @property userId - The ID of the user whose available slots to fetch
 */
interface BookingInterfaceProps {
	userId: string
}

/**
 * BookingInterface Component
 *
 * A component that fetches and displays available booking slots for a specific user.
 * Automatically refreshes the available slots every minute to keep the data current.
 *
 * FEATURES:
 * - Fetches available slots for the next 7 days
 * - Auto-refreshes data every minute
 * - Displays slots as clickable buttons
 * - Handles booking slot selection
 *
 * DATA FLOW:
 * 1. Component mounts and fetches initial slots
 * 2. Sets up polling to refresh every minute
 * 3. User clicks on a slot to initiate booking
 * 4. Booking details are logged (placeholder for actual booking logic)
 *
 * NOTE:
 * This appears to be a basic implementation that could be enhanced with
 * better UI components, error handling, and actual booking functionality.
 *
 * @component
 * @example
 * ```tsx
 * <BookingInterface userId="user-123" />
 * ```
 */
export function BookingInterface({ userId }: BookingInterfaceProps) {
	// State to store available booking slots
	const [availableSlots, setAvailableSlots] = useState<any[]>([])

	/**
	 * Fetches available booking slots from the API
	 *
	 * Requests slots for the next 7 days from today and updates the state
	 * with the fetched data.
	 */
	async function fetchAvailableSlots() {
		// Calculate date range: today to 7 days from now
		const startDate = new Date() // Today
		const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

		// Fetch available slots from API
		const response = await fetch(
			`/api/calendar/available-slots?userId=${userId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
		)
		const data = await response.json()

		// Update state with fetched slots
		setAvailableSlots(data.availableSlots)
	}

	/**
	 * Effect to fetch initial slots and set up polling
	 *
	 * Fetches slots on component mount and sets up an interval to
	 * refresh the data every minute to keep it current.
	 */
	useEffect(() => {
		// Fetch initial slots
		fetchAvailableSlots()

		// Set up polling to refresh slots every minute (60000ms)
		const intervalId = setInterval(fetchAvailableSlots, 60000)

		// Cleanup: clear interval when component unmounts
		return () => clearInterval(intervalId)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userId])

	/**
	 * Handles booking slot selection
	 *
	 * Currently logs the selected slot. This would typically integrate
	 * with a booking system or redirect to a booking form.
	 *
	 * @param slot - The selected time slot object
	 */
	const handleBooking = (slot: any) => {
		console.log('Booking', slot)
		// TODO: Implement actual booking logic
		// This could redirect to a booking form or open a modal
	}

	return (
		<div>
			{/* Component title */}
			<h2>Available Slots</h2>

			{/* Render each available slot as a clickable button */}
			{availableSlots.map((slot) => (
				<button key={slot.start} onClick={() => handleBooking(slot)}>
					{/* Display slot start and end times in local format */}
					{new Date(slot.start).toLocaleString()} -{' '}
					{new Date(slot.end).toLocaleString()}
				</button>
			))}
		</div>
	)
}
