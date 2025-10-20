'use client'

/**
 * CalendarInfoStep
 *
 * This component is used in the direct patient booking flow (public `/[username]` page).
 * It renders:
 * 1) The practitioner header
 * 2) The booking calendar
 * 3) The consultation type selector (first/follow-up) when applicable
 * 4) The "Sobre" (About) section with description and duration
 */

import Calendar from '@/components/Calendar'
import { Clock } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TimeSlot } from '@/lib/calendar/calendar'
import type { UserProfileWithSchedule } from '@/lib/db/profiles'

export interface CalendarInfoStepProps {
	profile: UserProfileWithSchedule
	pricing?: { amount: number; currency: string; first_consultation_amount?: number | null }
	calendar: {
		availableSlots: { [day: string]: TimeSlot[] }
		selectedDate: Date | null
		onSelectDate: (date: Date) => void
		onMonthChange: (newMonth: Date) => void
		username: string
		initialMonth: Date
	}
	consultationType: 'first' | 'followup'
	onConsultationTypeChange: (value: 'first' | 'followup') => void
}

export function CalendarInfoStep({
	profile,
	pricing,
	calendar,
	consultationType,
	onConsultationTypeChange
}: CalendarInfoStepProps) {
	const name = profile.name
	const description = (profile as any)?.description ?? null
	const minutes = (profile as any)?.schedules?.meeting_duration ?? null
	const { availableSlots, selectedDate, onSelectDate, onMonthChange, username, initialMonth } = calendar
	const baseAmount = pricing?.amount ?? 0
	const firstAmount = pricing?.first_consultation_amount
	const showFirst = firstAmount != null && !Number.isNaN(Number(firstAmount))

	return (
		<>
			{/* Header Section */}
			<div className="flex flex-col items-center mb-12 space-y-4">
				{profile.profile_picture_url && typeof window !== 'undefined' && window.innerWidth < 768 && (
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
				username={username}
				selectedDay={selectedDate}
				availableSlots={availableSlots}
				onSelectDate={onSelectDate}
				onMonthChange={onMonthChange}
				initialMonth={initialMonth}
			/>

			{/* Consultation type select below calendar */}
			<div className="mt-10 space-y-2">
				<label className="block text-sm font-medium text-gray-700">Tipo de servicio</label>
				{showFirst ? (
					<Select
						value={consultationType}
						onValueChange={(v) => onConsultationTypeChange(v as 'first' | 'followup')}
					>
						<SelectTrigger className="h-12">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="first">{`Primera consulta — ${new Intl.NumberFormat('es-ES', {
								style: 'currency',
								currency: pricing?.currency || 'EUR'
							}).format(Number(firstAmount || 0))}`}</SelectItem>
							<SelectItem value="followup">{`Consulta de seguimiento — ${new Intl.NumberFormat('es-ES', {
								style: 'currency',
								currency: pricing?.currency || 'EUR'
							}).format(Number(baseAmount || 0))}`}</SelectItem>
						</SelectContent>
					</Select>
				) : (
					<Select value="followup">
						<SelectTrigger className="h-12" disabled>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="followup">{`Consulta — ${new Intl.NumberFormat('es-ES', {
								style: 'currency',
								currency: pricing?.currency || 'EUR'
							}).format(Number(baseAmount || 0))}`}</SelectItem>
						</SelectContent>
					</Select>
				)}
			</div>

			{/* About Section */}
			<div className="bg-gray-50 p-2 rounded-lg mt-6">
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

export default CalendarInfoStep
