'use client'

import * as React from 'react'
import { Loader } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Spinner component variants configuration
 *
 * Defines the available size and color options for the spinner component
 * using class-variance-authority for type-safe styling.
 */
const spinnerVariants = cva('animate-spin-slow', {
	variants: {
		size: {
			sm: 'h-4 w-4', // Small spinner (16px)
			md: 'h-8 w-8', // Medium spinner (32px)
			lg: 'h-12 w-12' // Large spinner (48px)
		},
		color: {
			dark: 'text-gray-800', // Dark color for light backgrounds
			light: 'text-white' // Light color for dark backgrounds
		}
	},
	defaultVariants: {
		size: 'sm',
		color: 'light'
	}
})

/**
 * Props interface for the Spinner component
 *
 * Extends the variant props from class-variance-authority to provide
 * type-safe access to size and color options.
 */
interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
	/** Additional CSS classes to apply to the spinner */
	className?: string
}

/**
 * Spinner Component
 *
 * A customizable loading spinner that displays during async operations.
 * Built with class-variance-authority for type-safe styling variants.
 *
 * FEATURES:
 * - Multiple size options (sm, md, lg)
 * - Color variants for different backgrounds
 * - Customizable via className prop
 * - Smooth animation with custom timing
 *
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * <Spinner />
 *
 * // With custom size and color
 * <Spinner size="lg" color="dark" />
 *
 * // With additional classes
 * <Spinner className="my-4" size="md" />
 * ```
 */
const Spinner = ({ className, size, color }: SpinnerProps) => {
	return (
		<Loader className={cn(spinnerVariants({ size, color }), className)} />
	)
}

export { Spinner, spinnerVariants }
