'use client'

import { useState, useEffect } from 'react'
import { ProfileSetup } from '@/components/ProfileSetup'
import { WeeklyAvailability } from '@/components/WeeklyAvailability'
import { CalendarStep } from '@/components/CalendarStep'
import { OnboardingBreadcrumb } from '@/components/Breadcrumb'
import { BillingPreferencesStep } from '@/components/BillingPreferencesStep'
import { CustomerStep } from '@/components/CustomerStep'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'



const steps = [
  { name: '1. Crea tu perfil', description: 'Help your costumers know who you are.', component: ProfileSetup },
  { name: '2. Connecta tu calendario', description: 'This way coco will always be in sync with your google calendar.', component: CalendarStep },
  { name: '3. Facturación', description: 'Set your availability', component: BillingPreferencesStep },
  { name: '4. Tu primer paciente', description: 'If you have any questions, you can start by adding yourself to test our features!', component: CustomerStep },
]

export default function Onboarding() {
    const searchParams = useSearchParams()
    const step = searchParams.get('step')

    // Initialize currentStep based on URL parameter
    const initialStep = step ? Math.max(0, Math.min(parseInt(step) - 1, steps.length - 1)) : 0

    const [onNext, setOnNext] = useState(false)
    const [onPrevious, setOnPrevious] = useState(false)
    const [currentStep, setCurrentStep] = useState(initialStep)
    const router = useRouter()
    const calendarConnected = searchParams.get('calendar_connected')

    const CurrentStepComponent = steps[currentStep].component

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
          if (stepIndex >= 0 && stepIndex < steps.length && stepIndex !== currentStep) {
            setCurrentStep(stepIndex)
          }
        }
    }, [searchParams, currentStep])

    const handlePrevious = () => {
        setOnPrevious(true)
        if (currentStep > 0) {
            setOnPrevious(true)
            setCurrentStep(currentStep - 1)
        }
    }

    const handleStepComplete = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
            const nextStep = currentStep + 1
            router.push(`/onboarding?step=${nextStep + 1}`)
        } else if (currentStep === steps.length - 1) {
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
        <div className="container mx-auto lg:px-96 mt-16 py-2 bg-gray-50">
            <OnboardingBreadcrumb
            steps={steps}
            currentStep={currentStep}
            onStepClick={handleStepClick}
            />
            <div className="mt-12">
            	<CurrentStepComponent onComplete={handleStepComplete} />
            </div>
            <div className="mt-8 flex justify-between">

            {
                currentStep > 0 && (
                    <Button
                        variant="ghost"
                        onClick={handlePrevious}
                        disabled={currentStep === 0}
                    >
                        Previous
                    </Button>
                )
            }
            </div>
        </div>
    )
}
