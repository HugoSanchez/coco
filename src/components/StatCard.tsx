/**
 * StatCard Component - Reusable Dashboard Statistics Card
 *
 * This component provides a consistent interface for displaying dashboard metrics
 * with proper loading states, error handling, and formatted values.
 *
 * FEATURES:
 * - Loading skeleton animations
 * - Error state with retry functionality
 * - Formatted value display (currency, numbers, percentages)
 * - Color-coded percentage changes (green = positive, red = negative)
 * - Accessible design with proper ARIA labels
 * - Responsive layout
 *
 * USAGE:
 * <StatCard
 *   title="Total Revenue"
 *   value="€1,234.56"
 *   change={25}
 *   changeLabel="from last month"
 *   icon={<DollarSign />}
 *   loading={false}
 *   error={null}
 * />
 */

'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Props interface for the StatCard component
 * Provides comprehensive customization options for different metric types
 *
 * @interface StatCardProps
 * @property title - Card title/label (e.g., "Total Revenue")
 * @property value - Main value to display (e.g., "€1,234.56" or "42")
 * @property change - Percentage change number (e.g., 25 for +25%)
 * @property changeLabel - Label for the change period (e.g., "from last month")
 * @property icon - React component for the card icon
 * @property loading - Shows loading skeleton when true
 * @property error - Error message to display (if any)
 * @property onRetry - Optional retry function for error states
 * @property className - Additional CSS classes
 */
export interface StatCardProps {
	title: string
	value?: string | number
	change?: number
	changeLabel?: string
	icon?: React.ReactNode
	loading?: boolean
	error?: string | null
	onRetry?: () => void
	className?: string
}

/**
 * StatCard Component
 *
 * Renders a dashboard statistics card with the following states:
 * 1. Loading: Shows skeleton animation
 * 2. Error: Shows error message with optional retry
 * 3. Success: Shows formatted data with change indicator
 *
 * @param props - StatCardProps configuration object
 * @returns JSX.Element - Rendered statistics card
 */
export function StatCard({
	title,
	value,
	change,
	changeLabel = 'from last month',
	icon,
	loading = false,
	error = null,
	onRetry,
	className
}: StatCardProps): JSX.Element {
	/**
	 * Renders the loading skeleton state
	 * Provides visual feedback while data is being fetched
	 */
	const renderLoadingState = () => (
		<Card className={cn('', className)}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				{icon && (
					<div className="h-4 w-4 text-muted-foreground">{icon}</div>
				)}
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{/* Main value skeleton */}
					<div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
					{/* Change percentage skeleton */}
					<div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
				</div>
			</CardContent>
		</Card>
	)

	/**
	 * Renders the error state
	 * Shows error message with optional retry functionality
	 */
	const renderErrorState = () => (
		<Card className={cn('border-red-200 bg-red-50', className)}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium text-red-800">
					{title}
				</CardTitle>
				<AlertCircle className="h-4 w-4 text-red-600" />
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					<div className="text-sm text-red-700">
						{error || 'Failed to load data'}
					</div>
					{onRetry && (
						<button
							onClick={onRetry}
							className="text-xs text-red-600 hover:text-red-800 underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
							aria-label={`Retry loading ${title}`}
						>
							Try again
						</button>
					)}
				</div>
			</CardContent>
		</Card>
	)

	/**
	 * Renders the success state with formatted data
	 * Shows the main value and percentage change with appropriate styling
	 */
	const renderSuccessState = () => {
		// Determine if the change is positive, negative, or neutral
		const isPositive = change !== undefined && change > 0
		const isNegative = change !== undefined && change < 0
		const isNeutral = change === 0

		// Choose appropriate styling and icons based on change direction
		const changeTextColor = isPositive
			? 'text-green-600'
			: isNegative
				? 'text-red-600'
				: 'text-gray-600'

		const ChangeIcon = isPositive
			? TrendingUp
			: isNegative
				? TrendingDown
				: null

		return (
			<Card className={cn('', className)}>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">
						{title}
					</CardTitle>
					{icon && (
						<div className="h-4 w-4 text-muted-foreground">
							{icon}
						</div>
					)}
				</CardHeader>
				<CardContent>
					<div className="space-y-1">
						{/* Main value display */}
						<div
							className="text-2xl font-bold"
							aria-label={`${title}: ${value}`}
						>
							{value || '—'}
						</div>

						{/* Change percentage and period */}
						{change !== undefined && (
							<div
								className={cn(
									'flex items-center text-xs',
									changeTextColor
								)}
								aria-label={`${change > 0 ? 'Increased' : change < 0 ? 'Decreased' : 'No change'} by ${Math.abs(change)}% ${changeLabel}`}
							>
								<span className="text-xs text-gray-500">
									{isPositive && '+'}
									{change}% {changeLabel}
								</span>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		)
	}

	// Render appropriate state based on loading/error conditions
	if (loading) {
		return renderLoadingState()
	}

	if (error) {
		return renderErrorState()
	}

	return renderSuccessState()
}

/**
 * Export default for easier imports
 */
export default StatCard
