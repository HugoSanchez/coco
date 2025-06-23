import {
	Breadcrumb,
	BreadcrumbList,
	BreadcrumbSeparator
} from '@/components/ui/breadcrumb'

import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Props interface for the OnboardingBreadcrumb component
 *
 * @interface BreadcrumbProps
 * @property steps - Array of step objects with names
 * @property currentStep - Index of the currently active step (0-based)
 * @property onStepClick - Callback function called when a step is clicked
 */
interface BreadcrumbProps {
	steps: { name: string }[]
	currentStep: number
	onStepClick: (index: number) => void
}

/**
 * OnboardingBreadcrumb Component
 *
 * A navigation breadcrumb component designed for multi-step processes like
 * onboarding flows. Shows the current progress and allows users to navigate
 * back to previous steps.
 *
 * FEATURES:
 * - Visual progress indicator for multi-step processes
 * - Clickable navigation to previous steps
 * - Different styling for completed, current, and future steps
 * - Responsive design with proper spacing
 *
 * STEP STATES:
 * - Completed steps: Primary color, clickable
 * - Current step: Primary color, bold, clickable
 * - Future steps: Muted color, not clickable
 *
 * USAGE:
 * Commonly used in onboarding flows, setup wizards, and multi-step forms
 * to show progress and allow step navigation.
 *
 * @component
 * @example
 * ```tsx
 * const steps = [
 *   { name: 'Profile' },
 *   { name: 'Calendar' },
 *   { name: 'Billing' }
 * ]
 *
 * <OnboardingBreadcrumb
 *   steps={steps}
 *   currentStep={1}
 *   onStepClick={(index) => setCurrentStep(index)}
 * />
 * ```
 */
export function OnboardingBreadcrumb({
	steps,
	currentStep,
	onStepClick
}: BreadcrumbProps) {
	return (
		<Breadcrumb>
			<BreadcrumbList>
				{steps.map((step, index) => (
					<React.Fragment key={step.name}>
						{/* Add separator between steps (except before first step) */}
						{index > 0 && <BreadcrumbSeparator />}

						{/* Step item with conditional styling and click behavior */}
						<span
							className={cn(
								'inline-flex items-center',
								// Completed steps: primary color, clickable
								index < currentStep
									? 'text-primary cursor-pointer'
									: // Current step: primary color, bold, clickable
									index === currentStep
									? 'text-primary font-semibold'
									: // Future steps: muted color, not clickable
									  'text-muted-foreground'
							)}
							onClick={() =>
								index <= currentStep && onStepClick(index)
							}
						>
							{step.name}
						</span>
					</React.Fragment>
				))}
			</BreadcrumbList>
		</Breadcrumb>
	)
}
