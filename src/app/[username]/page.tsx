'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Calendar from '@/components/Calendar'
import TimeSlots from '@/components/TimeSlots'
import { ConfirmationForm } from '@/components/ConfirmationForm'
import { Clock, ChevronLeft } from 'lucide-react'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { parse, format, startOfMonth } from 'date-fns'
import { TimeSlot } from '@/lib/calendar'
import {
	getUserProfileAndScheduleByUsername,
	UserProfileWithSchedule
} from '@/lib/db/profiles'

interface UserProfile {
	id: string
	name: string
	description: string
	profile_picture_url?: string
	meeting_duration: number
}

interface PageState {
	isLoading: boolean
	error: string | null
	userProfile: UserProfileWithSchedule | null // Update this type
	availableSlots: { [day: string]: TimeSlot[] }
	selectedDate: Date | null
	selectedSlot: TimeSlot | null
	currentMonth: Date
	isDrawerOpen: boolean
	userTimeZone: string
}

export default function BookingPage() {
	// Params & Navigation
	const router = useRouter()
	const { username } = useParams()
	const searchParams = useSearchParams()

	// Initialize all state in one object for better management
	const [state, setState] = useState<PageState>({
		isLoading: true,
		error: null,
		userProfile: null,
		availableSlots: {},
		selectedDate: null,
		selectedSlot: null,
		currentMonth: startOfMonth(new Date()),
		isDrawerOpen: false,
		userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
	})

	// Fetch user profile and initial data
	useEffect(() => {
		async function initializePageData() {
			try {
				// Get user profile
				const profileData = await getUserProfileAndScheduleByUsername(
					username as string
				)
				// Handle URL parameters
				const monthParam = searchParams.get('month')
				const dateParam = searchParams.get('date')
				// Get the month to fetch
				const monthToFetch = monthParam
					? parse(monthParam, 'yyyy-MM', new Date())
					: startOfMonth(new Date())
				// Get the date to fetch
				const selectedDate = dateParam
					? parse(dateParam, 'yyyy-MM-dd', new Date())
					: null

				// Fetch available slots
				const response = await fetch(
					`/api/available-slots?username=${username}&month=${monthToFetch.toISOString()}`
				)
				if (!response.ok)
					throw new Error('Failed to fetch available slots')
				const availableSlots = await response.json()
				console.log('availableSlots:', availableSlots)

				setState((prev) => ({
					...prev,
					isLoading: false,
					userProfile: profileData,
					availableSlots,
					currentMonth: monthToFetch,
					selectedDate,
					isDrawerOpen: !!selectedDate
				}))
			} catch (error) {
				console.error('Error initializing page:', error)
				setState((prev) => ({
					...prev,
					isLoading: false,
					error:
						error instanceof Error
							? error.message
							: 'An error occurred'
				}))
			}
		}

		initializePageData()
	}, [username, searchParams])

	// URL update handler
	const updateURL = (month: Date, date: Date | null) => {
		const newParams = new URLSearchParams(searchParams)
		newParams.set('month', format(month, 'yyyy-MM'))
		date
			? newParams.set('date', format(date, 'yyyy-MM-dd'))
			: newParams.delete('date')
		router.push(`/${username}?${newParams.toString()}`)
	}

	// Event handlers
	const handleMonthChange = async (newMonth: Date) => {
		updateURL(newMonth, state.selectedDate)
		setState((prev) => ({ ...prev, currentMonth: newMonth }))

		try {
			const response = await fetch(
				`/api/available-slots?username=${username}&month=${newMonth.toISOString()}`
			)
			if (!response.ok) throw new Error('Failed to fetch available slots')
			const availableSlots = await response.json()
			setState((prev) => ({ ...prev, availableSlots }))
		} catch (error) {
			console.error('Error fetching available slots:', error)
		}
	}

	const handleDateSelect = (date: Date) => {
		updateURL(state.currentMonth, date)
		setState((prev) => ({
			...prev,
			selectedDate: date,
			isDrawerOpen: true
		}))
	}

	const handleSlotSelect = (slot: TimeSlot) => {
		setState((prev) => ({ ...prev, selectedSlot: slot }))
	}

	const handleBack = () => {
		if (state.selectedSlot) {
			setState((prev) => ({ ...prev, selectedSlot: null }))
		} else {
			setState((prev) => ({
				...prev,
				selectedDate: null,
				isDrawerOpen: false
			}))
		}
	}

	// Render loading state
	if (state.isLoading) {
		return (
			<div className="container flex justify-center items-center min-h-screen">
				Loading...
			</div>
		)
	}

	// Render error state
	if (state.error || !state.userProfile) {
		return (
			<div className="container flex justify-center items-center min-h-screen">
				<div className="text-center">
					<h1 className="text-2xl font-semibold mb-2">
						Calendar Not Found
					</h1>
					<p className="text-gray-600">
						The calendar you&apos;re looking for doesn&apos;t exist
						or has been removed.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="container flex justify-center px-6 py-24 md:py-20 min-h-screen">
			<div className="mb:h-[80vh] md:max-w-[30vw] overflow-hidden">
				<div className="flex flex-col space-y-8 md:space-y-16">
					{/* Profile Section */}
					<div className="flex flex-col">
						<div className="flex items-center gap-4 mb-4">
							{state.userProfile.profile_picture_url && (
								<Image
									src={state.userProfile.profile_picture_url}
									alt={state.userProfile.name}
									width={60}
									height={60}
									className="lg:h-16 lg:w-16 h-8 w-8 rounded-full"
								/>
							)}
							<h2 className="text-3xl font-light">
								Book an appointment with{' '}
								{state.userProfile.name}
							</h2>
						</div>
					</div>

					{/* Calendar Section */}
					<div className="w-full">
						<Calendar
							username={username as string}
							selectedDay={state.selectedDate}
							availableSlots={state.availableSlots}
							onSelectDate={handleDateSelect}
							onMonthChange={handleMonthChange}
						/>
					</div>

					{/* Profile Info Section */}
					<div className="bg-gray-50 p-6 rounded-lg">
						<h2 className="text-lg font-semibold mb-2">
							About {state.userProfile.name}
						</h2>
						<p className="text-md text-gray-700 font-light mb-6">
							{state.userProfile.description}
						</p>
						<div className="flex flex-row items-center">
							<Clock className="w-4 h-4 mr-2" />
							<p className="font-light text-gray-700">
								{state.userProfile.schedules
									?.meeting_duration || 60}{' '}
								minutes
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Time Slots Drawer */}
			<Drawer
				direction="right"
				open={state.isDrawerOpen}
				onOpenChange={(open) =>
					setState((prev) => ({ ...prev, isDrawerOpen: open }))
				}
			>
				<DrawerContent className="w-full sm:max-w-md bg-gray-50">
					<div className="p-4">
						<Button
							variant="ghost"
							onClick={handleBack}
							className="mb-4"
						>
							<ChevronLeft className="mr-2 h-4 w-4" />
							Back
						</Button>

						{state.selectedSlot ? (
							<ConfirmationForm
								selectedSlot={state.selectedSlot}
								userTimeZone={state.userTimeZone}
								onConfirm={async (details) => {
									// Handle booking confirmation
									console.log('Booking details:', details)
								}}
								onCancel={() =>
									setState((prev) => ({
										...prev,
										selectedSlot: null
									}))
								}
							/>
						) : (
							<TimeSlots
								date={state.selectedDate}
								availableSlots={state.availableSlots}
								userTimeZone={state.userTimeZone}
								onSelectSlot={handleSlotSelect}
							/>
						)}
					</div>
				</DrawerContent>
			</Drawer>
		</div>
	)
}

/**
 *
 *
 * <div className="md:w-1/2 mb-6 md:mb-0k">
                <div className="md:w-1/2 p-6">
                    <TimeSlots
                    date={selectedDate}
                    availableSlots={availableSlots}
                    onSelectSlot={(slot) => {
                        // Handle slot selection
                    }}
                    />
                </div>
                </div>
 *
 *  <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700">Time zone</label>
              <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                <option>Central European Time (15:12)</option>

                </select>
                </div>
 *
 */
