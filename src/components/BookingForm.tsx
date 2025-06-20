/**
 * Booking Form Component - 3 Step Process
 *
 * Step 1: Select Date
 * Step 2: Select Time
 * Step 3: Select Client
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { Calendar as CalendarIcon, Clock, User, ArrowLeft } from 'lucide-react'
import Calendar from '@/components/Calendar'
import { DayViewTimeSelector } from '@/components/DayViewTimeSelector'
import { TimeSlot } from '@/lib/calendar'
import { useUser } from '@/contexts/UserContext'
import { format, startOfMonth } from 'date-fns'
import { Label } from '@/components/ui/label'
import { createBooking, CreateBookingPayload } from '@/lib/db/bookings'
import { useToast } from '@/components/ui/use-toast'

interface BookingFormProps {
	onSuccess?: () => void
	onCancel?: () => void
	clients: Client[]
}

interface Client {
	id: string
	name: string
	email: string
}

export function BookingForm({
	onSuccess,
	onCancel,
	clients
}: BookingFormProps) {
	const [currentStep, setCurrentStep] = useState(1)
	const [loading, setLoading] = useState(false)
	const [selectedDate, setSelectedDate] = useState<Date | null>(null)
	const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
	const [selectedClient, setSelectedClient] = useState<string>('')
	const [availableSlots, setAvailableSlots] = useState<{
		[day: string]: TimeSlot[]
	}>({})
	const [currentMonth, setCurrentMonth] = useState<Date>(
		startOfMonth(new Date())
	)
	const [notes, setNotes] = useState('')
	const [userTimeZone] = useState(
		Intl.DateTimeFormat().resolvedOptions().timeZone
	)

	const { user, profile } = useUser()
	const { toast } = useToast()

	// Fetch available slots when component mounts or month changes
	useEffect(() => {
		if (user && profile?.username) {
			fetchAvailableSlots(currentMonth)
		}
	}, [user, profile, currentMonth])

	const fetchAvailableSlots = async (month: Date) => {
		if (!profile?.username) return

		try {
			const response = await fetch(
				`/api/available-slots?username=${
					profile.username
				}&month=${month.toISOString()}`
			)
			if (!response.ok) throw new Error('Failed to fetch available slots')
			const slots = await response.json()
			setAvailableSlots(slots)
		} catch (error) {
			console.error('Error fetching available slots:', error)
		}
	}

	const handleMonthChange = async (newMonth: Date) => {
		setCurrentMonth(newMonth)
		await fetchAvailableSlots(newMonth)
	}

	const handleDateSelect = (date: Date) => {
		setSelectedDate(date)
		setCurrentStep(2)
	}

	const handleSlotSelect = (startTime: string, endTime: string) => {
		// Convert to TimeSlot format for compatibility
		const slot: TimeSlot = {
			start: startTime,
			end: endTime
		}
		setSelectedSlot(slot)
		setCurrentStep(3)
	}

	const handleBack = () => {
		if (currentStep > 1) {
			setCurrentStep(currentStep - 1)
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!selectedClient) {
			return
		}

		setLoading(true)

		try {
			console.log('Creating new booking...', {
				date: selectedDate,
				slot: selectedSlot,
				clientId: selectedClient,
				notes
			})

			const payload: CreateBookingPayload = {
				user_id: user!.id,
				client_id: selectedClient,
				start_time: selectedSlot!.start,
				end_time: selectedSlot!.end
			}

			await createBooking(payload)
			toast({
				title: 'Cita creada exitosamente',
				description: 'La cita se ha creado correctamente'
			})
			onSuccess?.()
		} catch (error) {
			console.error('Error creating booking:', error)
			toast({
				title: 'Error al crear cita',
				description:
					'Hubo un error al crear la cita. Por favor, inténtelo más tarde',
				variant: 'destructive'
			})
		} finally {
			setLoading(false)
		}
	}

	const resetForm = () => {
		setCurrentStep(1)
		setSelectedDate(null)
		setSelectedSlot(null)
		setSelectedClient('')
		setNotes('')
	}

	return (
		<div className="space-y-6 py-6">
			{/* Step Indicator */}
			<div className="flex items-center justify-between mb-6">
				{/* Remove the duplicate back button - it's now in the bottom navigation */}
			</div>

			{/* Step 1: Date Selection */}
			{currentStep === 1 && (
				<div className="space-y-4">
					<div className="">
						<Calendar
							username={profile?.username || ''}
							selectedDay={selectedDate}
							availableSlots={availableSlots}
							onSelectDate={handleDateSelect}
							onMonthChange={handleMonthChange}
						/>
					</div>
				</div>
			)}

			{/* Step 2: Time Selection */}
			{currentStep === 2 && selectedDate && (
				<div className="space-y-4">
					<div className="">
						<DayViewTimeSelector
							date={selectedDate}
							onTimeSelect={handleSlotSelect}
							existingBookings={[]} // TODO: Pass real existing bookings
						/>
					</div>
				</div>
			)}

			{/* Step 3: Client Selection */}
			{currentStep === 3 && selectedSlot && (
				<div className="space-y-4">
					<div className="flex items-center gap-2 mb-4">
						<User className="h-5 w-5 text-teal-600" />
						<div>
							<h3 className="text-lg font-medium">
								Selecciona un paciente
							</h3>
							<p className="text-sm text-gray-600">
								{format(selectedDate!, 'EEEE, MMMM d')} a las{' '}
								{format(new Date(selectedSlot.start), 'h:mm a')}
							</p>
						</div>
					</div>

					<form onSubmit={handleSubmit} className="space-y-4">
						{/* Client Selection */}
						<div className="space-y-2">
							<label className="text-sm font-medium text-gray-700">
								Paciente
							</label>
							<Select
								value={selectedClient}
								onValueChange={setSelectedClient}
							>
								<SelectTrigger>
									<SelectValue placeholder="Selecciona un paciente" />
								</SelectTrigger>
								<SelectContent>
									{clients.map((client) => (
										<SelectItem
											key={client.id}
											value={client.id}
										>
											{client.name} - {client.email}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Notes */}
						<div className="space-y-2">
							<label className="text-sm font-medium text-gray-700">
								Notas (opcional)
							</label>
							<Textarea
								placeholder="Añade cualquier nota sobre la cita..."
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								className="min-h-[80px]"
							/>
						</div>

						{/* Submit Button */}
						<Button
							type="submit"
							disabled={loading || !selectedClient}
							className="w-full bg-teal-400 hover:bg-teal-400 hover:opacity-90 text-white"
						>
							{loading ? 'Creando cita...' : 'Crear Cita'}
						</Button>
					</form>
				</div>
			)}

			{/* Bottom Navigation */}
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

					{/* Vertical separator - only show if back button is visible */}
					{currentStep > 1 && (
						<div className="h-8 w-px bg-gray-300 mx-2"></div>
					)}

					{/* Cancel Button */}
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
