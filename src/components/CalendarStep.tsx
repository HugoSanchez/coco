'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { ConnectCalendar } from '@/components/ConnectCalendar'

/**
 * Props interface for the CalendarStep component
 *
 * @interface CalendarStepProps
 * @property onComplete - Callback function called when the step is completed
 * @property title - Optional custom title for the step (defaults to step 2)
 * @property subtitle - Optional custom subtitle/description
 * @property buttonText - Optional custom text for the continue button
 * @property loadingText - Optional custom text shown during loading
 */
interface CalendarStepProps {
	onComplete: () => void
	title?: string
	subtitle?: string
	buttonText?: string
	loadingText?: string
}

/**
 * CalendarStep Component
 *
 * The second step in the onboarding process where users connect their Google Calendar.
 * This step is crucial for the booking system to work properly, as it allows
 * the application to sync with the user's existing calendar.
 *
 * FEATURES:
 * - Google Calendar connection via OAuth
 * - Customizable text content via props
 * - Loading states for form submission
 * - Integration with onboarding flow
 * - Automatic calendar sync setup
 *
 * ONBOARDING CONTEXT:
 * This is typically step 2 of the onboarding process, after profile setup
 * and before billing configuration. Calendar connection is essential for
 * the booking system to function properly.
 *
 * @component
 * @example
 * ```tsx
 * <CalendarStep
 *   onComplete={() => setCurrentStep(3)}
 *   title="Connect Your Calendar"
 *   subtitle="Sync with Google Calendar for seamless booking"
 * />
 * ```
 */
export function CalendarStep({
	onComplete,
	title = '2. Connecta tu calendario',
	subtitle = 'Coco estará siempre sincronizado con tu calendario de Google de manera que te resulte fácil y automático agendar nuevas consultas.',
	buttonText = 'Continuar',
	loadingText = 'Guardando...'
}: CalendarStepProps) {
	// State for loading indicator during form submission
	const [isLoading, setIsLoading] = useState(false)
	const { toast } = useToast()

	/**
	 * Handles form submission to complete the calendar step
	 *
	 * Currently just moves to the next step, but could be enhanced
	 * to verify calendar connection status before proceeding.
	 *
	 * @param e - Form submission event
	 */
	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		// This simply moves to the next step
		e.preventDefault()
		setIsLoading(true)
		onComplete()
		setIsLoading(false)
	}

	return (
		<div>
			{/* Step header with customizable title and subtitle */}
			<div>
				<h2 className="text-2xl font-bold">{title}</h2>
				<p className="text-md text-gray-500 my-2">{subtitle}</p>
			</div>

			{/* Calendar connection section */}
			<div className="mb-8">
				<div className="pt-2">
					{/* Google Calendar connection component */}
					<ConnectCalendar />
				</div>
			</div>

			{/* Continue button form */}
			<form onSubmit={handleSubmit} className="space-y-8">
				<Button
					type="submit"
					disabled={isLoading}
					className="h-12 w-full shadow-sm bg-teal-400 hover:bg-teal-400 hover:opacity-90 text-md"
				>
					{/* Show loading text or button text based on state */}
					{isLoading ? loadingText : buttonText}
				</Button>
			</form>
		</div>
	)
}
