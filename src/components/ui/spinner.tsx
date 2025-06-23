'use client'

import * as React from 'react'
import { Loader } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const spinnerVariants = cva('animate-spin-slow', {
	variants: {
		size: {
			sm: 'h-4 w-4',
			md: 'h-8 w-8',
			lg: 'h-12 w-12'
		},
		color: {
			dark: 'text-gray-800',
			light: 'text-white'
		}
	},
	defaultVariants: {
		size: 'sm',
		color: 'light'
	}
})

interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
	className?: string
}

const Spinner = ({ className, size, color }: SpinnerProps) => {
	return (
		<Loader className={cn(spinnerVariants({ size, color }), className)} />
	)
}

export { Spinner, spinnerVariants }
