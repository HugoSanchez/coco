'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'

import Calendar from '@/components/Calendar'
import TimeSlots from '@/components/TimeSlots'
import { ConfirmationForm } from '@/components/ConfirmationForm'
import { Clock, ChevronLeft } from 'lucide-react'
// Drawer removed in favor of inline 3-step flow
import { Button } from '@/components/ui/button'
import { parse, format, startOfMonth } from 'date-fns'
import { TimeSlot } from '@/lib/calendar/calendar'
import { Spinner } from '@/components/ui/spinner'
import { UserProfileWithSchedule } from '@/lib/db/profiles'

// Force dynamic rendering since this page uses useSearchParams and useParams
export const dynamic = 'force-dynamic'

interface PageState {
	isLoading: boolean
	isLoadingSlots: boolean
	error: string | null
	userProfile: UserProfileWithSchedule | null // Update this type
	availableSlots: { [day: string]: TimeSlot[] }
	selectedDate: Date | null
	selectedSlot: TimeSlot | null
	currentMonth: Date
	userTimeZone: string
	bookingConfirmed: boolean
}

function BookingPageContent() {
	// Params & Navigation
	const router = useRouter()
	const { username } = useParams()
	const searchParams = useSearchParams()

	// Initialize all state in one object for better management
	const [state, setState] = useState<PageState>({
		isLoading: true,
		isLoadingSlots: true,
		error: null,
		userProfile: null,
		availableSlots: {},
		selectedDate: null,
		selectedSlot: null,
		currentMonth: startOfMonth(new Date()),
		userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		bookingConfirmed: false
	})

	// Fetch user profile and initial data
	const initRef = useRef(false)
	useEffect(() => {
		if (initRef.current) return
		initRef.current = true
		async function initializePageData() {
			try {
				// Derive URL parameters
				const monthParam = searchParams.get('month')
				const dateParam = searchParams.get('date')
				const monthToFetch = monthParam ? parse(monthParam, 'yyyy-MM', new Date()) : startOfMonth(new Date())
				const selectedDate = dateParam ? parse(dateParam, 'yyyy-MM-dd', new Date()) : null

				// Fire profile and slots in parallel; render as soon as profile arrives
				const profilePromise = fetch(`/api/public/profile?username=${username}`)
				const slotsPromise = fetch(
					`/api/calendar/available-slots?username=${username}&month=${monthToFetch.toISOString()}`
				)

				const profileRes = await profilePromise
				if (!profileRes.ok) throw new Error('Profile not found')
				const profileData = await profileRes.json()

				setState((prev) => ({
					...prev,
					isLoading: false,
					isLoadingSlots: true,
					userProfile: profileData,
					currentMonth: monthToFetch,
					selectedDate
				}))

				const slotsRes = await slotsPromise
				if (!slotsRes.ok) throw new Error('Failed to fetch available slots')
				const slotsPayload = await slotsRes.json()
				const availableSlots = slotsPayload?.slotsByDay || {}
				setState((prev) => ({ ...prev, availableSlots, isLoadingSlots: false }))
			} catch (error) {
				console.error('Error initializing page:', error)
				setState((prev) => ({
					...prev,
					isLoading: false,
					isLoadingSlots: false,
					error: error instanceof Error ? error.message : 'An error occurred'
				}))
			}
		}

		initializePageData()
	}, [username, searchParams])

	// URL update handler
	const updateURL = (month: Date, date: Date | null) => {
		const newParams = new URLSearchParams(searchParams)
		newParams.set('month', format(month, 'yyyy-MM'))
		date ? newParams.set('date', format(date, 'yyyy-MM-dd')) : newParams.delete('date')
		router.push(`/${username}?${newParams.toString()}`)
	}

	// Event handlers
	const slotsInFlightRef = useRef<string | null>(null)
	const handleMonthChange = async (newMonth: Date) => {
		updateURL(newMonth, state.selectedDate)
		setState((prev) => ({ ...prev, currentMonth: newMonth, isLoadingSlots: true }))
		const key = `${username}:${newMonth.toISOString()}`
		if (slotsInFlightRef.current === key) return
		slotsInFlightRef.current = key
		try {
			const res = await fetch(
				`/api/calendar/available-slots?username=${username}&month=${newMonth.toISOString()}`
			)
			if (!res.ok) throw new Error('Failed to fetch available slots')
			const payload = await res.json()
			const nextSlots = payload?.slotsByDay || {}
			setState((prev) => ({ ...prev, availableSlots: nextSlots, isLoadingSlots: false }))
		} catch (error) {
			console.error('Error fetching available slots:', error)
			setState((prev) => ({ ...prev, isLoadingSlots: false }))
		}
		if (slotsInFlightRef.current === key) slotsInFlightRef.current = null
	}

	const handleDateSelect = (date: Date) => {
		updateURL(state.currentMonth, date)
		setState((prev) => ({
			...prev,
			selectedDate: date
		}))
	}

	const handleSlotSelect = (slot: TimeSlot) => {
		setState((prev) => ({ ...prev, selectedSlot: slot }))
	}

	const handleBack = () => {
		if (state.bookingConfirmed) {
			// From success screen: return to calendar and clear URL param
			updateURL(state.currentMonth, null)
			setState((prev) => ({
				...prev,
				selectedSlot: null,
				selectedDate: null,
				bookingConfirmed: false
			}))
		} else if (state.selectedSlot) {
			setState((prev) => ({ ...prev, selectedSlot: null }))
		} else {
			updateURL(state.currentMonth, null)
			setState((prev) => ({
				...prev,
				selectedDate: null
			}))
		}
	}

	// Inline component: Profile info card
	function CalendarInfocard({
		name,
		description,
		minutes,
		profile,
		availableSlots,
		selectedDate,
		onSelectDate,
		onMonthChange,
		usernameStr
	}: {
		name: string
		description: string | null
		minutes: number | null
		profile: UserProfileWithSchedule
		availableSlots: { [day: string]: TimeSlot[] }
		selectedDate: Date | null
		onSelectDate: (date: Date) => void
		onMonthChange: (newMonth: Date) => void
		usernameStr: string
	}) {
		return (
			<>
				{/* Header Section */}
				<div className="flex flex-col items-center mb-12 space-y-4">
					{profile.profile_picture_url && window.innerWidth < 768 && (
						<div className="flex items-center justify-center">
							<img
								src={profile.profile_picture_url}
								alt={profile.name}
								className="lg:h-8 lg:w-8 h-8 w-8 mr-3 lg:mr-0 rounded-full object-cover"
							/>
						</div>
					)}
					<div className="">
						<h2 className="text-2xl font-light text-center">Agenda una cita con {profile.name}</h2>
					</div>
				</div>
				{/* Calendar Section */}
				<Calendar
					username={usernameStr}
					selectedDay={selectedDate}
					availableSlots={availableSlots}
					onSelectDate={onSelectDate}
					onMonthChange={onMonthChange}
					initialMonth={state.currentMonth}
				/>
				{/* About Section */}

				<div className="bg-gray-50 p-2 rounded-lg mt-10">
					<h2 className="text-lg font-semibold mb-2">Sobre {name}</h2>
					{(profile.description || description) && (profile.description || description)?.toString().trim() ? (
						<p className="text-md text-gray-700 font-light mb-6 whitespace-pre-line">
							{profile.description || description}
						</p>
					) : null}
					<div className="flex flex-row items-center">
						<Clock className="w-4 h-4 mr-2" />
						<p className="font-light text-gray-700">{minutes || 60} minutos</p>
					</div>
				</div>
			</>
		)
	}

	function BackButtonComponent() {
		if (state.selectedSlot || state.selectedDate) {
			return (
				<button onClick={handleBack} className="mb-4 text-teal-600 hover:underline flex items-center gap-1">
					<span>←</span>
					<span>Volver</span>
				</button>
			)
		}
		return null
	}

	// Render loading state
	if (state.isLoading) {
		return (
			<div className="container flex justify-center items-center min-h-screen">
				<Spinner size="sm" color="dark" />
			</div>
		)
	}

	// Render error state
	if (state.error || !state.userProfile) {
		return (
			<div className="container flex justify-center items-center min-h-screen">
				<div className="text-center">
					<h1 className="text-2xl font-semibold mb-2">Calendar Not Found</h1>
					<p className="text-gray-600">
						The calendar you&apos;re looking for doesn&apos;t exist or has been removed.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="container flex justify-center px-6 py-20 md:py-20 min-h-screen">
			<div className="mb:h-[80vh] md:max-w-[30vw] overflow-visible">
				<div className="flex flex-col space-y-8 md:space-y-16">
					<div className="w-full">
						{/* Back button on steps 2 and 3 */}
						<BackButtonComponent />

						{!state.selectedDate && (
							<>
								<CalendarInfocard
									name={state.userProfile.name}
									description={state.userProfile.description}
									minutes={state.userProfile.schedules?.meeting_duration as any}
									profile={state.userProfile!}
									availableSlots={state.availableSlots}
									selectedDate={state.selectedDate}
									onSelectDate={handleDateSelect}
									onMonthChange={handleMonthChange}
									usernameStr={username as string}
								/>
							</>
						)}

						{state.selectedDate && !state.selectedSlot && (
							<TimeSlots
								date={state.selectedDate}
								availableSlots={state.availableSlots}
								userTimeZone={state.userTimeZone}
								onSelectSlot={handleSlotSelect}
							/>
						)}

						{state.selectedSlot && (
							<ConfirmationForm
								selectedSlot={state.selectedSlot}
								userTimeZone={state.userTimeZone}
								practitionerPricing={state.userProfile?.pricing}
								username={username as string}
								onConfirm={async (details) => {
									// Mark confirmation complete to adjust back-button behavior
									setState((prev) => ({ ...prev, bookingConfirmed: true }))
								}}
								onCancel={() => setState((prev) => ({ ...prev, selectedSlot: null }))}
							/>
						)}
					</div>
				</div>
			</div>

			{/* Drawer removed */}
		</div>
	)
}

export default function BookingPage() {
	return (
		<Suspense fallback={<div className="container flex justify-center items-center min-h-screen">Loading...</div>}>
			<BookingPageContent />
		</Suspense>
	)
}
