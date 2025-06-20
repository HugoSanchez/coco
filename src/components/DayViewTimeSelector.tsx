/**
 * DayViewTimeSelector - Google Calendar Style Day View
 *
 * Drag to create time slots like Google Calendar
 */

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface DayViewTimeSelectorProps {
	date: Date
	onTimeSelect: (startTime: string, endTime: string) => void
	onClearSelection?: () => void
	existingBookings?: Array<{ start: string; end: string; title?: string }>
	initialSelectedSlot?: { start: string; end: string } | null
}

interface DragState {
	isDragging: boolean
	startY: number
	startTime: number // minutes from start of day
	currentTime: number // minutes from start of day
}

export function DayViewTimeSelector({
	date,
	onTimeSelect,
	onClearSelection,
	existingBookings = [],
	initialSelectedSlot = null
}: DayViewTimeSelectorProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [dragState, setDragState] = useState<DragState>({
		isDragging: false,
		startY: 0,
		startTime: 0,
		currentTime: 0
	})
	const [selectedSlot, setSelectedSlot] = useState<{
		start: number
		end: number
	} | null>(null)

	// Initialize selected slot from prop when component mounts or prop changes
	useEffect(() => {
		if (initialSelectedSlot) {
			const startDate = new Date(initialSelectedSlot.start)
			const endDate = new Date(initialSelectedSlot.end)
			const startMinutes =
				startDate.getHours() * 60 + startDate.getMinutes()
			const endMinutes = endDate.getHours() * 60 + endDate.getMinutes()

			setSelectedSlot({
				start: startMinutes,
				end: endMinutes
			})
		} else {
			setSelectedSlot(null)
		}
	}, [initialSelectedSlot])

	// Time range: 8 AM to 8 PM (12 hours = 720 minutes)
	const startHour = 8
	const endHour = 20
	const totalMinutes = (endHour - startHour) * 60
	const pixelsPerMinute = 1 // 1 pixel per minute, so 60px per hour

	// Convert pixel position to time in minutes from start of day
	const pixelToTime = useCallback((pixelY: number): number => {
		if (!containerRef.current) return 0
		const rect = containerRef.current.getBoundingClientRect()
		const relativeY = Math.max(0, Math.min(pixelY - rect.top, rect.height))
		const minutes = Math.round(relativeY / pixelsPerMinute)
		return startHour * 60 + minutes
	}, [])

	// Convert time in minutes from start of day to pixel position
	const timeToPixel = useCallback((timeInMinutes: number): number => {
		const minutesFromStart = timeInMinutes - startHour * 60
		return minutesFromStart * pixelsPerMinute
	}, [])

	// Format time from minutes to HH:MM
	const formatTime = useCallback((timeInMinutes: number): string => {
		const hours = Math.floor(timeInMinutes / 60)
		const minutes = timeInMinutes % 60
		return `${hours.toString().padStart(2, '0')}:${minutes
			.toString()
			.padStart(2, '0')}`
	}, [])

	// Snap time to 15-minute intervals
	const snapToInterval = useCallback((timeInMinutes: number): number => {
		return Math.round(timeInMinutes / 15) * 15
	}, [])

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			const startTime = snapToInterval(pixelToTime(e.clientY))

			setDragState({
				isDragging: true,
				startY: e.clientY,
				startTime,
				currentTime: startTime
			})
			setSelectedSlot(null)
		},
		[pixelToTime, snapToInterval]
	)

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!dragState.isDragging) return

			const currentTime = snapToInterval(pixelToTime(e.clientY))
			setDragState((prev) => ({
				...prev,
				currentTime
			}))
		},
		[dragState.isDragging, pixelToTime, snapToInterval]
	)

	const handleMouseUp = useCallback(() => {
		if (!dragState.isDragging) return

		const startTime = Math.min(dragState.startTime, dragState.currentTime)
		const endTime = Math.max(dragState.startTime, dragState.currentTime)

		// Minimum 15 minutes
		const finalEndTime = endTime <= startTime ? startTime + 15 : endTime

		setSelectedSlot({ start: startTime, end: finalEndTime })
		setDragState({
			isDragging: false,
			startY: 0,
			startTime: 0,
			currentTime: 0
		})

		// Convert to ISO strings and call callback
		const startDate = new Date(date)
		startDate.setHours(Math.floor(startTime / 60), startTime % 60, 0, 0)

		const endDate = new Date(date)
		endDate.setHours(Math.floor(finalEndTime / 60), finalEndTime % 60, 0, 0)

		onTimeSelect(startDate.toISOString(), endDate.toISOString())
	}, [dragState, date, onTimeSelect])

	// Generate hour labels
	const hours: number[] = []
	for (let hour = startHour; hour < endHour; hour++) {
		hours.push(hour)
	}

	// Calculate existing booking positions
	const bookingBlocks = existingBookings.map((booking) => {
		const start = new Date(booking.start)
		const end = new Date(booking.end)
		const startMinutes = start.getHours() * 60 + start.getMinutes()
		const endMinutes = end.getHours() * 60 + end.getMinutes()

		return {
			top: timeToPixel(startMinutes),
			height: timeToPixel(endMinutes) - timeToPixel(startMinutes),
			title: booking.title || 'Ocupado'
		}
	})

	// Calculate drag preview
	const dragPreview = dragState.isDragging
		? {
				top: timeToPixel(
					Math.min(dragState.startTime, dragState.currentTime)
				),
				height:
					timeToPixel(
						Math.max(dragState.startTime, dragState.currentTime)
					) -
						timeToPixel(
							Math.min(dragState.startTime, dragState.currentTime)
						) || 15 * pixelsPerMinute
		  }
		: null

	// Calculate selected slot display (reuse drag preview positioning)
	const selectedSlotDisplay = selectedSlot
		? {
				top: timeToPixel(selectedSlot.start),
				height:
					timeToPixel(selectedSlot.end) -
					timeToPixel(selectedSlot.start)
		  }
		: null

	return (
		<div className="">
			<div className="flex items-center justify-between">
				<h4 className="font-medium text-gray-900">
					{format(date, "EEEE, d 'de' MMMM 'de' yyyy", {
						locale: es
					})
						.replace(/^./, (c) => c.toUpperCase())
						.replace(
							/ de ([a-z])/,
							(match, p1) => ` de ${p1.toUpperCase()}`
						)}
				</h4>
				{selectedSlot && (
					<button
						onClick={() => {
							setSelectedSlot(null)
							onClearSelection?.()
						}}
						className="text-sm text-gray-500 hover:text-gray-700"
					>
						Resetear
					</button>
				)}
			</div>

			<div className="text-sm text-gray-600 mb-4">
				Arrastra para seleccionar un horario
			</div>

			{/* Day View Container */}
			<div className="relative border-2 border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
				<div className="flex">
					{/* Time Labels */}
					<div
						className="w-16 relative"
						style={{ paddingTop: '2px' }}
					>
						{hours.map((hour, index) => (
							<div
								key={hour}
								className="flex items-center justify-end pr-2"
								style={{ height: `${60 * pixelsPerMinute}px` }}
							>
								<span className="text-xs text-gray-600 font-medium">
									{formatTime(hour * 60)}
								</span>
							</div>
						))}
					</div>

					{/* Time Grid */}
					<div
						ref={containerRef}
						className="flex-1 relative cursor-crosshair select-none bg-gray-100"
						style={{
							height: `${totalMinutes * pixelsPerMinute}px`,
							paddingTop: '2px'
						}}
						onMouseDown={handleMouseDown}
						onMouseMove={handleMouseMove}
						onMouseUp={handleMouseUp}
						onMouseLeave={handleMouseUp}
					>
						{/* Hour Lines - extend across both columns */}
						{hours.map((hour) => (
							<div
								key={hour}
								className="absolute border-b border-gray-200"
								style={{
									top: `${
										(hour - startHour) *
										60 *
										pixelsPerMinute
									}px`,
									left: '-64px', // Extend into the time labels column
									right: '0px',
									width: 'calc(100% + 64px)'
								}}
							/>
						))}

						{/* 15-minute Lines - made slightly darker */}
						{Array.from({ length: totalMinutes / 15 }, (_, i) => (
							<div
								key={i}
								className="absolute w-full border-b border-gray-200"
								style={{ top: `${i * 15 * pixelsPerMinute}px` }}
							/>
						))}

						{/* Existing Bookings */}
						{bookingBlocks.map((block, index) => (
							<div
								key={index}
								className="absolute left-1 right-1 bg-red-100 border border-red-200 rounded px-2 py-1 text-xs text-red-700 z-10"
								style={{
									top: `${block.top}px`,
									height: `${block.height}px`
								}}
							>
								{block.title}
							</div>
						))}

						{/* Drag Preview / Selected Slot - Unified */}
						{(dragPreview || selectedSlotDisplay) && (
							<div
								className={`absolute left-1 right-1 rounded z-20 flex items-center justify-center text-sm font-medium ${
									dragPreview
										? 'bg-teal-200 border border-teal-300 opacity-75 text-teal-800'
										: 'bg-teal-100 border border-teal-300 text-teal-800'
								}`}
								style={{
									top: `${
										dragPreview?.top ||
										selectedSlotDisplay?.top
									}px`,
									height: `${
										dragPreview?.height ||
										selectedSlotDisplay?.height
									}px`
								}}
							>
								{dragPreview ? (
									// Show time range while dragging
									<>
										{formatTime(
											Math.min(
												dragState.startTime,
												dragState.currentTime
											)
										)}{' '}
										-{' '}
										{formatTime(
											Math.max(
												dragState.startTime,
												dragState.currentTime
											)
										)}
									</>
								) : (
									// Show selected slot content
									<div className="px-2 py-1 w-full">
										<div className="text-center">
											Nueva cita
										</div>
										<div className="text-teal-600 text-center">
											{formatTime(selectedSlot!.start)} -{' '}
											{formatTime(selectedSlot!.end)}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
