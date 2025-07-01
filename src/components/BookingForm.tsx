/**
 * Booking Form Component - 3 Step Process
 *
 * This component handles the complete booking creation flow with a multi-step process:
 * Step 1: Date Selection - User picks a date from calendar
 * Step 2: Time Selection - User picks available time slot for selected date
 * Step 3: Client & Details - User selects client and adds optional notes
 *
 * The component integrates with the simplified billing system:
 * - Automatically resolves billing settings (client-specific or user default)
 * - Creates bookings with appropriate billing configuration
 * - Handles different billing types (in-advance, right-after, monthly)
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ClientSearchSelect } from '@/components/ClientSearchSelect'
import { Calendar as CalendarIcon, Clock, User, ArrowLeft } from 'lucide-react'
import Calendar from '@/components/Calendar'
import { DayViewTimeSelector } from '@/components/DayViewTimeSelector'
import { TimeSlot } from '@/lib/calendar/calendar'
import { useUser } from '@/contexts/UserContext'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Label } from '@/components/ui/label'
import { createBookingSimple } from '@/lib/bookings/booking-orchestration-service'
import { useToast } from '@/components/ui/use-toast'

interface BookingFormProps {
	onSuccess?: () => void // Called when booking is successfully created
	onCancel?: () => void // Called when user cancels the booking process
	clients: Client[] // List of available clients to select from
}

interface Client {
	id: string // Unique client identifier
	name: string // Client's display name
	email: string // Client's email address
}

export function BookingForm({
	onSuccess,
	onCancel,
	clients
}: BookingFormProps) {
	// Step management state
	const [currentStep, setCurrentStep] = useState(1) // Tracks which step user is on (1, 2, or 3)
	const [loading, setLoading] = useState(false) // Loading state for booking creation

	// Booking data state
	const [selectedDate, setSelectedDate] = useState<Date | null>(null) // Date selected in step 1
	const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null) // Time slot selected in step 2
	const [selectedClient, setSelectedClient] = useState<string>('') // Client ID selected in step 3
	const [notes, setNotes] = useState('') // Optional notes for the booking

	// Context and utilities
	const { user, profile } = useUser() // Current user and profile data
	const { toast } = useToast() // Toast notification system

	/**
	 * Handles calendar month changes
	 * Currently placeholder - can be extended to fetch availability for new month
	 */
	const handleMonthChange = async (newMonth: Date) => {
		// Month change handling can be implemented here if needed
	}

	/**
	 * Step 1: Date Selection Handler
	 * When user clicks on a date in the calendar, store it and advance to time selection
	 */
	const handleDateSelect = (date: Date) => {
		setSelectedDate(date)
		setCurrentStep(2) // Auto-advance to time selection step
	}

	/**
	 * Step 2: Time Slot Selection Handler
	 * When user clicks on an available time slot, store it for booking creation
	 * Note: Does NOT auto-advance to step 3 - user must manually continue
	 */
	const handleSlotSelect = (startTime: string, endTime: string) => {
		// Convert to TimeSlot format for compatibility with existing interfaces
		const slot: TimeSlot = {
			start: startTime,
			end: endTime
		}
		setSelectedSlot(slot)
		// Intentionally NOT auto-advancing to give user time to review selection
	}

	/**
	 * Manual progression from Step 2 to Step 3
	 * Only enabled when user has selected a time slot
	 */
	const handleContinueToClient = () => {
		if (selectedSlot) {
			setCurrentStep(3)
		}
	}

	/**
	 * Clears the selected time slot in Step 2
	 * Allows user to pick a different time without going back to Step 1
	 */
	const handleClearTimeSelection = () => {
		setSelectedSlot(null)
	}

	/**
	 * Navigation: Go back to previous step
	 * Preserves data from current step when going backwards
	 */
	const handleBack = () => {
		if (currentStep > 1) {
			setCurrentStep(currentStep - 1)
		}
	}

	/**
	 * Step 3: Final booking submission
	 *
	 * Process:
	 * 1. Validates that all required data is present
	 * 2. Calls simplified booking service which handles:
	 *    - Billing settings resolution (client-specific or user default)
	 *    - Booking creation with appropriate billing configuration
	 *    - Different handling based on billing type
	 * 3. Shows success/error feedback
	 * 4. Calls onSuccess callback to close form/refresh data
	 */
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		// Validate required data before submission
		if (!selectedClient) {
			return // Form validation should prevent this, but extra safety check
		}

		setLoading(true)

		try {
			// Use the simplified booking service
			// This handles all the complex billing logic internally:
			// - Checks if client has specific billing settings
			// - Falls back to user default billing if not
			// - Creates booking with appropriate billing type and amount
			// - Returns result with payment info if needed
			const result = await createBookingSimple({
				userId: user!.id,
				clientId: selectedClient,
				startTime: selectedSlot!.start,
				endTime: selectedSlot!.end,
				notes
			})

			// Show success notification
			// Note: The simplified service returns whether payment is required,
			// but for now we show the same success message regardless
			toast({
				title: 'Cita creada',
				description: 'La cita se ha creado correctamente',
				color: 'success'
			})

			// Notify parent component that booking was successful
			// This typically closes the booking form and refreshes the booking list
			onSuccess?.()
		} catch (error) {
			console.error('Error creating booking:', error)

			// Show error notification with user-friendly message
			toast({
				title: 'Error al crear cita',
				description: 'Hubo un error al crear la cita.',
				variant: 'destructive',
				color: 'error'
			})
		} finally {
			// Always reset loading state, regardless of success/failure
			setLoading(false)
		}
	}

	return (
		<div className="space-y-6 py-6">
			{/* Step Indicator - Currently empty but could show progress dots */}
			<div className="flex items-center justify-between mb-6">
				{/* Future: Could add step indicator dots here */}
			</div>

			{/* ===== STEP 1: DATE SELECTION ===== */}
			{currentStep === 1 && (
				<div className="space-y-4">
					<div className="">
						{/* Main calendar component showing available dates */}
						<Calendar
							username={profile?.username || ''}
							selectedDay={selectedDate}
							availableSlots={{}} // TODO: Pass real availability data
							onSelectDate={handleDateSelect}
							onMonthChange={handleMonthChange}
						/>
					</div>
				</div>
			)}

			{/* ===== STEP 2: TIME SELECTION ===== */}
			{currentStep === 2 && selectedDate && (
				<div className="space-y-4">
					<div className="">
						{/* Day view showing available time slots for selected date */}
						<DayViewTimeSelector
							date={selectedDate}
							onTimeSelect={handleSlotSelect}
							onClearSelection={handleClearTimeSelection}
							existingBookings={[]} // TODO: Pass real existing bookings to show conflicts
							initialSelectedSlot={selectedSlot}
						/>
					</div>

					{/* Continue button - only show when time is selected */}
					{/* User must manually continue to review their selection */}
					{selectedSlot && (
						<div className="pt-4">
							<Button
								variant="default"
								onClick={handleContinueToClient}
								className="w-full bg-accent"
							>
								Continuar
							</Button>
						</div>
					)}
				</div>
			)}

			{/* ===== STEP 3: CLIENT SELECTION & BOOKING DETAILS ===== */}
			{currentStep === 3 && selectedSlot && (
				<div className="space-y-4">
					<form onSubmit={handleSubmit} className="space-y-4">
						{/* Client Selection Dropdown */}
						<div className="space-y-2">
							<Label className="text-md font-normal text-gray-700">
								Paciente
							</Label>
							{/* Searchable dropdown for client selection */}
							<ClientSearchSelect
								clients={clients}
								value={selectedClient}
								onValueChange={setSelectedClient}
								placeholder="Buscar paciente..."
							/>
						</div>

						{/* Optional Notes Field */}
						<div className="space-y-2">
							<Label className="text-md font-normal text-gray-700">
								Notas{' '}
								<span className="text-xs text-gray-500 font-normal">
									(opcional)
								</span>
							</Label>
							<Textarea
								placeholder="Añade cualquier nota sobre la cita..."
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								className="min-h-[80px]"
							/>
						</div>

						{/* Booking Summary */}
						<div>
							{/* Show formatted date and time for final confirmation */}
							<h3 className="text-sm mt-10">
								{format(
									selectedDate!,
									"EEEE, d 'de' MMMM 'de' yyyy",
									{ locale: es }
								)
									.replace(/^./, (c) => c.toUpperCase()) // Capitalize first letter
									.replace(
										/ de ([a-z])/,
										(match, p1) => ` de ${p1.toUpperCase()}` // Capitalize month
									)}{' '}
								a las{' '}
								{format(new Date(selectedSlot.start), 'HH:mm')}
							</h3>
						</div>

						{/* Final Submit Button */}
						<Button
							type="submit"
							variant="default"
							disabled={loading || !selectedClient} // Disabled until client selected
							className="w-full"
						>
							{loading ? 'Creando cita...' : 'Crear Cita'}
						</Button>
					</form>
				</div>
			)}

			{/* ===== BOTTOM NAVIGATION BAR ===== */}
			<div className="pt-4 border-t border-gray-200">
				<div className="flex items-center">
					{/* Back Button - only show if not on first step */}
					{currentStep > 1 && (
						<Button
							type="button"
							variant="ghost"
							onClick={handleBack}
							className="flex-1 flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800"
						>
							<ArrowLeft className="h-4 w-4" />
							Atrás
						</Button>
					)}

					{/* Visual separator between back and cancel buttons */}
					{currentStep > 1 && (
						<div className="h-8 w-px bg-gray-300 mx-2"></div>
					)}

					{/* Cancel Button - available on all steps */}
					{onCancel && (
						<Button
							type="button"
							variant="ghost"
							onClick={onCancel}
							className="flex-1 text-gray-600 hover:text-gray-800"
						>
							Cancelar
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}
