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
	return (
		<Sheet open={isOpen} onOpenChange={onClose}>
			{/* Sheet content with custom styling */}
			<SheetContent
				side="right"
				className={`${width} w-screen md:w-1/3 overflow-y-auto p-8 bg-gray-50 [&>button]:hidden`}
			>
				{/* Sheet header with title and description */}
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2 text-2xl font-bold">
						{title}
					</SheetTitle>
					{/* Optional description text */}
					{description && (
						<SheetDescription>{description}</SheetDescription>
					)}
				</SheetHeader>

				{/* Main content area */}
				{children}
			</SheetContent>
		</Sheet>
	)
}
