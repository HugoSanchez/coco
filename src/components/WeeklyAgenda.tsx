'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar, List, SlidersHorizontal, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { Spinner } from '@/components/ui/spinner'
import { WeeklyAgendaBookingCard } from '@/components/WeeklyAgendaBookingCard'

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
}

// Generate 15-minute time slots from 08:00 to 18:00
const generateTimeSlots = (): string[] => {
	const slots: string[] = []
	for (let hour = 8; hour <= 18; hour++) {
		for (let minute = 0; minute < 60; minute += 15) {
			const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
			slots.push(timeStr)
		}
	}
	return slots
}

const timeSlots = generateTimeSlots()

const dayNames = ['MON', 'TUE', 'WED', 'THR', 'FRI', 'SAT', 'SUN']
const weekdayNames = ['MON', 'TUE', 'WED', 'THR', 'FRI']

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
	const [currentWeekStart, setCurrentWeekStart] = useState(getCurrentWeekStart())
	const [showWeekends, setShowWeekends] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const [dragStart, setDragStart] = useState<{ day: number; slot: number } | null>(null)
	const [dragEnd, setDragEnd] = useState<{ day: number; slot: number } | null>(null)
	const [showBookingDialog, setShowBookingDialog] = useState(false)
	const [newBooking, setNewBooking] = useState({
		patientName: '',
		appointmentType: '',
		date: '',
		startTime: '',
		endTime: ''
	})
	const [bookings, setBookings] = useState<Booking[]>([])
	const [loadingBookings, setLoadingBookings] = useState(true)
	const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar')
	const [hoveredSlot, setHoveredSlot] = useState<{ day: number; slot: number } | null>(null)

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
						payment_status: displayPaymentStatus
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

			setNewBooking({
				patientName: '',
				appointmentType: '',
				date: selectedDay.toISOString().split('T')[0],
				startTime: timeSlots[startSlot],
				endTime: timeSlots[endSlot + 1] || '18:15'
			})
			setShowBookingDialog(true)
		}
		setIsDragging(false)
		setDragStart(null)
		setDragEnd(null)
	}

	const handleCreateBooking = () => {
		if (newBooking.patientName.trim()) {
			const booking: Booking = {
				id: Date.now().toString(),
				type: 'booking',
				patientName: newBooking.patientName,
				appointmentType: newBooking.appointmentType || 'General Consultation',
				startTime: newBooking.startTime,
				endTime: newBooking.endTime,
				date: newBooking.date,
				status: 'scheduled'
			}
			setBookings([...bookings, booking])
			setShowBookingDialog(false)
			setNewBooking({ patientName: '', appointmentType: '', date: '', startTime: '', endTime: '' })
		}
	}

	const isSlotInDragSelection = (dayIndex: number, slotIndex: number) => {
		if (!isDragging || !dragStart || !dragEnd) return false
		if (dragStart.day !== dayIndex) return false
		const minSlot = Math.min(dragStart.slot, dragEnd.slot)
		const maxSlot = Math.max(dragStart.slot, dragEnd.slot)
		return slotIndex >= minSlot && slotIndex <= maxSlot
	}

	return (
		<div className="space-y-4 isolate">
			<div className="bg-white rounded-lg border border-gray-200 p-4">
				<div className="flex items-center justify-between">
					{/* Left: View Toggle */}
					<div className="flex items-center gap-2">
						<Button
							variant={viewMode === 'list' ? 'secondary' : 'ghost'}
							size="sm"
							onClick={() => setViewMode('list')}
							className="gap-2"
						>
							<List className="h-4 w-4" />
							List
						</Button>
						<Button
							variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
							size="sm"
							onClick={() => setViewMode('calendar')}
							className="gap-2"
						>
							<Calendar className="h-4 w-4" />
							Calendar
						</Button>
					</div>

					{/* Center: Date Navigation and Appointment Count */}
					<div className="flex items-center gap-6">
						<div className="flex items-center gap-2">
							<Button variant="ghost" size="icon" onClick={previousWeek} className="h-8 w-8">
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
								{currentWeekStart.toLocaleDateString('en-US', {
									month: 'long',
									day: 'numeric',
									year: 'numeric'
								})}
							</span>
							<Button variant="ghost" size="icon" onClick={nextWeek} className="h-8 w-8">
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{/* Right: Filter and Settings */}
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="icon" className="h-8 w-8">
							<SlidersHorizontal className="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="icon" className="h-8 w-8">
							<Settings className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>

			<div className="bg-white rounded-lg border border-gray-200 overflow-hidden relative">
				{/* Loading Overlay */}
				{loadingBookings && (
					<div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
						<div className="flex flex-col items-center gap-2">
							<Spinner size="sm" color="dark" />
							<span className="text-sm text-gray-600">Cargando citas...</span>
						</div>
					</div>
				)}

				{/* Day Headers */}
				<div className="flex border-b border-gray-200">
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
							const dayYear = day.toLocaleString('en-US', { timeZone: 'Europe/Madrid', year: 'numeric' })
							const dayMonth = day.toLocaleString('en-US', {
								timeZone: 'Europe/Madrid',
								month: '2-digit'
							})
							const dayDay = day.toLocaleString('en-US', { timeZone: 'Europe/Madrid', day: '2-digit' })
							const isToday = todayYear === dayYear && todayMonth === dayMonth && todayDay === dayDay
							return (
								<div key={index} className="p-3 text-center border-l border-gray-200">
									<div
										className={`text-xs font-medium uppercase ${isToday ? 'text-blue-600' : 'text-gray-500'}`}
									>
										{showWeekends
											? dayNames[day.getDay() === 0 ? 6 : day.getDay() - 1]
											: weekdayNames[index]}
									</div>
									<div
										className={`text-xl font-normal mt-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}
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
					className="flex select-none"
					onMouseUp={handleMouseUp}
					onMouseLeave={() => {
						handleMouseUp()
						setHoveredSlot(null)
					}}
					onDragStart={(e) => e.preventDefault()}
				>
					<div className="w-20 flex-shrink-0 border-r border-gray-200">
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
									} px-2 py-1 text-xs text-gray-500`}
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
								<div key={dayIndex} className="border-l border-gray-200 relative">
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
												{isFirstSlotInSelection && isDragging && dragStart && dragEnd && (
													<div
														className="absolute left-0 right-0 flex items-center justify-center text-xs text-teal-700 font-medium pointer-events-none select-none z-10"
														style={{
															top: 0,
															height: `${(Math.abs(dragEnd.slot - dragStart.slot) + 1) * 25}px`,
															userSelect: 'none',
															WebkitUserSelect: 'none'
														}}
													>
														{timeSlots[Math.min(dragStart.slot, dragEnd.slot)]} -{' '}
														{timeSlots[Math.max(dragStart.slot, dragEnd.slot) + 1] ||
															'18:15'}
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
	)
}
