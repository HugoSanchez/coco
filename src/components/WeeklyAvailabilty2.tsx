'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

type TimeSlot = {
	id: string
	startTime: string
	endTime: string
}

type DayAvailability = {
	day: string
	dayLetter: string
	available: boolean
	slots: TimeSlot[]
}

const DAYS: Omit<DayAvailability, 'slots'>[] = [
	{ day: 'Domingo', dayLetter: 'D', available: false },
	{ day: 'Lunes', dayLetter: 'L', available: true },
	{ day: 'Martes', dayLetter: 'M', available: true },
	{ day: 'Miércoles', dayLetter: 'M', available: true },
	{ day: 'Jueves', dayLetter: 'J', available: true },
	{ day: 'Viernes', dayLetter: 'V', available: true },
	{ day: 'Sábado', dayLetter: 'S', available: false }
]

const TIME_OPTIONS = [
	'00:00',
	'00:30',
	'01:00',
	'01:30',
	'02:00',
	'02:30',
	'03:00',
	'03:30',
	'04:00',
	'04:30',
	'05:00',
	'05:30',
	'06:00',
	'06:30',
	'07:00',
	'07:30',
	'08:00',
	'08:30',
	'09:00',
	'09:30',
	'10:00',
	'10:30',
	'11:00',
	'11:30',
	'12:00',
	'12:30',
	'13:00',
	'13:30',
	'14:00',
	'14:30',
	'15:00',
	'15:30',
	'16:00',
	'16:30',
	'17:00',
	'17:30',
	'18:00',
	'18:30',
	'19:00',
	'19:30',
	'20:00',
	'20:30',
	'21:00',
	'21:30',
	'22:00',
	'22:30',
	'23:00',
	'23:30'
]

export function WeeklyAvailability() {
	const [availability, setAvailability] = useState<DayAvailability[]>(
		DAYS.map((day) => ({
			...day,
			slots: day.available ? [{ id: crypto.randomUUID(), startTime: '09:00', endTime: '17:00' }] : []
		}))
	)
	const { toast } = useToast()

	// Load existing availability from API
	useEffect(() => {
		;(async () => {
			try {
				const res = await fetch('/api/settings/availability')
				if (!res.ok) return
				const payload = await res.json()
				const rows: Array<{ weekday: number; start_time: string; end_time: string; timezone: string }> =
					Array.isArray(payload?.rules) ? payload.rules : []

				// If user has no saved availability, keep the default pre-filled availability
				if (rows.length === 0) {
					return
				}
				const map: Record<number, TimeSlot[]> = {}
				for (const r of rows) {
					const start = r.start_time.slice(0, 5)
					const end = r.end_time.slice(0, 5)
					;(map[r.weekday] = map[r.weekday] || []).push({
						id: crypto.randomUUID(),
						startTime: start,
						endTime: end
					})
				}
				setAvailability((prev) =>
					prev.map((d, idx) => ({
						...d,
						available: (map[idx] || []).length > 0,
						slots: map[idx] || d.slots
					}))
				)
			} catch (_) {}
		})()
	}, [])

	const toggleDayAvailability = (dayIndex: number) => {
		setAvailability((prev) =>
			prev.map((day, idx) =>
				idx === dayIndex
					? {
							...day,
							available: !day.available,
							slots: !day.available
								? [{ id: crypto.randomUUID(), startTime: '09:00', endTime: '17:00' }]
								: []
						}
					: day
			)
		)
	}

	const addTimeSlot = (dayIndex: number) => {
		setAvailability((prev) =>
			prev.map((day, idx) =>
				idx === dayIndex
					? {
							...day,
							slots: [...day.slots, { id: crypto.randomUUID(), startTime: '09:00', endTime: '17:00' }]
						}
					: day
			)
		)
	}

	const removeTimeSlot = (dayIndex: number, slotId: string) => {
		setAvailability((prev) =>
			prev.map((day, idx) =>
				idx === dayIndex
					? {
							...day,
							slots: day.slots.filter((slot) => slot.id !== slotId),
							available: day.slots.length > 1
						}
					: day
			)
		)
	}

	const updateTimeSlot = (dayIndex: number, slotId: string, field: 'startTime' | 'endTime', value: string) => {
		setAvailability((prev) =>
			prev.map((day, idx) =>
				idx === dayIndex
					? {
							...day,
							slots: day.slots.map((slot) => (slot.id === slotId ? { ...slot, [field]: value } : slot))
						}
					: day
			)
		)
	}

	const handleSave = async () => {
		// Build rules payload
		const rules: Array<{ weekday: number; start: string; end: string; timezone: string }> = []
		availability.forEach((day, idx) => {
			if (!day.available) return
			day.slots.forEach((s) => {
				rules.push({ weekday: idx, start: s.startTime, end: s.endTime, timezone: 'Europe/Madrid' })
			})
		})
		try {
			const res = await fetch('/api/settings/availability', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rules })
			})
			if (!res.ok) throw new Error('Error al guardar disponibilidad')
			toast({ title: '¡Guardado!', description: 'Disponibilidad actualizada', color: 'success' })
		} catch (e) {
			toast({
				title: 'Error',
				description: 'No se pudo guardar la disponibilidad',
				variant: 'destructive',
				color: 'error'
			})
		}
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="space-y-2">
				<div className="flex items-center gap-2">
					<h2 className="text-2xl font-semibold text-gray-900">Disponibilidad</h2>
				</div>
				<p className="text-gray-600">
					Configura tu disponibilidad semanal para que tus pacientes puedan agendar sus citas directamente.
				</p>
			</div>

			{/* Days and Time Slots */}
			<div className="space-y-3">
				{availability.map((day, dayIndex) => (
					<div key={day.day} className="flex items-start gap-4">
						{/* Day Badge */}
						<button
							onClick={() => toggleDayAvailability(dayIndex)}
							className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
								day.available
									? 'bg-teal-400 text-white hover:bg-teal-700'
									: 'bg-gray-200 text-gray-600 hover:bg-gray-300'
							}`}
							aria-label={`Toggle ${day.day} availability`}
						>
							{day.dayLetter}
						</button>

						{/* Time Slots or Unavailable */}
						<div className="flex-1 space-y-3">
							{!day.available ? (
								<div className="flex items-center gap-3 h-10">
									<span className="text-gray-500 font-light">No disponible</span>
									<button
										onClick={() => toggleDayAvailability(dayIndex)}
										className="text-gray-700 hover:text-gray-900 transition-colors"
										aria-label={`Add availability for ${day.day}`}
									>
										<Plus className="h-5 w-5" />
									</button>
								</div>
							) : (
								<>
									{day.slots.map((slot, slotIndex) => (
										<div key={slot.id} className="flex items-center gap-3 flex-wrap">
											{/* Start Time */}
											<Select
												value={slot.startTime}
												onValueChange={(value) =>
													updateTimeSlot(dayIndex, slot.id, 'startTime', value)
												}
											>
												<SelectTrigger className="w-[110px] bg-white border-gray-300">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{TIME_OPTIONS.map((time) => (
														<SelectItem key={time} value={time}>
															{time}
														</SelectItem>
													))}
												</SelectContent>
											</Select>

											<span className="text-gray-500">-</span>

											{/* End Time */}
											<Select
												value={slot.endTime}
												onValueChange={(value) =>
													updateTimeSlot(dayIndex, slot.id, 'endTime', value)
												}
											>
												<SelectTrigger className="w-[110px] bg-white border-gray-300">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{TIME_OPTIONS.map((time) => (
														<SelectItem key={time} value={time}>
															{time}
														</SelectItem>
													))}
												</SelectContent>
											</Select>

											{/* Remove Slot */}
											<button
												onClick={() => removeTimeSlot(dayIndex, slot.id)}
												className="text-gray-600 hover:text-gray-900 transition-colors"
												aria-label="Remove time slot"
											>
												<X className="h-5 w-5" />
											</button>

											{/* Add Slot (only show on last slot) */}
											{slotIndex === day.slots.length - 1 && (
												<button
													onClick={() => addTimeSlot(dayIndex)}
													className="text-gray-700 hover:text-gray-900 transition-colors"
													aria-label="Add another time slot"
												>
													<Plus className="h-5 w-5" />
												</button>
											)}
										</div>
									))}
								</>
							)}
						</div>
					</div>
				))}
			</div>

			{/* Timezone Selector */}
			<div className="pt-4 border-t border-gray-200">
				<p className="text-gray-600 font-normal">CET - Madrid</p>
			</div>

			{/* Save Button */}
			<div className="pt-4">
				<Button onClick={handleSave} className="w-full h-12 bg-teal-400 hover:bg-teal-400/90 text-white">
					Guardar
				</Button>
			</div>
		</div>
	)
}
