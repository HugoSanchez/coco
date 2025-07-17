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
import { TrendingUp, TrendingDown, Info } from 'lucide-react'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@/components/ui/tooltip'
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
 * @property tooltipContent - Optional tooltip text for additional information
 * @property className - Additional CSS classes
 */
export interface StatCardProps {
	title: string
	value?: string | number
	change?: number | null
	changeLabel?: string
	icon?: React.ReactNode
	loading?: boolean
	error?: string | null
	onRetry?: () => void
	tooltipContent?: string
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
	tooltipContent,
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
	 * Renders the success state with formatted data
	 * Shows the main value and percentage change with appropriate styling
	 */
	const renderSuccessState = () => {
		// Determine if the change is positive, negative, or neutral
		const hasValidChange = change !== undefined && change !== null
		const isPositive = hasValidChange && change > 0
		const isNegative = hasValidChange && change < 0
		const isNeutral = hasValidChange && change === 0

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
			<TooltipProvider>
				<Card className={cn('', className)}>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							{tooltipContent ? (
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="flex items-center gap-1 cursor-pointer">
											{title}
											<Info className="h-3 w-3 text-muted-foreground" />
										</div>
									</TooltipTrigger>
									<TooltipContent>
										<p className="max-w-xs">
											{tooltipContent}
										</p>
									</TooltipContent>
								</Tooltip>
							) : (
								title
							)}
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
							{hasValidChange ? (
								<div
									className={cn(
										'flex items-center text-xs',
										changeTextColor
									)}
									aria-label={`${change! > 0 ? 'Increased' : change! < 0 ? 'Decreased' : 'No change'} by ${Math.abs(change!)}% ${changeLabel}`}
								>
									<span className="text-xs text-gray-500">
										{isPositive && '+'}
										{change}% {changeLabel}
									</span>
								</div>
							) : change === null ? (
								<div className="text-xs text-gray-500">
									Primera vez este período
								</div>
							) : null}
						</div>
					</CardContent>
				</Card>
			</TooltipProvider>
		)
	}

	// Render appropriate state based on loading/error conditions
	if (loading) {
		return renderLoadingState()
	}

	return renderSuccessState()
}

/**
 * Export default for easier imports
 */
export default StatCard
