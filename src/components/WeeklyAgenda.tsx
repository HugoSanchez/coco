'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
	ChevronLeft,
	ChevronRight,
	Calendar as CalendarIcon,
	List,
	SlidersHorizontal,
	Settings,
	User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

import { Spinner } from '@/components/ui/spinner'
import { WeeklyAgendaBookingCard } from '@/components/WeeklyAgendaBookingCard'
import { useBookingActions } from '@/hooks/useBookingActions'
import { useBookingModals } from '@/hooks/useBookingModals'
import { useBookingCreation } from '@/hooks/useBookingCreation'
import { useClientManagement } from '@/hooks/useClientManagement'
import { useBookingDetails } from '@/hooks/useBookingDetails'
import { RefundConfirmationModal } from '@/components/RefundConfirmationModal'
import { MarkAsPaidConfirmationModal } from '@/components/MarkAsPaidConfirmationModal'
import { CancelConfirmationModal } from '@/components/CancelConfirmationModal'
import { RescheduleForm } from '@/components/RescheduleForm'
import { BookingForm } from '@/components/BookingForm'
import BookingDetailsPanel from '@/components/BookingDetailsPanel'
import { SideSheetHeadless } from '@/components/SideSheetHeadless'
import { format, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

type PaymentStatus = 'scheduled' | 'pending' | 'paid' | 'disputed' | 'canceled' | 'refunded' | 'na'

interface Booking {
	id: string
	type: 'booking' | 'busy'
	patientName: string
	appointmentType: string
	startTime: string
	endTime: string
	date: string
	status: 'completed' | 'scheduled' | 'canceled' | 'waiting'
	consultation_type?: 'first' | 'followup' | null
	payment_status?: PaymentStatus
	series_id?: string // For recurring bookings
}

// Generate 15-minute time slots for all 24 hours (00:00 to 23:45)
const generateTimeSlots = (): string[] => {
	const slots: string[] = []
	for (let hour = 0; hour < 24; hour++) {
		for (let minute = 0; minute < 60; minute += 15) {
			const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
			slots.push(timeStr)
		}
	}
	return slots
}

const timeSlots = generateTimeSlots()

// Generate Spanish weekday names
const getSpanishDayNames = () => {
	// Create a date for each day of the week (Monday = 1, Sunday = 0)
	// We'll use a reference date and format each weekday
	const referenceDate = new Date(2024, 0, 1) // January 1, 2024 is a Monday
	const dayNames: string[] = []
	for (let i = 0; i < 7; i++) {
		const date = new Date(referenceDate)
		date.setDate(referenceDate.getDate() + i)
		// Format as abbreviated weekday name in Spanish (LUN, MAR, MIE, etc.)
		const dayName = format(date, 'EEE', { locale: es }).toUpperCase()
		dayNames.push(dayName)
	}
	return dayNames
}

const dayNames = getSpanishDayNames()
const weekdayNames = dayNames.slice(0, 5) // First 5 days (Monday to Friday)

export function WeeklyAgenda() {
	const getCurrentWeekStart = () => {
		const now = new Date()
		const day = now.getDay() // 0=Sun..6=Sat
		const diffToMonday = (day + 6) % 7
		const monday = new Date(now)
		monday.setDate(now.getDate() - diffToMonday)
		monday.setHours(0, 0, 0, 0)
		return monday
	}

	// Helper function to get Monday of the week for any given date
	const getMondayOfWeek = (date: Date): Date => {
		const monday = startOfWeek(date, { weekStartsOn: 1 })
		monday.setHours(0, 0, 0, 0)
		return monday
	}

	// Handle date selection from calendar dropdown
	const handleCalendarDateSelect = (date: Date | undefined) => {
		if (!date) return
		const monday = getMondayOfWeek(date)
		setCurrentWeekStart(monday)
		setCalendarOpen(false)
	}
	const [currentWeekStart, setCurrentWeekStart] = useState(getCurrentWeekStart())
	const [showWeekends, setShowWeekends] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const [dragStart, setDragStart] = useState<{ day: number; slot: number } | null>(null)
	const [dragEnd, setDragEnd] = useState<{ day: number; slot: number } | null>(null)
	const [bookings, setBookings] = useState<Booking[]>([])
	const [loadingBookings, setLoadingBookings] = useState(true)
	const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar')
	const [hoveredSlot, setHoveredSlot] = useState<{ day: number; slot: number } | null>(null)
	const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null)
	const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<{
		date: Date
		startTime: string
		endTime: string
	} | null>(null)
	const [calendarOpen, setCalendarOpen] = useState(false)
	const [isMounted, setIsMounted] = useState(false)

	const scrollContainerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		setIsMounted(true)
	}, [])

	// Initialize client management hook
	const { clients } = useClientManagement({
		// Auto-fetch is enabled by default
	})

	// Initialize booking creation hook
	const {
		isFormOpen: isNewBookingOpen,
		openForm: openNewBookingForm,
		closeForm: closeNewBookingForm,
		handleBookingCreated
	} = useBookingCreation({
		onBookingCreated: async () => {
			// Refresh bookings after successful creation
			await refreshBookings()
		}
	})

	// Initialize booking details hook
	const {
		details: bookingDetails,
		isLoading: detailsLoading,
		isOpen: isDetailsOpen,
		open: openDetails,
		close: closeDetails
	} = useBookingDetails({
		onClose: () => {
			// Refresh bookings when details panel closes (in case actions were performed)
			refreshBookings()
		}
	})

	// Initialize booking actions hook
	const { cancelBooking, confirmBooking, markAsPaid, processRefund, resendEmail, cancelSeries } = useBookingActions({
		onBookingUpdated: (bookingId, updates) => {
			// Refresh bookings after update
			refreshBookings()
		},
		onBookingsRemoved: () => {
			// Refresh bookings after removal
			refreshBookings()
		}
	})

	// Initialize booking modals hook
	const {
		refundingBookingId,
		markingAsPaidBookingId,
		cancelingBookingId,
		cancelingSeriesId,
		isRescheduleOpen,
		reschedulingBookingId,
		openRefundModal,
		closeRefundModal,
		openMarkAsPaidModal,
		closeMarkAsPaidModal,
		openCancelBookingModal,
		closeCancelBookingModal,
		openCancelSeriesModal,
		closeCancelSeriesModal,
		openRescheduleModal,
		closeRescheduleModal
	} = useBookingModals()

	// Helper function to refresh bookings
	const refreshBookings = async () => {
		// Trigger re-fetch by updating a dependency that the useEffect watches
		// The useEffect will automatically refetch when currentWeekStart or showWeekends change
		// For now, we'll just trigger a manual refetch by calling the same logic
		const days = getWeekDays()
		const firstDay = days[0]
		const lastDay = days[days.length - 1]
		const weekStart = new Date(
			Date.UTC(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate(), 0, 0, 0, 0)
		)
		const weekEnd = new Date(
			Date.UTC(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59, 999)
		)

		try {
			const response = await fetch(
				`/api/calendar/events?start=${encodeURIComponent(weekStart.toISOString())}&end=${encodeURIComponent(weekEnd.toISOString())}`
			)

			if (!response.ok) {
				throw new Error('Failed to fetch calendar events')
			}

			const data = await response.json()

			// Use the same mapping logic from useEffect
			const formatHHmm = (iso: string) => {
				const d = new Date(iso)
				return d.toLocaleTimeString('en-GB', {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false,
					timeZone: 'Europe/Madrid'
				})
			}

			const mapEventsToBookings = (events: any[]): Booking[] => {
				return events.map((ev: any) => {
					const getDateInCET = (isoString: string): string => {
						const d = new Date(isoString)
						const year = d.toLocaleString('en-US', { timeZone: 'Europe/Madrid', year: 'numeric' })
						const month = d.toLocaleString('en-US', { timeZone: 'Europe/Madrid', month: '2-digit' })
						const day = d.toLocaleString('en-US', { timeZone: 'Europe/Madrid', day: '2-digit' })
						return `${year}-${month}-${day}`
					}

					if (ev.type === 'system') {
						let displayPaymentStatus: PaymentStatus = 'na'
						if (ev.payment_status !== undefined && ev.payment_status !== null) {
							if (ev.payment_status === 'not_applicable' && ev.billing_status === 'pending') {
								displayPaymentStatus = 'scheduled'
							} else if (ev.payment_status === 'not_applicable') {
								displayPaymentStatus = 'na'
							} else {
								const statusMap: Record<string, PaymentStatus> = {
									pending: 'pending',
									paid: 'paid',
									disputed: 'disputed',
									canceled: 'canceled',
									refunded: 'refunded'
								}
								displayPaymentStatus = statusMap[ev.payment_status] || 'na'
							}
						}

						return {
							id: ev.bookingId ? String(ev.bookingId) : `sys-${ev.start}-${ev.end}`,
							type: 'booking',
							patientName: ev.title || 'Cliente',
							appointmentType: '',
							startTime: formatHHmm(ev.start),
							endTime: formatHHmm(ev.end),
							date: getDateInCET(ev.start),
							status: ev.status === 'canceled' ? 'canceled' : 'scheduled',
							consultation_type: ev.consultation_type || null,
							payment_status: displayPaymentStatus,
							series_id: ev.series_id || undefined
						}
					}
					return {
						id: `busy-${ev.start}-${ev.end}`,
						type: 'busy',
						patientName: '',
						appointmentType: '',
						startTime: formatHHmm(ev.start),
						endTime: formatHHmm(ev.end),
						date: getDateInCET(ev.start),
						status: 'scheduled'
					}
				})
			}

			const mapped = mapEventsToBookings(data.events || [])
			setBookings(mapped)
		} catch (e) {
			console.error('Error refreshing bookings:', e)
			setBookings([])
		}
	}

	// Action handlers that open modals and close the action menu
	const handleCancelBooking = (bookingId: string) => {
		setOpenActionMenuId(null) // Close action menu
		openCancelBookingModal(bookingId)
	}

	const handleMarkAsPaid = (bookingId: string) => {
		setOpenActionMenuId(null) // Close action menu
		openMarkAsPaidModal(bookingId)
	}

	const handleRefundBooking = (bookingId: string) => {
		setOpenActionMenuId(null) // Close action menu
		openRefundModal(bookingId)
	}

	const handleRescheduleBooking = (bookingId: string) => {
		setOpenActionMenuId(null) // Close action menu
		openRescheduleModal(bookingId)
	}

	const handleCancelSeries = (seriesId: string) => {
		setOpenActionMenuId(null) // Close action menu
		openCancelSeriesModal(seriesId)
	}

	const handleConfirmBooking = (bookingId: string) => {
		setOpenActionMenuId(null) // Close action menu
		confirmBooking(bookingId)
	}

	const handleResendEmail = (bookingId: string) => {
		setOpenActionMenuId(null) // Close action menu
		resendEmail(bookingId)
	}

	// Wrapper functions that handle modal confirmations
	const handleMarkAsPaidConfirm = async (bookingId: string) => {
		try {
			await markAsPaid(bookingId)
			closeMarkAsPaidModal()
		} catch (error) {
			closeMarkAsPaidModal()
		}
	}

	const handleRefundConfirm = async (bookingId: string, reason?: string) => {
		try {
			await processRefund(bookingId, reason)
			closeRefundModal()
		} catch (error) {
			// Modal stays open on error so user can retry
		}
	}

	const handleCancelBookingConfirm = async (bookingId: string) => {
		closeCancelBookingModal()
		await cancelBooking(bookingId)
	}

	const handleConfirmCancelSeries = async () => {
		if (!cancelingSeriesId) return
		const seriesIdToCancel = cancelingSeriesId
		closeCancelSeriesModal()
		await cancelSeries(seriesIdToCancel)
	}

	const getWeekDays = () => {
		const days = []
		const daysToShow = showWeekends ? 7 : 5
		for (let i = 0; i < daysToShow; i++) {
			const date = new Date(currentWeekStart)
			date.setDate(currentWeekStart.getDate() + i)
			days.push(date)
		}
		return days
	}

	const weekDays = getWeekDays()

	// Fetch events for the entire visible week in a single API call
	useEffect(() => {
		const formatHHmm = (iso: string) => {
			const d = new Date(iso)
			// Convert to CET timezone (Europe/Madrid)
			return d.toLocaleTimeString('en-GB', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
				timeZone: 'Europe/Madrid'
			})
		}

		const mapEventsToBookings = (events: any[]): Booking[] => {
			return events.map((ev: any) => {
				// Extract date in CET timezone
				const getDateInCET = (isoString: string): string => {
					const d = new Date(isoString)
					// Format date parts in CET timezone
					const year = d.toLocaleString('en-US', { timeZone: 'Europe/Madrid', year: 'numeric' })
					const month = d.toLocaleString('en-US', { timeZone: 'Europe/Madrid', month: '2-digit' })
					const day = d.toLocaleString('en-US', { timeZone: 'Europe/Madrid', day: '2-digit' })
					return `${year}-${month}-${day}`
				}

				if (ev.type === 'system') {
					// Map payment_status to PaymentStatus format (same logic as BookingsTable)
					let displayPaymentStatus: PaymentStatus = 'na'

					// Always use payment_status from API, handle 'not_applicable' case
					if (ev.payment_status !== undefined && ev.payment_status !== null) {
						// Handle the case where payment_status might be 'not_applicable' but billing_status is 'pending'
						if (ev.payment_status === 'not_applicable' && ev.billing_status === 'pending') {
							displayPaymentStatus = 'scheduled'
						} else if (ev.payment_status === 'not_applicable') {
							displayPaymentStatus = 'na'
						} else {
							// Map API payment_status values to PaymentStatus type
							const statusMap: Record<string, PaymentStatus> = {
								pending: 'pending',
								paid: 'paid',
								disputed: 'disputed',
								canceled: 'canceled',
								refunded: 'refunded'
							}
							displayPaymentStatus = statusMap[ev.payment_status] || 'na'
						}
					}

					return {
						id: ev.bookingId ? String(ev.bookingId) : `sys-${ev.start}-${ev.end}`,
						type: 'booking',
						patientName: ev.title || 'Cliente',
						appointmentType: '',
						startTime: formatHHmm(ev.start),
						endTime: formatHHmm(ev.end),
						date: getDateInCET(ev.start),
						status: ev.status === 'canceled' ? 'canceled' : 'scheduled',
						consultation_type: ev.consultation_type || null,
						payment_status: displayPaymentStatus,
						series_id: ev.series_id || undefined
					}
				}
				return {
					id: `busy-${ev.start}-${ev.end}`,
					type: 'busy',
					patientName: '',
					appointmentType: '',
					startTime: formatHHmm(ev.start),
					endTime: formatHHmm(ev.end),
					date: getDateInCET(ev.start),
					status: 'scheduled'
				}
			})
		}

		const fetchWeek = async () => {
			setLoadingBookings(true)
			try {
				// Calculate week bounds: start of first day to end of last day
				const firstDay = weekDays[0]
				const lastDay = weekDays[weekDays.length - 1]

				const weekStart = new Date(
					Date.UTC(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate(), 0, 0, 0, 0)
				)
				const weekEnd = new Date(
					Date.UTC(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59, 999)
				)

				// Single API call for the entire week
				const response = await fetch(
					`/api/calendar/events?start=${encodeURIComponent(weekStart.toISOString())}&end=${encodeURIComponent(weekEnd.toISOString())}`
				)

				if (!response.ok) {
					throw new Error('Failed to fetch calendar events')
				}

				const data = await response.json()
				const mapped = mapEventsToBookings(data.events || [])
				setBookings(mapped)
			} catch (e) {
				console.error('Error fetching week bookings:', e)
				// On error, clear bookings to show empty state
				setBookings([])
			} finally {
				setLoadingBookings(false)
			}
		}

		fetchWeek()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentWeekStart, showWeekends])

	// Scroll to 8:55am on mount and when week changes
	useEffect(() => {
		if (scrollContainerRef.current) {
			const minutesFromMidnight = 8 * 60 + 40 // 8:55am
			const pxPerMinute = 25 / 15 // 25px per 15-minute slot
			const scrollPosition = minutesFromMidnight * pxPerMinute
			scrollContainerRef.current.scrollTop = scrollPosition
		}
	}, [currentWeekStart, showWeekends])

	const previousWeek = () => {
		const newDate = new Date(currentWeekStart)
		newDate.setDate(newDate.getDate() - 7)
		setCurrentWeekStart(newDate)
	}

	const nextWeek = () => {
		const newDate = new Date(currentWeekStart)
		newDate.setDate(newDate.getDate() + 7)
		setCurrentWeekStart(newDate)
	}

	const getBookingsForDay = (date: Date) => {
		// Convert date to CET timezone for comparison
		const year = date.toLocaleString('en-US', { timeZone: 'Europe/Madrid', year: 'numeric' })
		const month = date.toLocaleString('en-US', { timeZone: 'Europe/Madrid', month: '2-digit' })
		const day = date.toLocaleString('en-US', { timeZone: 'Europe/Madrid', day: '2-digit' })
		const dateStr = `${year}-${month}-${day}`
		return bookings.filter((booking) => booking.date === dateStr)
	}

	const getTodayAppointments = () => {
		// Get today's date in CET timezone
		const today = new Date()
		const year = today.toLocaleString('en-US', { timeZone: 'Europe/Madrid', year: 'numeric' })
		const month = today.toLocaleString('en-US', { timeZone: 'Europe/Madrid', month: '2-digit' })
		const day = today.toLocaleString('en-US', { timeZone: 'Europe/Madrid', day: '2-digit' })
		const todayStr = `${year}-${month}-${day}`
		return bookings.filter((booking) => booking.date === todayStr).length
	}

	const getBookingPosition = (startTime: string, endTime: string) => {
		// Grid window from first slot to last slot + 15min
		const parseHm = (hm: string) => {
			const [h, m] = hm.split(':').map((v) => Number.parseInt(v))
			return h * 60 + m
		}
		const gridStartMin = parseHm(timeSlots[0])
		const gridEndMin = parseHm(timeSlots[timeSlots.length - 1]) + 15

		const startMin = parseHm(startTime)
		const endMin = parseHm(endTime)

		// If event doesn't overlap the visible window, don't render
		if (endMin <= gridStartMin || startMin >= gridEndMin) return null

		// Clamp to visible window
		const visibleStart = Math.max(startMin, gridStartMin)
		const visibleEnd = Math.min(endMin, gridEndMin)
		const pxPerMin = 25 / 15 // 25px per 15 minutes (same visual density)

		return {
			top: `${(visibleStart - gridStartMin) * pxPerMin}px`,
			height: `${Math.max(1, (visibleEnd - visibleStart) * pxPerMin)}px`
		}
	}

	const handleMouseDown = (dayIndex: number, slotIndex: number) => {
		setIsDragging(true)
		setDragStart({ day: dayIndex, slot: slotIndex })
		setDragEnd({ day: dayIndex, slot: slotIndex })
	}

	const handleMouseEnter = (dayIndex: number, slotIndex: number) => {
		if (!isDragging) {
			setHoveredSlot({ day: dayIndex, slot: slotIndex })
		}
		if (isDragging && dragStart && dragStart.day === dayIndex) {
			setDragEnd({ day: dayIndex, slot: slotIndex })
		}
	}

	const handleMouseLeave = () => {
		setHoveredSlot(null)
	}

	const handleMouseUp = () => {
		if (isDragging && dragStart && dragEnd) {
			const startSlot = Math.min(dragStart.slot, dragEnd.slot)
			const endSlot = Math.max(dragStart.slot, dragEnd.slot)
			const selectedDay = weekDays[dragStart.day]

			// Parse time strings (e.g., "09:00") and combine with selected date
			const startTimeStr = timeSlots[startSlot]
			const endTimeStr = timeSlots[endSlot + 1] || timeSlots[timeSlots.length - 1]
			const [startHour, startMinute] = startTimeStr.split(':').map(Number)
			const [endHour, endMinute] = endTimeStr.split(':').map(Number)

			// Create Date objects - use the selected day's year/month/date with the selected time
			// The date is already in local timezone, so we create dates in that timezone
			const startDate = new Date(selectedDay)
			startDate.setHours(startHour, startMinute, 0, 0)
			const endDate = new Date(selectedDay)
			endDate.setHours(endHour, endMinute, 0, 0)

			// Convert to ISO strings for BookingForm (these will be in UTC)
			setSelectedSlotForBooking({
				date: selectedDay,
				startTime: startDate.toISOString(),
				endTime: endDate.toISOString()
			})
			openNewBookingForm()
		}
		setIsDragging(false)
		setDragStart(null)
		setDragEnd(null)
	}

	const isSlotInDragSelection = (dayIndex: number, slotIndex: number) => {
		if (!isDragging || !dragStart || !dragEnd) return false
		if (dragStart.day !== dayIndex) return false
		const minSlot = Math.min(dragStart.slot, dragEnd.slot)
		const maxSlot = Math.max(dragStart.slot, dragEnd.slot)
		return slotIndex >= minSlot && slotIndex <= maxSlot
	}

	return (
		<>
			{calendarOpen &&
				isMounted &&
				createPortal(
					<div
						className="fixed inset-0 z-[60] bg-slate-900/5 backdrop-blur-[1px]"
						onClick={() => setCalendarOpen(false)}
					/>,
					document.body
				)}
			<div className="isolate space-y-4">
				<div className="p-4 px-6 bg-white rounded-2xl border-4 border-teal-100/40">
					<div className="grid grid-cols-3 items-center">
						{/* Left: View Toggle */}
						<div className="flex items-center">
							<h1 className="text-2xl font-bold">Agenda semanal</h1>
						</div>

						{/* Center: Date Navigation and Appointment Count */}
						<div className="flex items-center justify-center gap-6 ">
							<div className="flex items-center gap-2">
								<Button variant="ghost" size="icon" onClick={previousWeek} className="h-8 w-8">
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<span className="text-lg font-medium text-gray-600 min-w-[80px] text-center">
									{currentWeekStart
										.toLocaleDateString('es-ES', {
											month: 'long',
											day: 'numeric',
											year: 'numeric'
										})
										.replace(/^\w/, (c) => c.toUpperCase())}
								</span>
								<Button variant="ghost" size="icon" onClick={nextWeek} className="h-8 w-8">
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>

						{/* Right: Filter and Settings */}
						<div className="flex items-center justify-end">
							<Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
								<PopoverTrigger asChild>
									<Button
										variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
										size="sm"
										onClick={() => setViewMode('calendar')}
										className="gap-2"
									>
										<CalendarIcon className="h-4 w-4" />
									</Button>
								</PopoverTrigger>
								<PopoverContent
									className="w-auto p-0 rounded-2xl border border-gray-100 shadow-lg"
									align="end"
									sideOffset={8}
								>
									<Calendar
										mode="single"
										selected={currentWeekStart}
										onSelect={handleCalendarDateSelect}
										defaultMonth={currentWeekStart}
										initialFocus
										locale={es}
										weekStartsOn={1}
										className="rounded-md border-0"
									/>
								</PopoverContent>
							</Popover>
						</div>
					</div>
				</div>

				<div className="rounded-b-lg border-8 border-teal-200/10 rounded-2xl overflow-hidden relative">
					{/* Loading Spinner */}
					{loadingBookings && (
						<div className="absolute inset-0 flex items-center justify-center z-50">
							<div className="flex flex-col items-center px-8 py-4 bg-gray-100 rounded-lg">
								<Spinner size="sm" color="dark" />
							</div>
						</div>
					)}

					{/* Day Headers */}
					<div className="flex border-b border-gray-100 bg-white">
						<div className="w-20 flex-shrink-0 p-3 text-xs font-medium text-gray-500">CET</div>
						<div className={`flex-1 grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'}`}>
							{weekDays.map((day, index) => {
								// Compare dates in CET timezone
								const today = new Date()
								const todayYear = today.toLocaleString('en-US', {
									timeZone: 'Europe/Madrid',
									year: 'numeric'
								})
								const todayMonth = today.toLocaleString('en-US', {
									timeZone: 'Europe/Madrid',
									month: '2-digit'
								})
								const todayDay = today.toLocaleString('en-US', {
									timeZone: 'Europe/Madrid',
									day: '2-digit'
								})
								const dayYear = day.toLocaleString('en-US', {
									timeZone: 'Europe/Madrid',
									year: 'numeric'
								})
								const dayMonth = day.toLocaleString('en-US', {
									timeZone: 'Europe/Madrid',
									month: '2-digit'
								})
								const dayDay = day.toLocaleString('en-US', {
									timeZone: 'Europe/Madrid',
									day: '2-digit'
								})
								const isToday = todayYear === dayYear && todayMonth === dayMonth && todayDay === dayDay
								return (
									<div key={index} className="p-3 text-center border-l border-gray-200">
										<div
											className={`text-xs font-medium uppercase ${isToday ? 'text-teal-700' : 'text-gray-500'}`}
										>
											{showWeekends
												? dayNames[day.getDay() === 0 ? 6 : day.getDay() - 1]
												: weekdayNames[index]}
										</div>
										<div
											className={`text-xl font-normal mt-1 ${isToday ? 'text-teal-700' : 'text-gray-900'}`}
										>
											{day.getDate()}
										</div>
									</div>
								)
							})}
						</div>
					</div>

					{/* Time Grid */}
					<div
						ref={scrollContainerRef}
						className="overflow-y-auto max-h-[calc(100vh-200px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
					>
						<div
							className="flex select-none"
							onMouseUp={handleMouseUp}
							onMouseLeave={() => {
								handleMouseUp()
								setHoveredSlot(null)
							}}
							onDragStart={(e) => e.preventDefault()}
						>
							<div className="w-20 flex-shrink-0 border-r border-gray-200 bg-white">
								{timeSlots.map((time, index) => {
									const isHourMark = time.endsWith(':00')
									const isHalfHourMark = time.endsWith(':30')
									return (
										<div
											key={time}
											className={`h-[25px] ${
												isHourMark
													? 'border-t border-gray-300'
													: isHalfHourMark
														? 'border-t border-gray-200'
														: ''
											} px-2 py-1 text-xs text-gray-800 font-medium`}
										>
											{isHourMark ? time : ''}
										</div>
									)
								})}
							</div>

							{/* Day Columns */}
							<div className={`flex-1 grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'}`}>
								{weekDays.map((day, dayIndex) => {
									const dayBookings = getBookingsForDay(day)
									return (
										<div key={dayIndex} className="border-l border-gray-200 bg-[#ffffff] relative">
											{timeSlots.map((time, slotIndex) => {
												const isHourMark = time.endsWith(':00')
												const isHalfHourMark = time.endsWith(':30')
												const isHovered =
													hoveredSlot?.day === dayIndex && hoveredSlot?.slot === slotIndex
												const isInSelection = isSlotInDragSelection(dayIndex, slotIndex)
												const isFirstSlotInSelection =
													isDragging &&
													dragStart &&
													dragEnd &&
													dragStart.day === dayIndex &&
													slotIndex === Math.min(dragStart.slot, dragEnd.slot)

												return (
													<div
														key={time}
														className={`h-[25px] relative select-none ${
															isHourMark
																? 'border-t border-gray-300'
																: isHalfHourMark
																	? 'border-t border-gray-200'
																	: ''
														} cursor-pointer ${!isDragging ? 'hover:bg-teal-50' : ''} transition-colors ${
															isInSelection ? 'bg-teal-100' : ''
														}`}
														onMouseDown={(e) => {
															e.preventDefault()
															handleMouseDown(dayIndex, slotIndex)
														}}
														onMouseEnter={() => handleMouseEnter(dayIndex, slotIndex)}
														onMouseLeave={handleMouseLeave}
														onDragStart={(e) => e.preventDefault()}
													>
														{isFirstSlotInSelection &&
															isDragging &&
															dragStart &&
															dragEnd && (
																<div
																	className="absolute left-0 right-0 flex items-center justify-center text-xs text-teal-700 font-medium pointer-events-none select-none z-10"
																	style={{
																		top: 0,
																		height: `${(Math.abs(dragEnd.slot - dragStart.slot) + 1) * 25}px`,
																		userSelect: 'none',
																		WebkitUserSelect: 'none'
																	}}
																>
																	{timeSlots[Math.min(dragStart.slot, dragEnd.slot)]}{' '}
																	-{' '}
																	{timeSlots[
																		Math.max(dragStart.slot, dragEnd.slot) + 1
																	] || timeSlots[timeSlots.length - 1]}
																</div>
															)}
													</div>
												)
											})}

											{dayBookings.map((booking) => {
												const position = getBookingPosition(booking.startTime, booking.endTime)
												if (!position) return null

												return (
													<WeeklyAgendaBookingCard
														key={booking.id}
														booking={booking}
														position={position}
														onCancelBooking={handleCancelBooking}
														onConfirmBooking={handleConfirmBooking}
														onMarkAsPaid={handleMarkAsPaid}
														onRefundBooking={handleRefundBooking}
														onRescheduleBooking={handleRescheduleBooking}
														onResendEmail={handleResendEmail}
														onCancelSeries={handleCancelSeries}
														actionMenuOpen={openActionMenuId === booking.id}
														onActionMenuOpenChange={(open) => {
															setOpenActionMenuId(open ? booking.id : null)
														}}
														onClick={(bookingId) => {
															// Only open details for booking type (not busy slots)
															if (booking.type === 'booking') {
																openDetails(bookingId)
															}
														}}
													/>
												)
											})}
										</div>
									)
								})}
							</div>
						</div>
					</div>
				</div>

				{/* Refund Confirmation Modal */}
				{refundingBookingId &&
					(() => {
						const booking = bookings.find((b) => b.id === refundingBookingId)
						return (
							<RefundConfirmationModal
								isOpen={!!refundingBookingId}
								onOpenChange={(open) => !open && closeRefundModal()}
								onConfirm={(reason) => handleRefundConfirm(refundingBookingId, reason)}
								bookingDetails={{
									id: refundingBookingId,
									customerName: booking?.patientName || 'Cliente',
									customerEmail: '',
									amount: 0,
									currency: 'EUR',
									date: booking?.date
										? format(new Date(booking.date + 'T12:00:00'), 'dd MMM yyyy', { locale: es })
										: ''
								}}
							/>
						)
					})()}

				{/* Mark As Paid Confirmation Modal */}
				{markingAsPaidBookingId &&
					(() => {
						const booking = bookings.find((b) => b.id === markingAsPaidBookingId)
						return (
							<MarkAsPaidConfirmationModal
								key={markingAsPaidBookingId}
								isOpen={!!markingAsPaidBookingId}
								onOpenChange={(open) => !open && closeMarkAsPaidModal()}
								onConfirm={() => {
									handleMarkAsPaidConfirm(markingAsPaidBookingId)
								}}
								bookingDetails={{
									id: markingAsPaidBookingId,
									customerName: booking?.patientName || 'Cliente',
									customerEmail: '',
									amount: 0,
									currency: 'EUR',
									date: booking?.date
										? format(new Date(booking.date + 'T12:00:00'), 'dd MMM yyyy', { locale: es })
										: ''
								}}
							/>
						)
					})()}

				{/* Cancel Confirmation Modal */}
				{cancelingBookingId &&
					(() => {
						const booking = bookings.find((b) => b.id === cancelingBookingId)
						const isPaid = booking?.payment_status === 'paid'
						return (
							<CancelConfirmationModal
								isOpen={!!cancelingBookingId}
								onOpenChange={(open) => {
									if (!open) closeCancelBookingModal()
								}}
								onConfirm={async () => {
									await handleCancelBookingConfirm(cancelingBookingId)
								}}
								isPaid={!!isPaid}
							/>
						)
					})()}

				{/* Cancel Series Confirmation Modal */}
				{cancelingSeriesId && (
					<CancelConfirmationModal
						isOpen={!!cancelingSeriesId}
						onOpenChange={(open) => {
							if (!open) closeCancelSeriesModal()
						}}
						onConfirm={async () => {
							await handleConfirmCancelSeries()
						}}
						isPaid={false}
						title="Cancelar evento recurrente"
						description="Se cancelarán todas las citas futuras de esta serie recurrente. Esta acción no se puede deshacer."
					/>
				)}

				{/* Reschedule Sidebar */}
				<SideSheetHeadless
					isOpen={isRescheduleOpen}
					onClose={() => {
						closeRescheduleModal()
					}}
					title="Reprogramar Cita"
					description="Selecciona una nueva fecha y hora para la cita"
				>
					{reschedulingBookingId && (
						<RescheduleForm
							bookingId={reschedulingBookingId}
							customerName={
								bookings.find((b) => b.id === reschedulingBookingId)?.patientName || 'Cliente'
							}
							onSuccess={() => {
								closeRescheduleModal()
								refreshBookings()
							}}
							onCancel={() => {
								closeRescheduleModal()
							}}
						/>
					)}
				</SideSheetHeadless>

				{/* New Booking Sidebar */}
				<SideSheetHeadless
					isOpen={isNewBookingOpen}
					onClose={() => {
						closeNewBookingForm()
						setSelectedSlotForBooking(null)
					}}
					title="Nueva Cita"
					description="Completa los detalles de la cita"
				>
					{selectedSlotForBooking && (
						<BookingForm
							clients={clients as any[]}
							initialDate={selectedSlotForBooking.date}
							initialSlot={{
								start: selectedSlotForBooking.startTime,
								end: selectedSlotForBooking.endTime
							}}
							initialStep={3}
							onSuccess={handleBookingCreated}
							onCancel={() => {
								closeNewBookingForm()
								setSelectedSlotForBooking(null)
							}}
						/>
					)}
				</SideSheetHeadless>

				{/* Booking Details SideSheet */}
				<SideSheetHeadless
					isOpen={isDetailsOpen}
					onClose={closeDetails}
					title="Detalles de la cita"
					description={undefined}
				>
					<BookingDetailsPanel details={bookingDetails} onClose={closeDetails} isLoading={detailsLoading} />
				</SideSheetHeadless>
			</div>
		</>
	)
}
