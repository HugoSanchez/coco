'use client'

import * as React from 'react'
import { Loader } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const spinnerVariants = cva('animate-spin-slow text-primary', {
	variants: {
		size: {
			sm: 'h-4 w-4 text-white',
			md: 'h-8 w-8 text-white',
			lg: 'h-12 w-12 text-white'
		}
	},
	defaultVariants: {
		size: 'sm'
	}
})

interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
	className?: string
}

const Spinner = ({ className, size }: SpinnerProps) => {
	return <Loader className={cn(spinnerVariants({ size }), className)} />
}

export { Spinner, spinnerVariants }
