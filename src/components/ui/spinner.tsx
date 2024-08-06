"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface SpinnerProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
    radius?: 'big' | 'small'
  }

const Spinner = React.forwardRef<HTMLInputElement, SpinnerProps>(
  ({ className, type, radius = 'big', ...props }, ref) => {
    return (
        <div
            className={` ${radius == 'big' ? 'h-8 w-8' : 'h-4 w-4'} inline-block animate-spin rounded-full border-2 border-solid border-current border-e-transparent align-[-0.125em] text-surface motion-reduce:animate-[spin_1.5s_linear_infinite] dark:text-white`}
            role="status">
            <span
            className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
            >Loading...</span
            >
      </div>
    )
  }
)
Spinner.displayName = "Spinner"

export { Spinner }