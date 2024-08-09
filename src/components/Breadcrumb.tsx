import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

import React from "react"
import { cn } from "@/lib/utils"

  
interface BreadcrumbProps {
    steps: { name: string }[]
    currentStep: number
    onStepClick: (index: number) => void
}
  
export function OnboardingBreadcrumb({ steps, currentStep, onStepClick }: BreadcrumbProps) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          {steps.map((step, index) => (
            <React.Fragment key={step.name}>
              {index > 0 && <BreadcrumbSeparator />}
              <span 
                className={cn(
                  "inline-flex items-center",
                  index < currentStep ? "text-primary cursor-pointer" : 
                  index === currentStep ? "text-primary font-semibold" : "text-muted-foreground"
                )}
                onClick={() => index <= currentStep && onStepClick(index)}
              >
                {step.name}
              </span>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    )
  }