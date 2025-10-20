'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import TimeSlots from '@/components/TimeSlots'
import { ConfirmationForm } from '@/components/ConfirmationForm'
import CalendarInfoStep from '@/components/CalendarInfoStep'
import { parse, format, startOfMonth } from 'date-fns'
import { TimeSlot } from '@/lib/calendar/calendar'
import { Spinner } from '@/components/ui/spinner'
import { hasVisitedBooking, markVisitedBooking } from '@/lib/utils'
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
	consultationType: 'first' | 'followup'
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
		bookingConfirmed: false,
		consultationType: 'followup'
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

	const handleConsultationTypeChange = (v: 'first' | 'followup') => {
		setState((prev) => ({ ...prev, consultationType: v }))
	}

	// Initialize consultation type smart default based on visit flag
	const consultInitRef = useRef(false)
	useEffect(() => {
		if (consultInitRef.current) return
		if (!state.userProfile) return
		const pricing = state.userProfile?.pricing
		const firstExists =
			pricing?.first_consultation_amount != null && !Number.isNaN(Number(pricing.first_consultation_amount))
		const followupExists = pricing?.amount != null && !Number.isNaN(Number(pricing.amount))
		const isReturning = hasVisitedBooking(String(username))
		const next: 'first' | 'followup' = !isReturning && firstExists ? 'first' : followupExists ? 'followup' : 'first'
		setState((prev) => ({ ...prev, consultationType: next }))
		markVisitedBooking(String(username))
		consultInitRef.current = true
	}, [state.userProfile, username])

	// Removed legacy inline component (CalendarInfocard) in favor of CalendarInfoStep

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
								<CalendarInfoStep
									profile={state.userProfile!}
									pricing={state.userProfile?.pricing}
									calendar={{
										availableSlots: state.availableSlots,
										selectedDate: state.selectedDate,
										onSelectDate: handleDateSelect,
										onMonthChange: handleMonthChange,
										username: username as string,
										initialMonth: state.currentMonth
									}}
									consultationType={state.consultationType}
									onConsultationTypeChange={handleConsultationTypeChange}
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
								selectedConsultationType={state.consultationType}
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
