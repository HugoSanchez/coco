'use client'

import { useState, ReactNode, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { Label } from '@/components/ui/label'

interface CollapsibleSectionProps {
	title: string
	children: ReactNode
	defaultOpen?: boolean
	open?: boolean
	onOpenChange?: (open: boolean) => void
	className?: string
	contentClassName?: string
	showBackground?: boolean
}

/**
 * Reusable collapsible section component
 *
 * Features:
 * - Toggle button with chevron icon that rotates when open
 * - Smooth expand/collapse animation
 * - Can be controlled (open + onOpenChange) or uncontrolled (defaultOpen)
 *
 * @example
 * ```tsx
 * // Uncontrolled
 * <CollapsibleSection title="Billing Settings" defaultOpen={false}>
 *   <Input placeholder="Amount" />
 * </CollapsibleSection>
 *
 * // Controlled
 * <CollapsibleSection
 *   title="Billing Settings"
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 * >
 *   <Input placeholder="Amount" />
 * </CollapsibleSection>
 * ```
 */
export function CollapsibleSection({
	title,
	children,
	defaultOpen = false,
	open: controlledOpen,
	onOpenChange,
	className = '',
	contentClassName = '',
	showBackground = false
}: CollapsibleSectionProps) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen)
	const isControlled = controlledOpen !== undefined
	const isOpen = isControlled ? controlledOpen : internalOpen

	// Sync internal state with controlled prop
	useEffect(() => {
		if (isControlled && controlledOpen !== undefined) {
			setInternalOpen(controlledOpen)
		}
	}, [isControlled, controlledOpen])

	const handleToggle = () => {
		const newOpen = !isOpen
		if (isControlled) {
			onOpenChange?.(newOpen)
		} else {
			setInternalOpen(newOpen)
		}
	}

	return (
		<div className={`space-y-3 ${className}`}>
			<button
				type="button"
				onClick={handleToggle}
				className={`flex items-center justify-between w-full ${showBackground ? 'bg-gray-100 rounded-md p-4' : ''}`}
			>
				<Label className="text-md font-normal text-gray-700">{title}</Label>
				<ChevronRight
					className={`h-5 w-5 text-gray-600 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
				/>
			</button>

			<div
				className={`overflow-hidden transition-all duration-200 ${
					isOpen ? 'max-h-[1000px] opacity-100 mt-2' : 'max-h-0 opacity-0'
				}`}
			>
				<div className={contentClassName}>{children}</div>
			</div>
		</div>
	)
}
