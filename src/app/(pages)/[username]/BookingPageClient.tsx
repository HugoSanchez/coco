'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import TimeSlots from '@/components/TimeSlots'
import { ConfirmationForm } from '@/components/ConfirmationForm'
import CalendarInfoStep from '@/components/CalendarInfoStep'
import { parse, format, startOfMonth } from 'date-fns'
import { TimeSlot } from '@/lib/calendar/calendar'
import { Spinner } from '@/components/ui/spinner'
import { hasVisitedBooking, markVisitedBooking } from '@/lib/utils'
import { UserProfileWithSchedule } from '@/lib/db/profiles'

interface PageState {
	isLoading: boolean
	isLoadingSlots: boolean
	error: string | null
	userProfile: UserProfileWithSchedule | null
	availableSlots: { [day: string]: TimeSlot[] }
	firstSlots?: { [day: string]: TimeSlot[] }
	selectedDate: Date | null
	selectedSlot: TimeSlot | null
	currentMonth: Date
	userTimeZone: string
	bookingConfirmed: boolean
	consultationType: 'first' | 'followup'
}

export default function BookingPageClient({ username }: { username: string }) {
	const router = useRouter()
	const searchParams = useSearchParams()

	const [state, setState] = useState<PageState>({
		isLoading: true,
		isLoadingSlots: true,
		error: null,
		userProfile: null,
		availableSlots: {},
		firstSlots: {},
		selectedDate: null,
		selectedSlot: null,
		currentMonth: startOfMonth(new Date()),
		userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		bookingConfirmed: false,
		consultationType: 'followup'
	})

	const initRef = useRef(false)
	useEffect(() => {
		if (initRef.current) return
		initRef.current = true
		async function initializePageData() {
			try {
				const monthParam = searchParams.get('month')
				const dateParam = searchParams.get('date')
				const monthToFetch = monthParam ? parse(monthParam, 'yyyy-MM', new Date()) : startOfMonth(new Date())
				const selectedDate = dateParam ? parse(dateParam, 'yyyy-MM-dd', new Date()) : null

				const profilePromise = fetch(`/api/public/profile?username=${username}`)
				const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
				const monthLabel = format(monthToFetch, 'yyyy-MM')
				const slotsPromise = fetch(
					`/api/calendar/available-slots?username=${username}&month=${monthLabel}&tz=${encodeURIComponent(tz)}`
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
				const firstSlots = slotsPayload?.firstSlotsByDay || {}
				setState((prev) => ({ ...prev, availableSlots, firstSlots, isLoadingSlots: false }))
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

	const updateURL = (month: Date, date: Date | null) => {
		const newParams = new URLSearchParams(searchParams)
		newParams.set('month', format(month, 'yyyy-MM'))
		date ? newParams.set('date', format(date, 'yyyy-MM-dd')) : newParams.delete('date')
		router.push(`/${username}?${newParams.toString()}`)
	}

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
			const nextFirstSlots = payload?.firstSlotsByDay || {}
			setState((prev) => ({
				...prev,
				availableSlots: nextSlots,
				firstSlots: nextFirstSlots,
				isLoadingSlots: false
			}))
		} catch (error) {
			console.error('Error fetching available slots:', error)
			setState((prev) => ({ ...prev, isLoadingSlots: false }))
		}
		if (slotsInFlightRef.current === key) slotsInFlightRef.current = null
	}

	const handleDateSelect = (date: Date) => {
		updateURL(state.currentMonth, date)
		setState((prev) => ({ ...prev, selectedDate: date }))
	}

	const handleSlotSelect = (slot: TimeSlot) => {
		setState((prev) => ({ ...prev, selectedSlot: slot }))
	}

	const handleBack = () => {
		if (state.bookingConfirmed) {
			updateURL(state.currentMonth, null)
			setState((prev) => ({ ...prev, selectedSlot: null, selectedDate: null, bookingConfirmed: false }))
			;(async () => {
				try {
					setState((prev) => ({ ...prev, isLoadingSlots: true }))
					const res = await fetch(
						`/api/calendar/available-slots?username=${username}&month=${state.currentMonth.toISOString()}`
					)
					if (!res.ok) throw new Error('Failed to fetch available slots')
					const payload = await res.json()
					const nextSlots = payload?.slotsByDay || {}
					const nextFirstSlots = payload?.firstSlotsByDay || {}
					setState((prev) => ({
						...prev,
						availableSlots: nextSlots,
						firstSlots: nextFirstSlots,
						isLoadingSlots: false
					}))
				} catch (error) {
					console.error('Error refreshing available slots:', error)
					setState((prev) => ({ ...prev, isLoadingSlots: false }))
				}
			})()
		} else if (state.selectedSlot) {
			setState((prev) => ({ ...prev, selectedSlot: null }))
		} else {
			updateURL(state.currentMonth, null)
			setState((prev) => ({ ...prev, selectedDate: null }))
		}
	}

	const handleConsultationTypeChange = (v: 'first' | 'followup') => {
		setState((prev) => ({ ...prev, consultationType: v }))
	}

	const consultInitRef = useRef(false)
	useEffect(() => {
		if (consultInitRef.current) return
		if (!state.userProfile) return

		// Special case: for "hugo" username, always use 'first' consultation type
		if (username === 'hugo') {
			setState((prev) => ({ ...prev, consultationType: 'first' }))
			consultInitRef.current = true
			return
		}

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

	if (state.isLoading) {
		return (
			<div className="container flex justify-center items-center min-h-screen">
				<Spinner size="sm" color="dark" />
			</div>
		)
	}

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

	return (
		<div className="container flex justify-center px-6 py-20 md:py-20 min-h-screen">
			<div className="mb:h-[80vh] md:max-w-[30vw] overflow-visible">
				<div className="flex flex-col space-y-8 md:space-y-16">
					<div className="w-full">
						<BackButtonComponent />

						{!state.selectedDate && (
							<>
								<CalendarInfoStep
									profile={state.userProfile!}
									pricing={state.userProfile?.pricing}
									calendar={{
										availableSlots:
											state.consultationType === 'first' && state.firstSlots
												? (state.firstSlots as { [day: string]: TimeSlot[] })
												: state.availableSlots,
										selectedDate: state.selectedDate,
										onSelectDate: handleDateSelect,
										onMonthChange: handleMonthChange,
										username,
										initialMonth: state.currentMonth
									}}
									consultationType={state.consultationType}
									onConsultationTypeChange={username === 'hugo' ? undefined : handleConsultationTypeChange}
								/>
							</>
						)}

						{state.selectedDate && !state.selectedSlot && (
							<TimeSlots
								date={state.selectedDate}
								availableSlots={
									state.consultationType === 'first' && state.firstSlots
										? (state.firstSlots as { [day: string]: TimeSlot[] })
										: state.availableSlots
								}
								userTimeZone={state.userTimeZone}
								onSelectSlot={handleSlotSelect}
							/>
						)}

						{state.selectedSlot && (
							<ConfirmationForm
								selectedSlot={state.selectedSlot}
								userTimeZone={state.userTimeZone}
								practitionerPricing={state.userProfile?.pricing}
								username={username}
								selectedConsultationType={state.consultationType}
								onConfirm={async () => {
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
