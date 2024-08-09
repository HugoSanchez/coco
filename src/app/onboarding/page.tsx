'use client'

import { useState } from 'react'
import { ProfileSetup } from '@/components/ProfileSetup'
import { WeeklyAvailability } from '@/components/WeeklyAvailability'
import { OnboardingBreadcrumb } from '@/components/Breadcrumb'
import { Button } from '@/components/ui/button'

const steps = [
  { name: 'Create a Profile', description: 'Help your costumers know who you are.', component: ProfileSetup },
  { name: 'Set Availability', description: 'Set your availability', component: WeeklyAvailability },
  { name: 'Payment Setup', description: 'Set up your payment method', component: () => <div>Payment setup placeholder</div> },
]

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0)

  const CurrentStepComponent = steps[currentStep].component

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleStepComplete = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleStepClick = (index: number) => {
    // Only allow navigating to previous or current steps
    if (index <= currentStep) {
      setCurrentStep(index)
    }
  }

  return (
    <div className="container mx-auto lg:px-96 py-24">
        <OnboardingBreadcrumb 
        steps={steps} 
        currentStep={currentStep} 
        onStepClick={handleStepClick}
        />
        <div className="mt-12">
        <h1 className="text-2xl font-bold">{steps[currentStep].name}</h1>
        <p className="text-md text-gray-600 mb-8">{steps[currentStep].description}</p>
        <CurrentStepComponent onComplete={handleStepComplete} />
        </div>
        <div className="mt-8 flex justify-between">
        <Button 
            variant="ghost"
            onClick={handlePrevious} 
            disabled={currentStep === 0}
        >
            Previous
        </Button>
        <Button 
            variant="ghost"
            onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))} 
            disabled={currentStep === steps.length - 1}
        >
            {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
        </Button>
        </div>
    </div>
  )
}