import { useState, useRef } from 'react'
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle
} from '@/components/ui/sheet'

/**
 * Props interface for the SideSheet component
 *
 * @interface SideSheetProps
 * @property isOpen - Controls whether the side sheet is visible
 * @property onClose - Callback function called when the sheet is closed
 * @property title - The title displayed in the sheet header
 * @property description - Optional description text below the title
 * @property children - The main content to display in the sheet
 * @property width - Optional width class (defaults to 'w-1/3')
 */
interface SideSheetProps {
	isOpen: boolean
	onClose: () => void
	title: React.ReactNode
	description?: React.ReactNode
	children: React.ReactNode
	width?: string // Optional width class, defaults to w-1/3
}

/**
 * SideSheet Component
 *
 * A reusable side panel modal component that slides in from the right side
 * of the screen. Built on top of the shadcn/ui Sheet component with custom
 * styling and behavior.
 *
 * FEATURES:
 * - Slides in from the right side of the screen
 * - Customizable width via CSS classes
 * - Header with title and optional description
 * - Scrollable content area
 * - Hidden close button (relies on external close handling)
 * - Consistent styling with gray background
 *
 * USAGE:
 * This component is commonly used for forms, settings panels, and detail views
 * that need to overlay the main content without taking up the full screen.
 *
 * @component
 * @example
 * ```tsx
 * <SideSheet
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Add New Client"
 *   description="Create a new client profile"
 *   width="w-1/2"
 * >
 *   <ClientForm />
 * </SideSheet>
 * ```
 */
export function SideSheet({
	isOpen,
	onClose,
	title,
	description,
	children,
	width = 'w-1/3'
}: SideSheetProps) {
	// State for tracking swipe gesture
	const [startX, setStartX] = useState<number | null>(null)
	const [currentX, setCurrentX] = useState<number | null>(null)
	const containerRef = useRef<HTMLDivElement>(null)

	// Handle touch start
	const handleTouchStart = (e: React.TouchEvent) => {
		const touch = e.touches[0]
		setStartX(touch.clientX)
	}

	// Handle touch move
	const handleTouchMove = (e: React.TouchEvent) => {
		if (!startX) return
		const touch = e.touches[0]
		setCurrentX(touch.clientX)
	}

	// Handle touch end
	const handleTouchEnd = () => {
		if (!startX || !currentX) {
			setStartX(null)
			setCurrentX(null)
			return
		}

		const diff = currentX - startX
		const threshold = 100 // Minimum swipe distance in pixels

		// If swiped right more than threshold, close the sheet
		if (diff > threshold) {
			onClose()
		}

		setStartX(null)
		setCurrentX(null)
	}
	return (
		<Sheet modal={false} open={isOpen}>
			{/* Sheet content with custom styling */}
			<SheetContent
				side="right"
				className={`w-full md:w-1/3 max-w-full md:px-2 overflow-y-auto bg-gray-50 [&>button]:hidden p-0`}
				onEscapeKeyDown={(e) => {
					// Allow closing with escape key
					onClose()
				}}
			>
				{/* Container with proper padding and swipe handling */}
				<div
					ref={containerRef}
					className="p-6 h-full"
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
				>
					{/* Sheet header with title and description */}
					<SheetHeader>
						<SheetTitle className="text-xl md:text-2xl font-bold">
							{title}
						</SheetTitle>
						{/* Optional description text */}
						{description && (
							<SheetDescription>{description}</SheetDescription>
						)}
					</SheetHeader>

					{/* Main content area */}
					{children}
				</div>
			</SheetContent>
		</Sheet>
	)
}
