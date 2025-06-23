import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { TimeSlot } from '@/lib/calendar'
import { FaApple, FaCheckCircle } from 'react-icons/fa'
import { Spinner } from './ui/spinner'

/**
 * Props interface for the ConfirmationForm component
 *
 * @interface ConfirmationFormProps
 * @property selectedSlot - The time slot that the user has selected for booking
 * @property userTimeZone - The user's timezone for displaying times correctly
 * @property onConfirm - Callback function called when booking is confirmed
 * @property onCancel - Callback function called when user cancels the booking
 */
interface ConfirmationFormProps {
	selectedSlot: TimeSlot
	userTimeZone: string
	onConfirm: (bookingDetails: BookingDetails) => void
	onCancel: () => void
}

/**
 * Interface for booking details collected from the user
 *
 * @interface BookingDetails
 * @property name - Customer's full name
 * @property email - Customer's email address for confirmation
 */
interface BookingDetails {
	name: string
	email: string
}

/**
 * ConfirmationForm Component
 *
 * Handles the final step of the booking process where customers provide
 * their contact information and confirm their appointment. This component
 * manages the transition from booking form to confirmation screen.
 *
 * FEATURES:
 * - Collects customer contact information (name, email)
 * - Displays selected time slot in user's timezone
 * - Simulates payment processing
 * - Shows confirmation screen with booking details
 * - Smooth fade-in animation for confirmation
 *
 * BOOKING FLOW:
 * 1. User sees selected time slot and pricing
 * 2. User fills in contact information
 * 3. User clicks "Pay" to confirm booking
 * 4. Payment simulation runs (2 seconds)
 * 5. Confirmation screen appears with booking details
 *
 * @component
 * @example
 * ```tsx
 * <ConfirmationForm
 *   selectedSlot={timeSlot}
 *   userTimeZone="Europe/Madrid"
 *   onConfirm={(details) => handleBooking(details)}
 *   onCancel={() => setStep('time-selection')}
 * />
 * ```
 */
export function ConfirmationForm({
	selectedSlot,
	userTimeZone,
	onConfirm,
	onCancel
}: ConfirmationFormProps) {
	// Form state management
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [loading, setLoading] = useState(false)
	const [isConfirmed, setIsConfirmed] = useState(false)
	const [fadeIn, setFadeIn] = useState(false)

	// Convert UTC times to user's timezone for display
	const startTime = toZonedTime(new Date(selectedSlot.start), userTimeZone)
	const endTime = toZonedTime(new Date(selectedSlot.end), userTimeZone)

	/**
	 * Effect to trigger fade-in animation for confirmation screen
	 * Adds a small delay to ensure smooth transition
	 */
	useEffect(() => {
		if (isConfirmed) {
			// Trigger the fade-in effect after a short delay
			// This ensures the confirmation screen appears smoothly
			const timer = setTimeout(() => setFadeIn(true), 50)
			return () => clearTimeout(timer)
		}
	}, [isConfirmed])

	/**
	 * Handles form submission and booking confirmation
	 *
	 * This function:
	 * 1. Prevents default form submission
	 * 2. Shows loading state
	 * 3. Simulates payment processing (2 second delay)
	 * 4. Sets confirmation state
	 * 5. Calls the onConfirm callback with booking details
	 *
	 * @param e - Form submission event
	 */
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)

		// Simulate payment processing
		// In a real application, this would integrate with a payment provider
		await new Promise((resolve) => setTimeout(resolve, 2000))

		setLoading(false)
		setIsConfirmed(true)
		onConfirm({ name, email })
	}

	// Render confirmation screen after successful booking
	if (isConfirmed) {
		return (
			<div
				className={`space-y-8 p-4 flex flex-col items-center justify-center h-full transition-opacity duration-500 ease-in-out ${
					fadeIn ? 'opacity-100' : 'opacity-0'
				}`}
			>
				{/* Success icon */}
				<FaCheckCircle className="text-emerald-400 text-7xl mb-4" />

				{/* Confirmation message */}
				<h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
				<p className="text-center mb-4">
					Your appointment with Henry has been booked for:
					<br />
					<strong>{format(startTime, 'MMMM d, yyyy')}</strong>
					<br />
					<strong>
						{format(startTime, 'h:mm a')} -{' '}
						{format(endTime, 'h:mm a')}
					</strong>
				</p>

				{/* Email confirmation notice */}
				<p className="text-sm text-gray-600 text-center">
					A confirmation email has been sent to {email}
				</p>
			</div>
		)
	}

	// Render booking form
	return (
		<div className="p-4">
			{/* Pricing and appointment details */}
			<h2 className="text-xl font-bold mb-4">100,00€</h2>
			<p className="mb-4">
				You&apos;re booking an appointment with Henry
				<br />
				<strong>{format(startTime, 'MMMM d, yyyy')}</strong>
				<br />
				<strong>
					{format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
				</strong>
			</p>

			{/* Contact information form */}
			<form onSubmit={handleSubmit} className="space-y-4 mt-8">
				{/* Name input field */}
				<div>
					<label
						htmlFor="name"
						className="block text-sm font-medium text-gray-700"
					>
						Name
					</label>
					<Input
						type="text"
						id="name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
					/>
				</div>

				{/* Email input field */}
				<div>
					<label
						htmlFor="email"
						className="block text-sm font-medium text-gray-700"
					>
						Email
					</label>
					<Input
						type="email"
						id="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>
				</div>

				{/* Information notice */}
				<p className="mb-4">
					<em className="text-sm font-light">
						Conference details will be sent via email immediately
						after booking.
					</em>
				</p>

				{/* Payment button */}
				<div className="flex justify-between">
					<Button
						onClick={handleSubmit}
						className="w-full mt-8 h-12 text-white hover:bg-gray-800 flex items-center justify-center"
					>
						{loading ? (
							<Spinner size="sm" />
						) : (
							<>
								<FaApple className="mr-2 h-5 w-5" />
								<p className="text-lg">Pay</p>
							</>
						)}
					</Button>
				</div>
			</form>
		</div>
	)
}
