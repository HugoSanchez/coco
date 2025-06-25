'use client'

import React, { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { Spinner } from '@/components/ui/spinner'

/**
 * Array of day abbreviations for the week
 * Used for rendering day headers and managing availability data
 */
const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/**
 * Comprehensive list of timezones with their GMT offsets
 * Provides users with a wide range of timezone options for their availability
 */
const timezones = [
	{ value: 'Etc/GMT', label: 'GMT/UTC+0' },
	{ value: 'Europe/London', label: 'GMT+0 London' },
	{ value: 'Europe/Dublin', label: 'GMT+0 Dublin' },
	{ value: 'Europe/Lisbon', label: 'GMT+0 Lisbon' },
	{ value: 'Africa/Casablanca', label: 'GMT+0 Casablanca' },
	{ value: 'Europe/Paris', label: 'GMT+1 Paris' },
	{ value: 'Europe/Berlin', label: 'GMT+1 Berlin' },
	{ value: 'Europe/Rome', label: 'GMT+1 Rome' },
	{ value: 'Europe/Madrid', label: 'GMT+1 Madrid' },
	{ value: 'Europe/Athens', label: 'GMT+2 Athens' },
	{ value: 'Europe/Kiev', label: 'GMT+2 Kiev' },
	{ value: 'Africa/Cairo', label: 'GMT+2 Cairo' },
	{ value: 'Europe/Moscow', label: 'GMT+3 Moscow' },
	{ value: 'Asia/Istanbul', label: 'GMT+3 Istanbul' },
	{ value: 'Asia/Dubai', label: 'GMT+4 Dubai' },
	{ value: 'Asia/Karachi', label: 'GMT+5 Karachi' },
	{ value: 'Asia/Dhaka', label: 'GMT+6 Dhaka' },
	{ value: 'Asia/Bangkok', label: 'GMT+7 Bangkok' },
	{ value: 'Asia/Singapore', label: 'GMT+8 Singapore' },
	{ value: 'Asia/Tokyo', label: 'GMT+9 Tokyo' },
	{ value: 'Australia/Sydney', label: 'GMT+10 Sydney' },
	{ value: 'Pacific/Noumea', label: 'GMT+11 Noumea' },
	{ value: 'Pacific/Auckland', label: 'GMT+12 Auckland' },
	{ value: 'Pacific/Apia', label: 'GMT+13 Apia' },
	{ value: 'Pacific/Kiritimati', label: 'GMT+14 Kiritimati' },
	{ value: 'Atlantic/Azores', label: 'GMT-1 Azores' },
	{ value: 'Atlantic/Cape_Verde', label: 'GMT-1 Cape Verde' },
	{ value: 'Atlantic/South_Georgia', label: 'GMT-2 South Georgia' },
	{ value: 'America/Sao_Paulo', label: 'GMT-3 São Paulo' },
	{ value: 'America/New_York', label: 'GMT-5 New York' },
	{ value: 'America/Chicago', label: 'GMT-6 Chicago' },
	{ value: 'America/Denver', label: 'GMT-7 Denver' },
	{ value: 'America/Los_Angeles', label: 'GMT-8 Los Angeles' },
	{ value: 'America/Anchorage', label: 'GMT-9 Anchorage' },
	{ value: 'Pacific/Honolulu', label: 'GMT-10 Honolulu' },
	{ value: 'Pacific/Midway', label: 'GMT-11 Midway' },
	{ value: 'Pacific/Niue', label: 'GMT-11 Niue' }
]

/**
 * Interface for a time slot with start and end times
 *
 * @interface TimeSlot
 * @property start - Start time in HH:MM format
 * @property end - End time in HH:MM format
 */
interface TimeSlot {
	start: string
	end: string
}

/**
 * Interface for a day's availability configuration
 *
 * @interface DayAvailability
 * @property isAvailable - Whether the day is available for bookings
 * @property timeSlots - Array of time slots for the day
 */
interface DayAvailability {
	isAvailable: boolean
	timeSlots: TimeSlot[]
}

/**
 * Props interface for the WeeklyAvailability component
 *
 * @interface WeeklyAvailabilityProps
 * @property onComplete - Callback function called when availability is saved
 */
interface WeeklyAvailabilityProps {
	onComplete: () => void
}

/**
 * WeeklyAvailability Component
 *
 * A comprehensive component for configuring weekly availability, timezone,
 * meeting duration, and pricing. This is a crucial part of the booking
 * system setup that determines when users can be booked.
 *
 * FEATURES:
 * - Weekly availability configuration (7 days)
 * - Multiple time slots per day
 * - Timezone selection with 40+ options
 * - Meeting duration configuration
 * - Pricing setup with currency selection
 * - Auto-detection of user's timezone
 * - Persistent storage in database
 * - Loading and error states
 *
 * DATA STRUCTURE:
 * - Availability stored as array of 7 DayAvailability objects
 * - Each day has isAvailable boolean and timeSlots array
 * - Time slots use 24-hour format (HH:MM)
 *
 * @component
 * @example
 * ```tsx
 * <WeeklyAvailability onComplete={() => setCurrentStep(4)} />
 * ```
 */
export function WeeklyAvailability({ onComplete }: WeeklyAvailabilityProps) {
	// State variables for the availability configuration
	const [availability, setAvailability] = useState<DayAvailability[]>(
		daysOfWeek.map((day, index) => ({
			isAvailable: index >= 1 && index <= 5, // Monday to Friday are true by default
			timeSlots: [{ start: '09:00', end: '17:00' }] // Default 9 AM to 5 PM
		}))
	)

	// Create toast notification system
	const toast = useToast()
	// Create Supabase client for database operations
	const supabase = createSupabaseClient()

	// State variables for the form configuration
	const [currency, setCurrency] = useState('EUR')
	const [timeZone, setTimeZone] = useState('UTC/GMT+0')
	const [meetingPrice, setMeetingPrice] = useState('0')
	const [meetingDuration, setMeetingDuration] = useState('30')

	// State variables for the component status
	const [isLoading, setIsLoading] = useState(true)
	const [saveStatus, setSaveStatus] = useState<
		'idle' | 'loading' | 'success' | 'error'
	>('idle')
	const [statusMessage, setStatusMessage] = useState<string>('')

	/**
	 * Effect to auto-detect and set user's timezone
	 *
	 * Uses the browser's timezone API to automatically select
	 * the appropriate timezone from the available options.
	 */
	useEffect(() => {
		// Set the time zone to the user's time zone
		const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
		const matchingTimeZone = timezones.find(
			(tz) => tz.value === userTimeZone
		)
		if (matchingTimeZone) {
			setTimeZone(matchingTimeZone.value)
		}
	}, [])

	/**
	 * Effect to load existing schedule data from database
	 *
	 * Fetches the user's saved schedule configuration and
	 * populates the form with existing values.
	 */
	useEffect(() => {
		// Fetch the user's schedule from the database
		// and set the state variables to the schedule data
		setIsLoading(true)
		const loadUserSchedule = async () => {
			const schedule = await fetchUserSchedule()
			if (schedule) {
				setAvailability(schedule.weekly_availability)
				setTimeZone(schedule.time_zone)
				setMeetingDuration(schedule.meeting_duration.toString())
				setMeetingPrice(schedule.meeting_price.toString())
				setCurrency(schedule.currency)
			}
			setIsLoading(false)
		}

		loadUserSchedule()
	}, [])

	/**
	 * Fetches the user's schedule from the database
	 *
	 * Retrieves the current user's schedule configuration
	 * from the 'schedules' table in Supabase.
	 *
	 * @returns Promise<ScheduleData | null> - The schedule data or null if not found
	 */
	const fetchUserSchedule = async () => {
		const {
			data: { user }
		} = await supabase.auth.getUser()

		if (!user) {
			console.error('No user logged in')
			return null
		}

		const { data, error } = await supabase
			.from('schedules')
			.select('*')
			.eq('user_id', user.id)
			.single()

		if (error) {
			console.error('Error fetching schedule:', error)
			return null
		}

		return data
	}

	/**
	 * Toggles the availability of a specific day
	 *
	 * @param index - The index of the day to toggle (0-6, Sunday-Saturday)
	 */
	const handleDayToggle = (index: number) => {
		// Toggle the availability of a day
		setAvailability((prev) =>
			prev.map((day, i) =>
				i === index ? { ...day, isAvailable: !day.isAvailable } : day
			)
		)
	}

	/**
	 * Updates the start or end time of a specific time slot
	 *
	 * @param dayIndex - The index of the day (0-6)
	 * @param slotIndex - The index of the time slot within the day
	 * @param field - Whether to update 'start' or 'end' time
	 * @param value - The new time value in HH:MM format
	 */
	const handleTimeChange = (
		dayIndex: number,
		slotIndex: number,
		field: 'start' | 'end',
		value: string
	) => {
		// Handle the time change for a time slot
		setAvailability((prev) =>
			prev.map((day, i) =>
				i === dayIndex
					? {
							...day,
							timeSlots: day.timeSlots.map((slot, j) =>
								j === slotIndex
									? { ...slot, [field]: value }
									: slot
							)
					  }
					: day
			)
		)
	}

	/**
	 * Adds a new time slot to a specific day
	 *
	 * @param dayIndex - The index of the day to add the slot to (0-6)
	 */
	const addTimeSlot = (dayIndex: number) => {
		// Add a time slot to a day
		setAvailability((prev) =>
			prev.map((day, i) =>
				i === dayIndex
					? {
							...day,
							timeSlots: [
								...day.timeSlots,
								{ start: '09:00', end: '17:00' } // Default new slot
							]
					  }
					: day
			)
		)
	}

	const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
		// Remove a time slot from a day
		setAvailability((prev) =>
			prev.map((day, i) =>
				i === dayIndex
					? {
							...day,
							timeSlots: day.timeSlots.filter(
								(_, j) => j !== slotIndex
							)
					  }
					: day
			)
		)
	}

	const handleSave = async () => {
		// Save the availability to the database
		setSaveStatus('loading')
		setStatusMessage('Saving your availability...')

		// Get the current user
		const {
			data: { user }
		} = await supabase.auth.getUser()

		// Handle user feedback if the user is not logged in
		if (!user) {
			toast.toast({
				title: 'Error',
				description: 'You must be logged in to save your availability.',
				color: 'error'
			})
			return
		}

		// Create the availability data object
		const availabilityData = {
			user_id: user.id,
			weekly_availability: availability,
			time_zone: timeZone,
			meeting_duration: parseInt(meetingDuration),
			meeting_price: parseFloat(meetingPrice),
			currency: currency
		}

		// Save the availability to the database
		const { data, error } = await supabase
			.from('schedules')
			.upsert(availabilityData, { onConflict: 'user_id' })
			.select()

		if (error) {
			console.error('Error saving availability:', error)
			toast.toast({
				title: 'Error',
				description: 'You must be logged in to save your availability.',
				color: 'error'
			})
		} else {
			console.log('Availability saved:', data)
			toast.toast({
				title: 'Bravo!',
				description: 'Your availability has been saved.',
				color: 'success'
			})
		}

		// Move to the next step
		onComplete()
		// Reset status
		setSaveStatus('idle')
		setStatusMessage('')
	}

	if (isLoading) {
		return (
			<div className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
				<Spinner />
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<div className="space-y-4 bg-gray-100 p-8 rounded-md">
				<p className="text-xl font-bold">Weekly hours</p>
				{availability.map((day, dayIndex) => (
					<div key={dayIndex} className="flex flex-col space-y-2">
						<div className="flex items-center space-x-4">
							<div className="flex w-6 items-center justify-center">
								<Checkbox
									id={`day-${dayIndex}`}
									checked={day.isAvailable}
									onCheckedChange={() =>
										handleDayToggle(dayIndex)
									}
								/>
							</div>
							<Label
								htmlFor={`day-${dayIndex}`}
								className="font-bold w-14"
							>
								{daysOfWeek[dayIndex]}
							</Label>

							{day.isAvailable && day.timeSlots.length > 0 ? (
								<div className="flex items-center space-x-2 flex-grow">
									<Input
										type="time"
										value={day.timeSlots[0].start}
										onChange={(e) =>
											handleTimeChange(
												dayIndex,
												0,
												'start',
												e.target.value
											)
										}
										className="w-24"
									/>
									<span>-</span>
									<Input
										type="time"
										value={day.timeSlots[0].end}
										onChange={(e) =>
											handleTimeChange(
												dayIndex,
												0,
												'end',
												e.target.value
											)
										}
										className="w-24"
									/>
									{day.timeSlots.length === 1 && (
										<Button
											variant="ghost"
											size="icon"
											onClick={() =>
												removeTimeSlot(dayIndex, 0)
											}
										>
											×
										</Button>
									)}
								</div>
							) : (
								<p className="font-light text-gray-500 flex-grow">
									{day.isAvailable
										? 'No time slots'
										: 'Unavailable'}
								</p>
							)}

							{day.isAvailable && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => addTimeSlot(dayIndex)}
									className="text-xl font-extralight"
								>
									+
								</Button>
							)}
						</div>

						{day.isAvailable && day.timeSlots.length > 1 && (
							<div className="ml-28 space-y-2">
								{day.timeSlots
									.slice(1)
									.map((slot, slotIndex) => (
										<div
											key={slotIndex + 1}
											className="flex items-center space-x-2 pl-30"
										>
											<Input
												type="time"
												value={slot.start}
												onChange={(e) =>
													handleTimeChange(
														dayIndex,
														slotIndex + 1,
														'start',
														e.target.value
													)
												}
												className="w-24"
											/>
											<span>-</span>
											<Input
												type="time"
												value={slot.end}
												onChange={(e) =>
													handleTimeChange(
														dayIndex,
														slotIndex + 1,
														'end',
														e.target.value
													)
												}
												className="w-24"
											/>
											<Button
												variant="ghost"
												size="icon"
												onClick={() =>
													removeTimeSlot(
														dayIndex,
														slotIndex + 1
													)
												}
											>
												×
											</Button>
										</div>
									))}
							</div>
						)}
					</div>
				))}
			</div>

			<div className="space-y-4">
				<div>
					<Label htmlFor="timezone">Time Zone</Label>
					<Select value={timeZone} onValueChange={setTimeZone}>
						<SelectTrigger id="timezone">
							<SelectValue placeholder="Select time zone" />
						</SelectTrigger>
						<SelectContent>
							{timezones.map((tz) => (
								<SelectItem key={tz.value} value={tz.value}>
									{tz.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div>
					<Label htmlFor="duration">Meeting Duration</Label>
					<Select
						value={meetingDuration}
						onValueChange={setMeetingDuration}
					>
						<SelectTrigger id="duration">
							<SelectValue placeholder="Select meeting duration" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="15">15 minutes</SelectItem>
							<SelectItem value="30">30 minutes</SelectItem>
							<SelectItem value="60">1 hour</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div>
				<Label htmlFor="price">Meeting Price</Label>
				<div className="flex items-center space-x-2">
					<Select value={currency} onValueChange={setCurrency}>
						<SelectTrigger id="currency" className="w-[80px]">
							<SelectValue placeholder="Currency" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="EUR">EUR</SelectItem>
							<SelectItem value="USD">USD</SelectItem>
						</SelectContent>
					</Select>
					<Input
						type="number"
						id="price"
						placeholder="Enter price"
						value={meetingPrice}
						onChange={(e) => setMeetingPrice(e.target.value)}
						min="0"
						step="0.01"
						className="flex-grow"
					/>
				</div>
			</div>

			<Button
				onClick={handleSave}
				className="h-12 w-full shadow-sm bg-accent hover:bg-accent hover:opacity-90 text-md"
				disabled={saveStatus === 'loading'}
			>
				{saveStatus === 'loading' ? 'Guardando...' : 'Continuar'}
			</Button>
		</div>
	)
}
