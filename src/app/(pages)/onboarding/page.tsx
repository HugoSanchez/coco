'use client'

import { useState, useEffect, Suspense } from 'react'
import { ProfileSetup } from '@/components/ProfileSetup'
import { WeeklyAvailability } from '@/components/WeeklyAvailability'
import { CalendarStep } from '@/components/CalendarStep'
import { OnboardingBreadcrumb } from '@/components/Breadcrumb'
import { BillingPreferencesStep } from '@/components/BillingPreferencesStep'
import { PaymentsStep } from '@/components/PaymentsStep'
import { CustomerStep } from '@/components/CustomerStep'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import confetti from 'canvas-confetti'
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription
} from '@/components/ui/card'
import { Check } from 'lucide-react'
import { captureOnboardingStep } from '@/lib/posthog/client'

// Force dynamic rendering since this page uses useSearchParams
export const dynamic = 'force-dynamic'

const steps = [
	{
		name: '1. Crea tu perfil',
		description: 'Help your costumers know who you are.',
		component: ProfileSetup
	},
	{
		name: '2. Calendario',
		description:
			'This way coco will always be in sync with your google calendar.',
		component: CalendarStep
	},
	{
		name: '3. Facturación',
		description: 'Set your availability',
		component: BillingPreferencesStep
	},
	{
		name: '4. Pagos',
		description: 'Connect your payment account to receive payments.',
		component: PaymentsStep
	},
	{
		name: '5. Tu primer paciente',
		description:
			'If you have any questions, you can start by adding yourself to test our features!',
		component: CustomerStep
	}
]

function OnboardingContent() {
	const searchParams = useSearchParams()
	const step = searchParams.get('step')

	// Initialize currentStep based on URL parameter
	const initialStep = step
		? Math.max(0, Math.min(parseInt(step) - 1, steps.length - 1))
		: -1 // -1 represents the Welcome screen

	const [onNext, setOnNext] = useState(false)
	const [onPrevious, setOnPrevious] = useState(false)
	const [currentStep, setCurrentStep] = useState(initialStep)
	const router = useRouter()
	const calendarConnected = searchParams.get('calendar_connected')

	const CurrentStepComponent =
		currentStep >= 0 ? steps[currentStep].component : null

	// Keep the rest of your useEffects for subsequent updates
	useEffect(() => {
		if (calendarConnected === 'true') {
			// Handle successful calendar connection
			// Maybe show a success toast or update UI
		}
	}, [calendarConnected])

	useEffect(() => {
		const step = searchParams.get('step')
		if (step) {
			const stepIndex = parseInt(step) - 1
			if (
				stepIndex >= 0 &&
				stepIndex < steps.length &&
				stepIndex !== currentStep
			) {
				setCurrentStep(stepIndex)
			}
		}
	}, [searchParams, currentStep])

	// Fire confetti on welcome screen
	useEffect(() => {
		if (currentStep === -1) {
			confetti({ particleCount: 40, spread: 70, origin: { y: 0.6 } })
		}
	}, [currentStep])

	const handleStart = () => {
		setCurrentStep(0)
		router.push(`/onboarding?step=1`)
	}

	// Render welcome screen (not a step) when no step is selected
	if (currentStep === -1) {
		return (
			<div className="min-h-screen flex items-center lg:max-w-3xl mx-auto px-4">
				<div className="flex flex-col items-center justify-center mb-20 text-center">
					<CardHeader className="text-center gap-4">
						<h1 className="text-5xl font-black text-primary">
							¡Bienvenid@ a coco!
						</h1>
						<p className="text-xl text-gray-600 font-light">
							En menos de 5 minutos tendrás tu cuenta activada con
							tu agenda y pasarela de pagos integradas. ¿Vamos a
							por ello?
						</p>
					</CardHeader>
					<Button
						onClick={handleStart}
						className="mt-2 px-10 text-base"
					>
						Activar cuenta
					</Button>
				</div>
			</div>
		)
	}

	const handlePrevious = () => {
		if (currentStep > 0) {
			const previousStep = currentStep - 1
			setCurrentStep(previousStep)
			router.push(`/onboarding?step=${previousStep + 1}`)
		}
	}

	const handleStepComplete = () => {
		if (currentStep < steps.length - 1) {
			setCurrentStep(currentStep + 1)
			const nextStep = currentStep + 1
			router.push(`/onboarding?step=${nextStep + 1}`)
		} else if (currentStep === steps.length - 1) {
			// User finished onboarding; by our flow, they have created their first client
			captureOnboardingStep('first_client_created')
			router.push('/dashboard')
		}
	}

	const handleStepClick = (index: number) => {
		// Only allow navigating to previous or current steps
		if (index <= currentStep) {
			router.push(`/onboarding?step=${index + 1}`)
			setCurrentStep(index)
		}
	}

	return (
		<div className="xl:px-96 md:px-44 px-6 mt-16 py-2 bg-gray-50">
			<OnboardingBreadcrumb
				steps={steps}
				currentStep={currentStep}
				onStepClick={handleStepClick}
			/>
			<div className="mt-12">
				{CurrentStepComponent && (
					<CurrentStepComponent onComplete={handleStepComplete} />
				)}
			</div>
			<div className="mt-8 flex justify-between">
				{currentStep > 0 && (
					<Button
						variant="ghost"
						onClick={handlePrevious}
						disabled={currentStep === 0}
					>
						Atrás
					</Button>
				)}
			</div>
		</div>
	)
}

export default function Onboarding() {
	return (
		<Suspense
			fallback={
				<div className="xl:px-96 md:px-44 px-6 mt-16 py-2 bg-gray-50">
					<div className="animate-pulse">
						<div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
						<div className="h-6 bg-gray-200 rounded w-1/2 mb-8"></div>
						<div className="h-96 bg-gray-200 rounded"></div>
					</div>
				</div>
			}
		>
			<OnboardingContent />
		</Suspense>
	)
}
