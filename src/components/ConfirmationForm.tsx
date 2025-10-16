import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { formatSpanishLongDate, formatSpanishTime24h, formatSpanishDateWithTime } from '@/lib/date/format'
import { toZonedTime } from 'date-fns-tz'
import { TimeSlot } from '@/lib/calendar/calendar'
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
	practitionerPricing?: {
		amount: number
		currency: string
		first_consultation_amount?: number | null
	}
	username?: string
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
	onCancel,
	practitionerPricing,
	username
}: ConfirmationFormProps) {
	// Form state management
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [loading, setLoading] = useState(false)
	const [consultationType, setConsultationType] = useState<'first' | 'followup'>('followup')
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

		try {
			const res = await fetch('/api/public/bookings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username,
					start: selectedSlot.start,
					end: selectedSlot.end,
					patient: { name, email },
					consultationType,
					mode: 'online'
				})
			})

			if (!res.ok) {
				const payload = await res.json().catch(() => ({}))
				if (res.status === 409 || payload?.error === 'slot_conflict') {
					throw new Error('Ese hueco ya ha sido reservado. Por favor, elige otra hora.')
				}
				if (res.status === 400 && payload?.error === 'missing_fields') {
					throw new Error('Faltan datos para completar la reserva.')
				}
				throw new Error('No se ha podido crear la cita. Inténtalo de nuevo.')
			}

			setIsConfirmed(true)
			onConfirm({ name, email })
		} catch (err) {
			console.error(err)
		} finally {
			setLoading(false)
		}
	}

	// Derived pricing based on practitioner defaults
	const baseAmount = practitionerPricing?.amount ?? 0
	const firstAmount = practitionerPricing?.first_consultation_amount ?? null
	const hasFirstPrice = firstAmount != null && !Number.isNaN(Number(firstAmount))

	// Render confirmation screen after successful booking
	if (isConfirmed) {
		return (
			<div
				className={`space-y-4 p-4 mt-16 flex flex-col items-center justify-center h-full transition-opacity duration-500 ease-in-out ${
					fadeIn ? 'opacity-100' : 'opacity-0'
				}`}
			>
				{/* Success icon */}
				<FaCheckCircle className="text-teal-400 text-4xl" />

				{/* Confirmation message */}
				<h2 className="text-2xl font-bold">Cita programada</h2>
				<p className="text-center mb-4 px-4">
					Por favor, revisa tu correo electrónico para acabar de confirmar la cita.
				</p>
			</div>
		)
	}

	// Render booking form
	return (
		<div className="px-0">
			{/* Pricing and appointment details */}
			<h2 className="text-xl font-bold mb-1">Confirma tu cita</h2>
			<p className="mb-4 text-gray-600 font-light text-sm">
				Rellena el formulario con tus datos y confirma la cita.
			</p>

			{/* Contact information form */}
			<form onSubmit={handleSubmit} className="space-y-4 mt-8">
				{/* Name input field */}
				<div>
					<label htmlFor="name" className="block text-sm font-medium text-gray-700">
						Nombre
					</label>
					<Input
						type="text"
						id="name"
						placeholder="Introduce tu nombre"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
					/>
				</div>

				{/* Email input field */}
				<div>
					<label htmlFor="email" className="block text-sm font-medium text-gray-700">
						Email
					</label>
					<Input
						type="email"
						id="email"
						placeholder="ejemplo@mail.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>
				</div>

				{/* Appointment type and price (consistent select UI) */}
				<div className="space-y-2">
					<label htmlFor="email" className="block text-sm font-medium text-gray-700">
						Tipo de consulta
					</label>
					{hasFirstPrice ? (
						<Select
							value={consultationType}
							onValueChange={(val) => setConsultationType(val as 'first' | 'followup')}
						>
							<SelectTrigger className="h-12">
								<SelectValue placeholder="Selecciona tipo de consulta" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="first">
									{`Primera consulta — ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: practitionerPricing?.currency || 'EUR' }).format(Number(firstAmount || 0))}`}
								</SelectItem>
								<SelectItem value="followup">
									{`Consulta de seguimiento — ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: practitionerPricing?.currency || 'EUR' }).format(Number(baseAmount || 0))}`}
								</SelectItem>
							</SelectContent>
						</Select>
					) : (
						<Select value={'followup'}>
							<SelectTrigger className="h-12" disabled>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="followup">
									{`Consulta — ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: practitionerPricing?.currency || 'EUR' }).format(Number(baseAmount || 0))}`}
								</SelectItem>
							</SelectContent>
						</Select>
					)}
				</div>

				{/* Information notice */}

				{/* Payment button */}
				<div className="flex flex-col justify-between">
					<p className="mt-8 text-sm text-gray-700 font-light">
						Estás agendando una cita para el{' '}
						<span className="font-medium">{formatSpanishDateWithTime(startTime)}h</span>
					</p>
					<Button
						onClick={handleSubmit}
						className="w-full mt-8 h-12 text-white flex items-center justify-center"
					>
						{loading ? (
							<Spinner size="sm" />
						) : (
							<>
								<p>Confirmar cita</p>
							</>
						)}
					</Button>
				</div>
			</form>
		</div>
	)
}
