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
	existingBookings?: Array<{
		start: string
		end: string
		title?: string
		type?: string
		status?: 'pending' | 'confirmed'
		bookingId?: string
	}>
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
	const scrollContainerRef = useRef<HTMLDivElement>(null)
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

	// Scroll to 8 AM only once on mount
	useEffect(() => {
		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollTop =
				displayStartHour * 60 * pixelsPerMinute
		}
	}, []) // Empty dependency array = only runs once on mount

	// Configuration constants for time display and calculations
	const displayStartHour = 8 // Start displaying from 8 AM (auto-scroll position)
	const totalMinutes = 24 * 60 // Total minutes in a day (1440 minutes)
	const pixelsPerMinute = 1 // UI scale: 1 pixel per minute (60px per hour)

	/**
	 * Converts pixel Y position to time in minutes from midnight (00:00)
	 * @param pixelY - Y coordinate relative to the page
	 * @returns Minutes from midnight (0-1439)
	 */
	const pixelToTime = useCallback((pixelY: number): number => {
		// Safety check: ensure container exists before calculations
		if (!containerRef.current) return 0

		// Get container's position and dimensions on the page
		const rect = containerRef.current.getBoundingClientRect()

		// Calculate Y position relative to container top
		// Clamp between 0 and container height to prevent invalid values
		const relativeY = Math.max(0, Math.min(pixelY - rect.top, rect.height))

		// Convert pixels to minutes using our scale (1 pixel = 1 minute)
		const minutes = Math.round(relativeY / pixelsPerMinute)

		return minutes // Minutes from 00:00 (midnight)
	}, [])

	/**
	 * Converts time in minutes from midnight to pixel Y position
	 * @param timeInMinutes - Minutes from midnight (0-1439)
	 * @returns Pixel position from top of container
	 */
	const timeToPixel = useCallback((timeInMinutes: number): number => {
		return timeInMinutes * pixelsPerMinute
	}, [])

	/**
	 * Formats time from minutes to human-readable HH:MM format
	 * @param timeInMinutes - Minutes from midnight
	 * @returns Formatted time string (e.g., "14:30")
	 */
	const formatTime = useCallback((timeInMinutes: number): string => {
		// Extract hours by dividing by 60 and rounding down
		const hours = Math.floor(timeInMinutes / 60)

		// Extract remaining minutes using modulo operator
		const minutes = timeInMinutes % 60

		// Format both to 2 digits with leading zeros (e.g., "09:05")
		return `${hours.toString().padStart(2, '0')}:${minutes
			.toString()
			.padStart(2, '0')}`
	}, [])

	/**
	 * Snaps time to nearest 15-minute interval for user-friendly selection
	 * @param timeInMinutes - Raw time in minutes
	 * @returns Snapped time to nearest 15-minute mark
	 */
	const snapToInterval = useCallback((timeInMinutes: number): number => {
		return Math.round(timeInMinutes / 15) * 15
	}, [])

	/**
	 * Unified drag start handler for both mouse and touch events
	 * Extracts Y coordinate from event and initializes drag state
	 */
	const handleDragStart = useCallback(
		(clientY: number) => {
			// Convert Y coordinate to time and snap to 15-minute intervals
			const startTime = snapToInterval(pixelToTime(clientY))

			// Initialize drag state with starting position and time
			setDragState({
				isDragging: true, // Flag to track drag in progress
				startY: clientY, // Store original Y position
				startTime, // Time where drag started
				currentTime: startTime // Current time (starts same as start)
			})

			// Clear any previously selected slot when starting new drag
			setSelectedSlot(null)
		},
		[pixelToTime, snapToInterval]
	)

	/**
	 * Unified drag move handler for both mouse and touch events
	 * Updates current time during drag operation
	 */
	const handleDragMove = useCallback(
		(clientY: number) => {
			// Only process movement if we're actively dragging
			if (!dragState.isDragging) return

			// Convert current Y position to time and snap to intervals
			const currentTime = snapToInterval(pixelToTime(clientY))

			// Update only the currentTime, keeping other drag state intact
			setDragState((prev) => ({
				...prev, // Preserve isDragging, startY, startTime
				currentTime // Update only the current position
			}))
		},
		[dragState.isDragging, pixelToTime, snapToInterval]
	)

	/**
	 * Unified drag end handler for both mouse and touch events
	 * Finalizes the selection and calls the callback with ISO date strings
	 */
	const handleDragEnd = useCallback(() => {
		// Only process if we're actively dragging
		if (!dragState.isDragging) return

		// Calculate final time range ensuring start <= end
		// (handles both upward and downward drag directions)
		const startTime = Math.min(dragState.startTime, dragState.currentTime)
		const endTime = Math.max(dragState.startTime, dragState.currentTime)

		// Enforce minimum 15-minute duration for usability
		// If user made a very small selection, expand to 15 minutes
		const finalEndTime = endTime <= startTime ? startTime + 15 : endTime

		// Update component state with finalized selection
		setSelectedSlot({ start: startTime, end: finalEndTime })

		// Reset drag state to idle
		setDragState({
			isDragging: false, // No longer dragging
			startY: 0, // Clear Y position
			startTime: 0, // Clear start time
			currentTime: 0 // Clear current time
		})

		// Convert time values to proper Date objects for the selected date
		const startDate = new Date(date)
		startDate.setHours(
			Math.floor(startTime / 60), // Extract hours
			startTime % 60, // Extract minutes
			0, // Set seconds to 0
			0 // Set milliseconds to 0
		)

		const endDate = new Date(date)
		endDate.setHours(
			Math.floor(finalEndTime / 60), // Extract hours
			finalEndTime % 60, // Extract minutes
			0, // Set seconds to 0
			0 // Set milliseconds to 0
		)

		// Call parent callback with ISO date strings for API compatibility
		console.log('🗓️ [TimeSelector] Creating time slot:', {
			date: date.toISOString(),
			startTime: finalStartTime,
			endTime: finalEndTime,
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
			startDateLocal: startDate.toString(),
			endDateLocal: endDate.toString()
		})
		onTimeSelect(startDate.toISOString(), endDate.toISOString())
	}, [dragState, date, onTimeSelect])

	// Mouse event handlers - extract clientY and delegate to unified handlers
	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			handleDragStart(e.clientY)
		},
		[handleDragStart]
	)

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			handleDragMove(e.clientY)
		},
		[handleDragMove]
	)

	const handleMouseUp = useCallback(() => {
		handleDragEnd()
	}, [handleDragEnd])

	// Touch event handlers - extract clientY from first touch and delegate to unified handlers
	const handleTouchStart = useCallback(
		(e: React.TouchEvent) => {
			e.preventDefault()
			const touch = e.touches[0]
			handleDragStart(touch.clientY)
		},
		[handleDragStart]
	)

	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			const touch = e.touches[0]
			handleDragMove(touch.clientY)
		},
		[handleDragMove]
	)

	const handleTouchEnd = useCallback(() => {
		handleDragEnd()
	}, [handleDragEnd])

	// Generate array of hour numbers for rendering (0-23)
	const hours: number[] = []
	for (let hour = 0; hour < 24; hour++) {
		hours.push(hour)
	}

	/**
	 * Calculate visual positioning for existing bookings
	 * Converts booking times to pixel positions for rendering
	 */
	const bookingBlocks = existingBookings
		.map((booking) => {
			// Parse ISO date strings to Date objects
			const start = new Date(booking.start)
			const end = new Date(booking.end)

			// Check if this event is actually for the current day being displayed
			// Filter out events that have shifted to different days due to timezone conversion
			const selectedDateDay = date.getDate()
			const selectedDateMonth = date.getMonth()
			const selectedDateYear = date.getFullYear()

			const eventDay = start.getDate()
			const eventMonth = start.getMonth()
			const eventYear = start.getFullYear()

			// Skip events that don't match the selected date after timezone conversion
			if (
				eventDay !== selectedDateDay ||
				eventMonth !== selectedDateMonth ||
				eventYear !== selectedDateYear
			) {
				return null
			}

			// Convert times to minutes from midnight for calculations
			const startMinutes = start.getHours() * 60 + start.getMinutes()
			const endMinutes = end.getHours() * 60 + end.getMinutes()

			return {
				// Calculate pixel position from top of calendar
				top: timeToPixel(startMinutes),
				// Calculate height based on duration
				height: timeToPixel(endMinutes) - timeToPixel(startMinutes),
				// Use provided title or default fallback
				title: booking.title || 'Ocupado',
				// Determine booking type (system vs external calendar)
				type: booking.type || 'system',
				// Booking status for styling (pending vs confirmed)
				status: booking.status
			}
		})
		.filter((block): block is NonNullable<typeof block> => block !== null)

	/**
	 * Calculate drag preview positioning while user is actively dragging
	 * Shows a preview of the time slot being created
	 */
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
						) || 15 * pixelsPerMinute // Minimum height for visibility
			}
		: null

	/**
	 * Calculate selected slot display positioning after selection is complete
	 * Shows the finalized time slot selection
	 */
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
			<div
				className="relative border-2 border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto"
				ref={scrollContainerRef}
			>
				<div className="flex">
					{/* Time Labels */}
					<div
						className="w-16 relative"
						style={{ paddingTop: '2px' }}
					>
						{hours.map((hour, index) => (
							<div
								key={hour}
								className="flex items-center justify-center bg-white border-r-2 border-gray-300"
								style={{ height: `${60 * pixelsPerMinute}px` }}
							>
								<span className="text-sm text-gray-600 font-medium">
									{formatTime(hour * 60)}
								</span>
							</div>
						))}
					</div>

					{/* Time Grid */}
					<div
						ref={containerRef}
						className="flex-1 relative cursor-crosshair select-none bg-gray-50"
						style={{
							height: `${totalMinutes * pixelsPerMinute}px`,
							paddingTop: '2px'
						}}
						onMouseDown={handleMouseDown}
						onMouseMove={handleMouseMove}
						onMouseUp={handleMouseUp}
						onMouseLeave={handleMouseUp}
						onTouchStart={handleTouchStart}
						onTouchMove={handleTouchMove}
						onTouchEnd={handleTouchEnd}
					>
						{/* Hour Lines - extend across both columns */}
						{hours.map((hour) => (
							<div
								key={hour}
								className="absolute border-b border-gray-200"
								style={{
									top: `${hour * 60 * pixelsPerMinute}px`,
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
						{bookingBlocks.map((block, index) => {
							// Style based on event type and status
							let className =
								'absolute left-1 right-1 rounded px-2 py-1 text-xs z-10 '

							if (block.type === 'external') {
								className +=
									'bg-gray-100 border border-gray-300 text-gray-600'
							} else if (block.status === 'pending') {
								className +=
									'bg-teal-100 border border-teal-50 text-teal-800 font-medium'
							} else {
								className +=
									'bg-teal-400 border border-teal-50 text-teal-900 font-medium'
							}

							return (
								<div
									key={index}
									className={className}
									style={{
										top: `${block.top}px`,
										height: `${block.height}px`
									}}
									title={
										block.type === 'external'
											? 'Busy'
											: `${block.title} - ${block.status === 'pending' ? 'Pendiente' : 'Confirmado'}`
									}
								>
									<div>{block.title}</div>
									{block.type === 'system' && (
										<div className="text-xs opacity-75">
											{block.status === 'pending'
												? 'Pendiente'
												: 'Confirmado'}
										</div>
									)}
								</div>
							)
						})}

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
