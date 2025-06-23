'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { ConnectCalendar } from '@/components/ConnectCalendar'
import { ClientFormFields } from '@/components/ClientFormFields'

/**
 * Props interface for the CustomerStep component
 *
 * @interface CustomerStepProps
 * @property onComplete - Callback function called when the step is completed
 */
interface CustomerStepProps {
	onComplete: () => void
}

/**
 * CustomerStep Component
 *
 * The fourth step in the onboarding process where users add their first client.
 * This step helps users get started by creating their first client relationship,
 * which is essential for testing the booking functionality.
 *
 * FEATURES:
 * - Client creation form for first client
 * - Clear instructions for users
 * - Integration with onboarding flow
 * - Success callback to proceed to next step
 *
 * ONBOARDING CONTEXT:
 * This is typically step 4 of the onboarding process, after users have
 * set up their profile, connected their calendar, and configured billing.
 *
 * @component
 * @example
 * ```tsx
 * <CustomerStep onComplete={() => setCurrentStep(5)} />
 * ```
 */
export function CustomerStep({ onComplete }: CustomerStepProps) {
	// State for loading indicator (currently unused but available for future use)
	const [isLoading, setIsLoading] = useState(false)
	const { toast } = useToast()

	/**
	 * Handles successful client creation
	 *
	 * Called when the first client is successfully created.
	 * Triggers the completion callback to move to the next onboarding step.
	 */
	const handleClientCreated = () => {
		// Client was successfully created, proceed to dashboard
		onComplete()
	}

	return (
		<div>
			{/* Step header with title and instructions */}
			<div>
				<h2 className="text-2xl font-bold">
					4. Añade tu primer cliente
				</h2>
				<p className="text-md text-gray-500 my-2">
					Si no lo tienes claro, puedes empezar por añadirte a ti
					mismo para así poder testear nuestras funcionalidades.
				</p>
			</div>

			{/* Client creation form section */}
			<div className="mb-8">
				<div className="pt-2">
					{/* Client form fields for creating the first client */}
					<ClientFormFields onSuccess={handleClientCreated} />
				</div>
			</div>
		</div>
	)
}
