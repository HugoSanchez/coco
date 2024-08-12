'use client'

import { useState, useEffect } from 'react'
import { ProfileSetup } from '@/components/ProfileSetup'
import { WeeklyAvailability } from '@/components/WeeklyAvailability'
import { PaymentSetup } from '@/components/PaymentSetup'
import { OnboardingBreadcrumb } from '@/components/Breadcrumb'
import { Button } from '@/components/ui/button'
import { InfoIcon } from 'lucide-react'     
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'


const steps = [
  { name: 'Create a Profile', description: 'Help your costumers know who you are.', component: ProfileSetup },
  { name: 'Set Availability', description: 'Set your availability', component: WeeklyAvailability },
  { name: 'Payment Setup', description: 'Set up your payment method', component: PaymentSetup },
]

export default function Onboarding() {

    const [onNext, setOnNext] = useState(false)
    const [onPrevious, setOnPrevious] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const router = useRouter()
    const searchParams = useSearchParams()

    const CurrentStepComponent = steps[currentStep].component

    useEffect(() => {
        const step = searchParams.get('step')
        if (step) {
          const stepIndex = parseInt(step) - 1
          if (stepIndex >= 0 && stepIndex < steps.length) {
            setCurrentStep(stepIndex)
          }
        }
      }, [searchParams])

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
        <div className="container mx-auto lg:px-96 py-24 bg-gray-50">
            <OnboardingBreadcrumb 
            steps={steps} 
            currentStep={currentStep} 
            onStepClick={handleStepClick}
            />
            <div className="mt-12">
                <div className='flex flex-row items-center gap-2 mb-12'>
                    <h1 className="text-2xl font-bold">{steps[currentStep].name}</h1>
                    <InfoIcon className='h-4 w-4 text-gray-500' />
                </div>
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