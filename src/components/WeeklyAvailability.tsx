'use client'

import React, { useState } from 'react'
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

interface TimeSlot {
  start: string
  end: string
}

interface DayAvailability {
  isAvailable: boolean
  timeSlots: TimeSlot[]
}

export function WeeklyAvailability() {
  const [availability, setAvailability] = useState<DayAvailability[]>(
        daysOfWeek.map((day, index) => ({
            isAvailable: index >= 1 && index <= 5, // Monday to Friday are true
            timeSlots: [{ start: '09:00', end: '17:00' }]
        }))
    )
 
  const [timeZone, setTimeZone] = useState('UTC')
  const [meetingDuration, setMeetingDuration] = useState('30')

  const handleDayToggle = (index: number) => {
    setAvailability(prev => prev.map((day, i) => 
      i === index ? { ...day, isAvailable: !day.isAvailable } : day
    ))
  }

  const handleTimeChange = (dayIndex: number, slotIndex: number, field: 'start' | 'end', value: string) => {
    setAvailability(prev => prev.map((day, i) => 
      i === dayIndex ? {
        ...day,
        timeSlots: day.timeSlots.map((slot, j) => 
          j === slotIndex ? { ...slot, [field]: value } : slot
        )
      } : day
    ))
  }

  const addTimeSlot = (dayIndex: number) => {
    setAvailability(prev => prev.map((day, i) => 
      i === dayIndex ? {
        ...day,
        timeSlots: [...day.timeSlots, { start: '09:00', end: '17:00' }]
      } : day
    ))
  }

  const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
    setAvailability(prev => prev.map((day, i) => 
      i === dayIndex ? {
        ...day,
        timeSlots: day.timeSlots.filter((_, j) => j !== slotIndex)
      } : day
    ))
  }

  const handleSave = () => {
    // TODO: Implement saving to database
    console.log('Saving availability:', { availability, timeZone, meetingDuration })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Available hours</h2>
      <p className="text-gray-600">
        Set the times that people will be able to schedule meetings with you.
      </p>
      
      <div className="space-y-4 bg-gray-50 p-4 rounded-md">
        <p className='text-xl font-bold'>Weekly hours</p>
        {availability.map((day, dayIndex) => (
          <div key={dayIndex} className="flex flex-col space-y-2">
            <div className="flex items-center space-x-4">
              <div className='flex w-6 items-center justify-center'>
                <Checkbox
                  id={`day-${dayIndex}`}
                  checked={day.isAvailable}
                  onCheckedChange={() => handleDayToggle(dayIndex)}
                />
              </div>
              <Label htmlFor={`day-${dayIndex}`} className="font-bold w-14">
                {daysOfWeek[dayIndex]}
              </Label>
              
              {day.isAvailable && day.timeSlots.length > 0 ? (
                <div className="flex items-center space-x-2 flex-grow">
                  <Input
                    type="time"
                    value={day.timeSlots[0].start}
                    onChange={(e) => handleTimeChange(dayIndex, 0, 'start', e.target.value)}
                    className="w-24"
                  />
                  <span>-</span>
                  <Input
                    type="time"
                    value={day.timeSlots[0].end}
                    onChange={(e) => handleTimeChange(dayIndex, 0, 'end', e.target.value)}
                    className="w-24"
                  />
                  {day.timeSlots.length === 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTimeSlot(dayIndex, 0)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ) : (
                <p className="font-light text-gray-500 flex-grow">
                  {day.isAvailable ? 'No time slots' : 'Unavailable'}
                </p>
              )}
              
              {day.isAvailable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addTimeSlot(dayIndex)}
                  className='text-xl font-extralight'
                >
                  +
                </Button>
              )}
            </div>
            
            {day.isAvailable && day.timeSlots.length > 1 && (
              <div className="ml-28 space-y-2 border border-black">
                
                {day.timeSlots.slice(1).map((slot, slotIndex) => (
                  <div key={slotIndex + 1} className="flex items-center space-x-2 pl-30">
                    <Input
                      type="time"
                      value={slot.start}
                      onChange={(e) => handleTimeChange(dayIndex, slotIndex + 1, 'start', e.target.value)}
                      className="w-24"
                    />
                    <span>-</span>
                    <Input
                      type="time"
                      value={slot.end}
                      onChange={(e) => handleTimeChange(dayIndex, slotIndex + 1, 'end', e.target.value)}
                      className="w-24"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTimeSlot(dayIndex, slotIndex + 1)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="timezone">Time Zone</Label>
          <Select value={timeZone} onValueChange={setTimeZone}>
            <SelectTrigger id="timezone">
              <SelectValue placeholder="Select time zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UTC">UTC</SelectItem>
              <SelectItem value="America/New_York">Eastern Time</SelectItem>
              <SelectItem value="America/Chicago">Central Time</SelectItem>
              <SelectItem value="America/Denver">Mountain Time</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="duration">Meeting Duration</Label>
          <Select value={meetingDuration} onValueChange={setMeetingDuration}>
            <SelectTrigger id="duration">
              <SelectValue placeholder="Select meeting duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleSave} className="w-full">
        Save Availability
      </Button>
    </div>
  )
}