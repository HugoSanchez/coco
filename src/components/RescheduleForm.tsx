'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar as ArrowLeft } from 'lucide-react'
import Calendar from '@/components/Calendar'
import { DayViewTimeSelector } from '@/components/DayViewTimeSelector'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/use-toast'
import { Spinner } from '@/components/ui/spinner'

interface RescheduleFormProps {
	bookingId: string
	customerName: string
	onSuccess?: () => void
	onCancel?: () => void
}

export function RescheduleForm({
	bookingId,
	customerName,
	onSuccess,
	onCancel
}: RescheduleFormProps) {
	// Step management state
	const [currentStep, setCurrentStep] = useState(1) // 1 for date, 2 for time
	const [loading, setLoading] = useState(false)

	// Booking data state
	const [selectedDate, setSelectedDate] = useState<Date | null>(null)
	const [selectedSlot, setSelectedSlot] = useState<{
		start: string
		end: string
	} | null>(null)
	const [existingBookings, setExistingBookings] = useState<
		Array<{
			start: string
			end: string
			title?: string
			type?: string
			status?: 'pending' | 'confirmed'
			bookingId?: string
		}>
	>([])
	const [loadingBookings, setLoadingBookings] = useState(false)

	const { user, profile } = useUser()
	const { toast } = useToast()

	// Re-fetch existing bookings when returning to step 2 if date is already selected
	useEffect(() => {
		if (
			currentStep === 2 &&
			selectedDate &&
			existingBookings.length === 0
		) {
			fetchExistingBookings(selectedDate)
		}
	}, [currentStep, selectedDate])

	// Fetch existing bookings when date changes
	const fetchExistingBookings = async (date: Date) => {
		if (!user?.id) return

		setExistingBookings([])

		try {
			const startOfDay = new Date(date)
			startOfDay.setHours(0, 0, 0, 0)

			const endOfDay = new Date(date)
			endOfDay.setHours(23, 59, 59, 999)

			const response = await fetch(
				`/api/calendar/events?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}`
			)

			if (!response.ok) {
				throw new Error('Failed to fetch calendar events')
			}

			const data = await response.json()
			setExistingBookings(data.events || [])
		} catch (error) {
			console.error('Error fetching existing bookings:', error)
			setExistingBookings([])
		}
	}

	const handleMonthChange = async (newMonth: Date) => {
		// Month change handling can be implemented here if needed
	}

	const handleDateSelect = async (date: Date) => {
		setSelectedDate(date)
		setSelectedSlot(null)
		setCurrentStep(2)

		// Fetch existing bookings asynchronously
		setLoadingBookings(true)
		try {
			await fetchExistingBookings(date)
		} finally {
			setLoadingBookings(false)
		}
	}

	const handleSlotSelect = (startTime: string, endTime: string) => {
		setSelectedSlot({
			start: startTime,
			end: endTime
		})
	}

	const handleContinueToConfirm = () => {
		if (selectedSlot) {
			// Immediately proceed to reschedule
			handleSubmit()
		}
	}

	const handleClearTimeSelection = () => {
		setSelectedSlot(null)
	}

	const handleBack = () => {
		if (currentStep > 1) {
			setCurrentStep(currentStep - 1)
		}
	}

	const handleSubmit = async () => {
		if (!selectedSlot) return

		setLoading(true)

		try {
			// Show immediate feedback with spinner
			toast({
				title: 'Reprogramando cita...',
				description: 'Procesando la reprogramación de la cita.',
				variant: 'default',
				color: 'loading'
			})

			const response = await fetch(
				`/api/bookings/${bookingId}/reschedule`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						newStartTime: selectedSlot.start,
						newEndTime: selectedSlot.end
					})
				}
			)

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(
					errorData.error || 'Failed to reschedule booking'
				)
			}

			toast({
				title: 'Cita reprogramada',
				description: 'La cita ha sido reprogramada correctamente.',
				variant: 'default',
				color: 'success'
			})

			// Notify parent component that reschedule was successful
			onSuccess?.()
		} catch (error) {
			console.error('Error rescheduling booking:', error)
			toast({
				title: 'Error',
				description: 'Failed to reschedule booking. Please try again.',
				variant: 'destructive'
			})
		} finally {
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
						<Calendar
							username={profile?.username || ''}
							selectedDay={selectedDate}
							availableSlots={{}}
							onSelectDate={handleDateSelect}
							onMonthChange={handleMonthChange}
						/>
					</div>
				</div>
			)}

			{/* ===== STEP 2: TIME SELECTION ===== */}
			{currentStep === 2 && selectedDate && (
				<div className="space-y-4">
					{loadingBookings ? (
						<div className="flex items-center justify-center py-12">
							<Spinner size="sm" color={'dark'} />
						</div>
					) : (
						<>
							<div className="">
								<DayViewTimeSelector
									date={selectedDate}
									onTimeSelect={handleSlotSelect}
									onClearSelection={handleClearTimeSelection}
									existingBookings={existingBookings}
									initialSelectedSlot={selectedSlot}
								/>
							</div>

							{/* Continue button - only show when time is selected */}
							{selectedSlot && !loadingBookings && (
								<div className="pt-4">
									<Button
										variant="default"
										onClick={handleContinueToConfirm}
										disabled={loading}
										className="w-full bg-accent"
									>
										{loading
											? 'Reprogramando...'
											: 'Confirmar Reprogramación'}
									</Button>
								</div>
							)}
						</>
					)}
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
