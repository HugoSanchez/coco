import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
	format,
	addMonths,
	subMonths,
	startOfMonth,
	endOfMonth,
	eachDayOfInterval,
	isSameMonth,
	isSameDay,
	isToday,
	isBefore,
	startOfWeek,
	endOfWeek,
	isSunday
} from 'date-fns'

import { TimeSlot } from '@/lib/calendar/calendar'

/**
 * Props interface for the Calendar component
 *
 * @interface CalendarProps
 * @property username - The username for the calendar (currently unused)
 * @property selectedDay - The currently selected date
 * @property onSelectDate - Callback function called when a date is selected
 * @property availableSlots - Object mapping date keys to arrays of available time slots
 * @property onMonthChange - Callback function called when the month changes
 */
interface CalendarProps {
	username: string
	selectedDay: Date | null
	onSelectDate: (date: Date) => void
	availableSlots: { [day: string]: TimeSlot[] }
	onMonthChange: (newMonth: Date) => void
}

/**
 * Calendar Component
 *
 * A date selection calendar that displays available booking slots. Allows users
 * to navigate between months and select dates that have available time slots.
 *
 * FEATURES:
 * - Month navigation with previous/next buttons
 * - Date selection with visual feedback
 * - Highlights dates with available slots
 * - Prevents selection of past dates
 * - Responsive design for mobile and desktop
 * - Week starts on Monday (European format)
 *
 * VISUAL STATES:
 * - Available slots: Green background (emerald-100)
 * - Selected date: Darker green background (emerald-200)
 * - Today: Gray background
 * - Past dates: Disabled and grayed out
 * - Other month dates: Lighter text color
 *
 * @component
 * @example
 * ```tsx
 * <Calendar
 *   username="john-doe"
 *   selectedDay={selectedDate}
 *   onSelectDate={(date) => setSelectedDate(date)}
 *   availableSlots={availableSlots}
 *   onMonthChange={(month) => fetchSlotsForMonth(month)}
 * />
 * ```
 */
export default function Calendar({
	onSelectDate,
	onMonthChange,
	selectedDay,
	availableSlots
}: CalendarProps) {
	// State to track the currently displayed month
	const [currentMonth, setCurrentMonth] = useState(new Date())

	/**
	 * Effect to ensure calendar doesn't show past months
	 *
	 * Sets the current month to at least the current month if it's
	 * currently set to a past month.
	 */
	useEffect(() => {
		// Ensure the initial month is set to the current month or later
		const today = new Date()
		if (isBefore(currentMonth, startOfMonth(today))) {
			setCurrentMonth(startOfMonth(today))
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	/**
	 * Navigate to the previous month
	 *
	 * Only allows navigation if the new month is not before the current month.
	 * This prevents users from selecting dates in the past.
	 */
	const prevMonth = () => {
		const newMonth = subMonths(currentMonth, 1)
		// Only allow navigation if not going before current month
		if (!isBefore(startOfMonth(newMonth), startOfMonth(new Date()))) {
			onMonthChange(subMonths(currentMonth, 1))
			setCurrentMonth(newMonth)
		}
	}

	/**
	 * Navigate to the next month
	 *
	 * Always allows forward navigation as future dates are valid.
	 */
	const nextMonth = () => {
		const newMonth = addMonths(currentMonth, 1)
		onMonthChange(newMonth)
		setCurrentMonth(newMonth)
	}

	// Calculate the date range for the calendar grid
	const monthStart = startOfMonth(currentMonth)
	const monthEnd = endOfMonth(currentMonth)
	// Start from Monday of the week containing the first day of the month
	const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
	// End on Sunday of the week containing the last day of the month
	const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
	// Generate array of all days to display in the grid
	const days = eachDayOfInterval({ start: startDate, end: endDate })

	return (
		<div className="w-full">
			{/* Month navigation header */}
			<div className="flex items-center justify-between mb-4">
				{/* Previous month button */}
				<button
					disabled={isSameMonth(currentMonth, new Date())}
					onClick={prevMonth}
					className={`p-2 ${
						isSameMonth(currentMonth, new Date())
							? ''
							: 'rounded-full bg-emerald-100'
					}`}
				>
					<ChevronLeft className="h-5 w-5 text-gray-400" />
				</button>

				{/* Current month and year display */}
				<h2 className="text-lg font-semibold text-gray-800">
					{format(currentMonth, 'MMMM yyyy')}
				</h2>

				{/* Next month button */}
				<button
					onClick={nextMonth}
					className="p-2 rounded-full bg-emerald-100"
				>
					<ChevronRight className="h-5 w-5 text-gray-400" />
				</button>
			</div>

			{/* Calendar grid */}
			<div className="grid grid-cols-7 gap-1">
				{/* Day of week headers */}
				{['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(
					(day) => (
						<div
							key={day}
							className="text-center md:p-2 md:h-10 md:w-10 md:text-left font-medium text-xs text-gray-400 mb-1 py-4"
						>
							{day}
						</div>
					)
				)}

				{/* Calendar days */}
				{days.map((day) => {
					// Determine various states for the day
					const isCurrentMonth = isSameMonth(day, currentMonth)
					const isSelectable =
						isCurrentMonth && !isBefore(day, new Date())
					const dateKey = format(day, 'yyyy-MM-dd')
					const hasAvailableSlots =
						availableSlots[dateKey] &&
						availableSlots[dateKey].length > 0 &&
						day >= new Date()

					return (
						<div
							key={day.toString()}
							className="h-12 w-12 md:h-14 md:w-14 rounded-full text-center flex items-center justify-center"
						>
							<button
								key={day.toString()}
								onClick={() =>
									isSelectable && onSelectDate(day)
								}
								disabled={!isSelectable}
								className={`p-2 h-10 w-10 md:h-12 md:w-12 text-center text-sm font-medium rounded-full
                        ${hasAvailableSlots ? 'bg-emerald-100' : ''}
                        ${
							isSelectable
								? 'hover:bg-emerald-200 hover:opacity-80'
								: 'cursor-default'
						}
                        ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                        ${
							isSameDay(day, selectedDay as Date)
								? 'bg-emerald-200 text-emerald-500 font-semibold'
								: ''
						}
                        ${isSameDay(day, new Date()) ? 'bg-gray-200' : ''}`}
							>
								{format(day, 'd')}
							</button>
						</div>
					)
				})}
			</div>
		</div>
	)
}
