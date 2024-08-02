'use client'

import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

export function AvailabilitySelector() {
  const [selectedDates, setSelectedDates] = React.useState<Date[]>([])
  const [availableTimes, setAvailableTimes] = React.useState<{ [date: string]: string[] }>({})

  const handleDateSelect = (date: Date | undefined | any) => {
    if (date) {
      setSelectedDates((prev) => 
        prev.some((d) => d.toDateString() === date.toDateString())
          ? prev.filter((d) => d.toDateString() !== date.toDateString())
          : [...prev, date]
      )
    }
  }

  const handleTimeSelect = (date: Date, time: string) => {
    const dateString = format(date, 'yyyy-MM-dd')
    setAvailableTimes((prev) => ({
      ...prev,
      [dateString]: prev[dateString]?.includes(time)
        ? prev[dateString].filter((t) => t !== time)
        : [...(prev[dateString] || []), time]
    }))
  }

  const timeSlots = [
    "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
  ]

  const handleSaveAvailability = () => {
    // TODO: Implement saving availability to the database
    console.log('Saving availability:', availableTimes)
  }

  return (
    <div className="space-y-4">
      <Calendar
        mode="multiple"
        selected={selectedDates}
        onSelect={handleDateSelect}
        className="rounded-md border"
      />
      <div className="space-y-2">
        {selectedDates.map((date) => (
          <Popover key={date.toISOString()}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                {format(date, 'MMMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid grid-cols-3 gap-2">
                {timeSlots.map((time) => (
                  <Button
                    key={time}
                    variant="outline"
                    className={cn(
                      availableTimes[format(date, 'yyyy-MM-dd')]?.includes(time) && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => handleTimeSelect(date, time)}
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ))}
      </div>
      <Button onClick={handleSaveAvailability} className="w-full">
        Save Availability
      </Button>
    </div>
  )
}