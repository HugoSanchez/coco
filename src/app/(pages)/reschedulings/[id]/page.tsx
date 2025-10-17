'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Calendar from '@/components/Calendar'
import TimeSlots from '@/components/TimeSlots'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { formatSpanishDateTimeExact } from '@/lib/dates/format'
import { FaCheckCircle } from 'react-icons/fa'

interface RescheduleState {
	isLoading: boolean
	isLoadingSlots: boolean
	error: string | null
	username: string | null
	availableSlots: { [day: string]: Array<{ start: string; end: string }> }
	selectedDate: Date | null
	selectedSlot: { start: string; end: string } | null
	userTimeZone: string
	isSubmitting: boolean
	bookingConfirmed: boolean
}

export default function ReschedulePage() {
	const { id } = useParams()
	const params = useSearchParams()
	const sig = params.get('sig') || ''

	const [state, setState] = useState<RescheduleState>({
		isLoading: true,
		isLoadingSlots: true,
		error: null,
		username: null,
		availableSlots: {},
		selectedDate: null,
		selectedSlot: null,
		userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		isSubmitting: false,
		bookingConfirmed: false
	})

	const slotsInFlightRef = useRef<string | null>(null)

	// Initial load: validate link and get username + booking info
	useEffect(() => {
		const load = async () => {
			try {
				const res = await fetch(`/api/public/bookings/${id}/context?sig=${encodeURIComponent(sig)}`)
				if (!res.ok) {
					const payload = await res.json().catch(() => ({}))
					throw new Error(payload?.error || 'invalid_link')
				}
				const ctx = await res.json()
				console.log('[Reschedule] context', ctx)
				// Some users might not have username; fall back to userId by switching endpoint if needed
				setState((prev) => ({ ...prev, isLoading: false, username: ctx.username }))
				// Kick off initial month slots with known username
				await handleMonthChange(new Date(), ctx.username)
			} catch (e) {
				setState((prev) => ({ ...prev, isLoading: false, error: 'Enlace no válido o caducado.' }))
			}
		}
		load()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id, sig])

	const handleMonthChange = async (newMonth: Date, usernameOverride?: string | null) => {
		const uname = usernameOverride ?? state.username
		if (!uname) return
		const key = `${uname}:${newMonth.toISOString()}`
		if (slotsInFlightRef.current === key) return
		slotsInFlightRef.current = key
		setState((prev) => ({ ...prev, isLoadingSlots: true }))
		try {
			const url = `/api/calendar/available-slots?username=${uname}&month=${newMonth.toISOString()}`
			console.log('[Reschedule] fetching slots', url)
			const res = await fetch(url)
			if (!res.ok) throw new Error('failed')
			const payload = await res.json()
			console.log('[Reschedule] slots keys', Object.keys(payload?.slotsByDay || {}).length)
			setState((prev) => ({ ...prev, availableSlots: payload?.slotsByDay || {}, isLoadingSlots: false }))
		} catch (_) {
			setState((prev) => ({ ...prev, isLoadingSlots: false }))
		} finally {
			if (slotsInFlightRef.current === key) slotsInFlightRef.current = null
		}
	}

	const handleDateSelect = (date: Date) => {
		setState((prev) => ({ ...prev, selectedDate: date, selectedSlot: null }))
	}

	const handleSelectSlot = (slot: { start: string; end: string }) => {
		setState((prev) => ({ ...prev, selectedSlot: slot }))
	}

	const handleConfirm = async () => {
		if (!state.selectedSlot) return
		try {
			setState((prev) => ({ ...prev, isSubmitting: true }))
			const res = await fetch(`/api/public/bookings/${id}/reschedule`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...state.selectedSlot, sig })
			})
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}))
				throw new Error(payload?.error || 'No se pudo reprogramar la cita.')
			}
			setState((prev) => ({ ...prev, bookingConfirmed: true }))
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Error desconocido')
		} finally {
			setState((prev) => ({ ...prev, isSubmitting: false }))
		}
	}

	if (state.isLoading) {
		return (
			<div className="container flex justify-center items-center min-h-screen">
				<Spinner size="sm" color="dark" />
			</div>
		)
	}

	if (state.error || !state.username) {
		return (
			<div className="container flex justify-center items-center min-h-screen">
				<div className="text-center text-gray-700">{state.error || 'Enlace no válido.'}</div>
			</div>
		)
	}

	const handleBack = () => {
		if (state.selectedSlot) {
			setState((prev) => ({ ...prev, selectedSlot: null }))
		} else if (state.selectedDate) {
			setState((prev) => ({ ...prev, selectedDate: null }))
		}
	}

	function BackButton() {
		if (state.selectedDate || state.selectedSlot) {
			return (
				<button onClick={handleBack} className="mb-4 text-teal-600 hover:underline">
					← Volver
				</button>
			)
		}
		return null
	}

	return (
		<div className="container flex justify-center px-6 py-20 min-h-screen">
			<div className="md:max-w-[30vw] w-full overflow-visible">
				<div className="flex flex-col space-y-8">
					{state.bookingConfirmed ? (
						<div className={`space-y-4 p-4 mt-16 flex flex-col items-center justify-center h-full`}>
							<FaCheckCircle className="text-teal-400 text-4xl" />
							<h2 className="text-2xl font-bold">Cita reprogramada</h2>
							<p className="text-center text-xs mb-4">Puedes cerrar esta página.</p>
						</div>
					) : (
						<>
							{/* Step 1: Calendar */}
							{!state.selectedDate && !state.selectedSlot && (
								<div className="w-full">
									<h2 className="text-xl font-semibold mb-10 pl-2">Reprogramar cita</h2>
									<Calendar
										username={state.username as string}
										selectedDay={state.selectedDate}
										availableSlots={state.availableSlots}
										onSelectDate={handleDateSelect}
										onMonthChange={handleMonthChange}
										initialMonth={new Date()}
									/>
								</div>
							)}

							{/* Step 2: Time selection */}
							{state.selectedDate && (
								<div className="w-full">
									<BackButton />
									{state.isLoadingSlots ? (
										<div className="flex justify-center py-12">
											<Spinner size="sm" color="dark" />
										</div>
									) : (
										<>
											<TimeSlots
												date={state.selectedDate}
												availableSlots={state.availableSlots}
												userTimeZone={state.userTimeZone}
												onSelectSlot={handleSelectSlot}
											/>
											{/* Step 3: Confirmation */}
											{state.selectedSlot && (
												<div className="w-full mt-6">
													<Button
														onClick={handleConfirm}
														className="w-full"
														disabled={state.isSubmitting}
													>
														{state.isSubmitting ? (
															<span className="flex items-center justify-center gap-2">
																<Spinner size="sm" color="light" />
																Confirmando...
															</span>
														) : (
															'Confirmar'
														)}
													</Button>
												</div>
											)}
										</>
									)}
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	)
}
