import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'

/**
 * Interface for a time slot with start and end times
 *
 * @interface TimeSlot
 * @property start - ISO string representing the start time
 * @property end - ISO string representing the end time
 */
interface TimeSlot {
	start: string
	end: string
}

/**
 * Props interface for the TimeSlots component
 *
 * @interface TimeSlotsProps
 * @property date - The selected date to show time slots for
 * @property availableSlots - Object mapping date keys to arrays of available time slots
 * @property onSelectSlot - Callback function called when a time slot is selected
 * @property userTimeZone - The user's timezone for displaying times correctly
 */
interface TimeSlotsProps {
	date: Date | null
	availableSlots: { [day: string]: TimeSlot[] }
	onSelectSlot: (slot: TimeSlot) => void
	userTimeZone: string
}

/**
 * TimeSlots Component
 *
 * Displays available time slots for a selected date. Converts UTC times to the
 * user's local timezone and presents them as clickable buttons for selection.
 *
 * FEATURES:
 * - Shows available time slots for a specific date
 * - Converts UTC times to user's local timezone
 * - Clickable time slot buttons with hover effects
 * - Handles empty states (no date selected, no slots available)
 * - Responsive grid layout for time slots
 *
 * TIMEZONE HANDLING:
 * - Input times are expected to be in UTC (ISO strings)
 * - Times are converted to user's timezone for display
 * - Original UTC times are passed to onSelectSlot callback
 *
 * @component
 * @example
 * ```tsx
 * <TimeSlots
 *   date={selectedDate}
 *   availableSlots={availableSlots}
 *   onSelectSlot={(slot) => handleSlotSelection(slot)}
 *   userTimeZone="Europe/Madrid"
 * />
 * ```
 */
export default function TimeSlots({ date, availableSlots, onSelectSlot, userTimeZone }: TimeSlotsProps) {
	// Show placeholder when no date is selected
	if (!date) {
		return <div className="text-gray-500">Select a date to view available times</div>
	}

	// Format date as key for looking up available slots
	const dateKey = format(date, 'yyyy-MM-dd')
	// Get slots for the selected date, or empty array if none exist
	const slotsForDate = availableSlots[dateKey] || []

	return (
		<div>
			{/* Header showing the selected date */}
			<h2 className="text-xl font-bold mb-1">
				{(() => {
					const label = format(date, "EEEE, d 'de' MMMM", { locale: es })
					const cap = label
						.replace(/^./, (c) => c.toUpperCase())
						.replace(/ de ([a-z])/, (match, p1) => ` de ${p1.toUpperCase()}`)
					return `${cap}`
				})()}
			</h2>
			<p className="mb-4 text-gray-600 font-light text-sm">
				Estas son las horas disponibles, elige la que más te convenga.
			</p>

			{/* Grid container for time slot buttons */}
			<div className="grid grid-cols-1 gap-2">
				{/* Show message when no slots are available for the selected date */}
				{slotsForDate.length === 0 && (
					<div className="text-gray-500">No hay huecos disponibles para este día</div>
				)}

				{/* Render each available time slot as a clickable button */}
				{slotsForDate.map((slot, index) => {
					// Convert UTC times to user's timezone for display
					const startTime = toZonedTime(parseISO(slot.start), userTimeZone)
					const endTime = toZonedTime(parseISO(slot.end), userTimeZone)

					return (
						<button
							key={index}
							onClick={() => onSelectSlot(slot)}
							className="bg-white border border-gray-200 rounded-md py-4 px-4 hover:bg-emerald-50 hover:border-emerald-300 text-sm font-normal text-gray-700"
						>
							{/* Mostrar hora de inicio en formato 24h */}
							{format(startTime, 'HH:mm', { locale: es })}h
						</button>
					)
				})}
			</div>

			{/* Timezone information for user clarity */}
			<p className="mt-8 text-sm text-gray-500 font-light">Zona horaria: {userTimeZone}</p>
		</div>
	)
}
