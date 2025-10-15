'use client'

import { useState, useEffect } from 'react'
import {
	ChevronLeft,
	ChevronRight,
	Calendar,
	List,
	SlidersHorizontal,
	Settings,
	Check,
	Clock,
	X,
	User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Booking {
	id: string
	type: 'booking' | 'busy'
	patientName: string
	appointmentType: string
	startTime: string
	endTime: string
	date: string
	status: 'completed' | 'scheduled' | 'canceled' | 'waiting'
}

const mockBookings: Booking[] = [
	{
		id: '1',
		type: 'booking',
		patientName: 'Tony Hack',
		appointmentType: 'General Check-up',
		startTime: '09:00',
		endTime: '10:00',
		date: '2025-04-21',
		status: 'completed'
	},
	{
		id: '2',
		type: 'booking',
		patientName: 'James Wong',
		appointmentType: 'Blood Pressure Check',
		startTime: '09:30',
		endTime: '10:30',
		date: '2025-04-22',
		status: 'completed'
	},
	{
		id: 'busy-1',
		type: 'busy',
		patientName: '',
		appointmentType: '',
		startTime: '08:00',
		endTime: '09:00',
		date: '2025-04-22',
		status: 'scheduled'
	},
	{
		id: '3',
		type: 'booking',
		patientName: 'Jamie Ulric',
		appointmentType: 'Follow-up Consultation',
		startTime: '10:30',
		endTime: '11:30',
		date: '2025-04-21',
		status: 'canceled'
	},
	{
		id: '4',
		type: 'booking',
		patientName: 'Henderson Kai',
		appointmentType: 'Prescription Refill',
		startTime: '10:30',
		endTime: '11:30',
		date: '2025-04-23',
		status: 'scheduled'
	},
	{
		id: '5',
		type: 'booking',
		patientName: 'Emily Watford',
		appointmentType: 'Headache',
		startTime: '11:00',
		endTime: '12:00',
		date: '2025-04-22',
		status: 'waiting'
	},
	{
		id: 'busy-2',
		type: 'busy',
		patientName: '',
		appointmentType: '',
		startTime: '12:00',
		endTime: '13:00',
		date: '2025-04-23',
		status: 'scheduled'
	},
	{
		id: '6',
		type: 'booking',
		patientName: 'Leo Wildheart',
		appointmentType: 'Chronic Condition Review',
		startTime: '09:00',
		endTime: '10:00',
		date: '2025-04-24',
		status: 'scheduled'
	},
	{
		id: '7',
		type: 'booking',
		patientName: 'Thomas Andre',
		appointmentType: 'General Check-up',
		startTime: '09:30',
		endTime: '10:30',
		date: '2025-04-25',
		status: 'scheduled'
	},
	{
		id: '8',
		type: 'booking',
		patientName: 'Tannia Burg',
		appointmentType: 'Mental Health Consultation',
		startTime: '10:00',
		endTime: '11:00',
		date: '2025-04-24',
		status: 'canceled'
	},
	{
		id: 'busy-3',
		type: 'busy',
		patientName: '',
		appointmentType: '',
		startTime: '14:00',
		endTime: '15:30',
		date: '2025-04-24',
		status: 'scheduled'
	},
	{
		id: '9',
		type: 'booking',
		patientName: 'Ling Ling Ben',
		appointmentType: 'Lab Results Discussion',
		startTime: '11:00',
		endTime: '12:00',
		date: '2025-04-25',
		status: 'scheduled'
	},
	{
		id: '10',
		type: 'booking',
		patientName: 'Lee Sung Yin',
		appointmentType: 'Blood Test',
		startTime: '13:00',
		endTime: '14:00',
		date: '2025-04-21',
		status: 'completed'
	},
	{
		id: '11',
		type: 'booking',
		patientName: 'Lina Garcia',
		appointmentType: 'Skin Rash',
		startTime: '13:00',
		endTime: '14:00',
		date: '2025-04-22',
		status: 'scheduled'
	},
	{
		id: '12',
		type: 'booking',
		patientName: 'Ryo Kzuhaki',
		appointmentType: 'Injury Evaluation',
		startTime: '13:00',
		endTime: '14:00',
		date: '2025-04-24',
		status: 'scheduled'
	},
	{
		id: '13',
		type: 'booking',
		patientName: 'Emily Walts',
		appointmentType: 'Routine Check',
		startTime: '13:30',
		endTime: '14:30',
		date: '2025-04-23',
		status: 'scheduled'
	},
	{
		id: '14',
		type: 'booking',
		patientName: 'Lily Chen',
		appointmentType: 'Vaccination',
		startTime: '13:30',
		endTime: '14:30',
		date: '2025-04-25',
		status: 'scheduled'
	},
	{
		id: 'busy-4',
		type: 'busy',
		patientName: '',
		appointmentType: '',
		startTime: '15:00',
		endTime: '16:00',
		date: '2025-04-25',
		status: 'scheduled'
	}
]

const timeSlots = [
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
	'18:00'
]

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
	const [bookings, setBookings] = useState<Booking[]>(mockBookings)
	const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar')

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

	// Fetch events for each day in the visible week and map to component format
	useEffect(() => {
		const toUtcDayBounds = (day: Date) => {
			const start = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0))
			const end = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999))
			return { startIso: start.toISOString(), endIso: end.toISOString() }
		}

		const formatHHmm = (iso: string) => {
			const d = new Date(iso)
			return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
		}

		const mapEventsToBookings = (events: any[]): Booking[] => {
			return events.map((ev: any) => {
				if (ev.type === 'system') {
					return {
						id: ev.bookingId ? String(ev.bookingId) : `sys-${ev.start}-${ev.end}`,
						type: 'booking',
						patientName: ev.title || 'Cliente',
						appointmentType: '',
						startTime: formatHHmm(ev.start),
						endTime: formatHHmm(ev.end),
						date: String(ev.start).split('T')[0],
						status: ev.status === 'canceled' ? 'canceled' : 'scheduled'
					}
				}
				return {
					id: `busy-${ev.start}-${ev.end}`,
					type: 'busy',
					patientName: '',
					appointmentType: '',
					startTime: formatHHmm(ev.start),
					endTime: formatHHmm(ev.end),
					date: String(ev.start).split('T')[0],
					status: 'scheduled'
				}
			})
		}

		const fetchWeek = async () => {
			try {
				const requests = weekDays.map((day) => {
					const { startIso, endIso } = toUtcDayBounds(day)
					return fetch(
						`/api/calendar/events?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`
					)
				})
				const responses = await Promise.all(requests)
				const jsons = await Promise.all(responses.map(async (res) => (res.ok ? res.json() : { events: [] })))
				const combined = jsons.flatMap((j: any) => j.events || [])
				const mapped = mapEventsToBookings(combined)
				setBookings(mapped)
			} catch (e) {
				// On error, keep existing bookings (could add toast/logging later)
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
		const dateStr = date.toISOString().split('T')[0]
		return bookings.filter((booking) => booking.date === dateStr)
	}

	const getTodayAppointments = () => {
		const today = new Date().toISOString().split('T')[0]
		return bookings.filter((booking) => booking.date === today).length
	}

	const getBookingPosition = (startTime: string, endTime: string) => {
		// Grid window from first slot to last slot + 30min
		const parseHm = (hm: string) => {
			const [h, m] = hm.split(':').map((v) => Number.parseInt(v))
			return h * 60 + m
		}
		const gridStartMin = parseHm(timeSlots[0])
		const gridEndMin = parseHm(timeSlots[timeSlots.length - 1]) + 30

		const startMin = parseHm(startTime)
		const endMin = parseHm(endTime)

		// If event doesn't overlap the visible window, don't render
		if (endMin <= gridStartMin || startMin >= gridEndMin) return null

		// Clamp to visible window
		const visibleStart = Math.max(startMin, gridStartMin)
		const visibleEnd = Math.min(endMin, gridEndMin)
		const pxPerMin = 50 / 30 // 50px per 30 minutes

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
		if (isDragging && dragStart && dragStart.day === dayIndex) {
			setDragEnd({ day: dayIndex, slot: slotIndex })
		}
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
				endTime: timeSlots[endSlot + 1] || '18:30'
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

	const getStatusBadge = (status: Booking['status']) => {
		switch (status) {
			case 'completed':
				return {
					bg: 'bg-teal-50',
					text: 'text-teal-700',
					icon: <Check className="h-3 w-3" />,
					label: 'Completed'
				}
			case 'scheduled':
				return {
					bg: 'bg-blue-50',
					text: 'text-blue-700',
					icon: <Clock className="h-3 w-3" />,
					label: 'Scheduled'
				}
			case 'canceled':
				return {
					bg: 'bg-red-50',
					text: 'text-red-700',
					icon: <X className="h-3 w-3" />,
					label: 'Canceled'
				}
			case 'waiting':
				return {
					bg: 'bg-amber-50',
					text: 'text-amber-700',
					icon: <User className="h-3 w-3" />,
					label: 'Patient is waiting'
				}
		}
	}

	const getBorderColor = (status: Booking['status']) => {
		switch (status) {
			case 'completed':
				return 'border-l-teal-500'
			case 'scheduled':
				return 'border-l-blue-500'
			case 'canceled':
				return 'border-l-red-500'
			case 'waiting':
				return 'border-l-amber-500'
		}
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

			<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
				{/* Day Headers */}
				<div className="flex border-b border-gray-200">
					<div className="w-20 flex-shrink-0 p-3 text-xs font-medium text-gray-500">GMT +7</div>
					<div className={`flex-1 grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'}`}>
						{weekDays.map((day, index) => {
							const isToday = day.toDateString() === new Date(2025, 3, 22).toDateString()
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
				<div className="flex" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
					<div className="w-20 flex-shrink-0 border-r border-gray-200">
						{timeSlots.map((time, index) => {
							const isHourMark = time.endsWith(':00')
							return (
								<div
									key={time}
									className={`h-[50px] ${isHourMark ? 'border-t border-gray-300' : 'border-t border-gray-100'} px-2 py-1 text-xs text-gray-500`}
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
										return (
											<div
												key={time}
												className={`h-[50px] ${isHourMark ? 'border-t border-gray-300' : 'border-t border-gray-100'} cursor-pointer hover:bg-gray-50 transition-colors ${
													isSlotInDragSelection(dayIndex, slotIndex) ? 'bg-teal-100' : ''
												}`}
												onMouseDown={() => handleMouseDown(dayIndex, slotIndex)}
												onMouseEnter={() => handleMouseEnter(dayIndex, slotIndex)}
											/>
										)
									})}

									{dayBookings.map((booking) => {
										const position = getBookingPosition(booking.startTime, booking.endTime)
										if (!position) return null

										// Render busy slots with different styling
										if (booking.type === 'busy') {
											return (
												<div
													key={booking.id}
													className="absolute left-2 right-2 bg-gray-100 rounded border border-gray-300 border-l-4 border-l-gray-400 cursor-not-allowed z-0 overflow-hidden"
													style={{
														top: position.top,
														height: position.height,
														backgroundImage:
															'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)'
													}}
												>
													<div className="p-2 h-full flex flex-col justify-center">
														<div className="text-xs text-gray-500">
															{booking.startTime} - {booking.endTime}
														</div>
														<div className="font-medium text-sm text-gray-600 mt-0.5">
															Busy
														</div>
													</div>
												</div>
											)
										}

										// Render regular bookings
										const statusBadge = getStatusBadge(booking.status)
										const borderColor = getBorderColor(booking.status)

										return (
											<div
												key={booking.id}
												className={`absolute left-2 right-2 bg-white rounded border border-gray-200 border-l-4 ${borderColor} cursor-pointer transition-all hover:shadow-md pointer-events-auto z-0 overflow-hidden`}
												style={{
													top: position.top,
													height: position.height
												}}
											>
												<div className="p-2 h-full flex flex-col">
													<div className="flex-1">
														<div className="text-xs text-gray-600">
															{booking.startTime} - {booking.endTime}
														</div>
														<div className="font-semibold text-sm text-gray-900 mt-0.5">
															{booking.patientName}
														</div>
														<div className="text-xs text-gray-600 mt-0.5">
															{booking.appointmentType}
														</div>
													</div>
													<div
														className={`flex items-center gap-1.5 mt-2 px-2 py-1 rounded text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
													>
														{statusBadge.icon}
														{statusBadge.label}
													</div>
												</div>
											</div>
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
