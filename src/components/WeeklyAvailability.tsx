'use client'

import React, { useState, useEffect } from 'react'
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from '@/lib/supabase'
import { useToast } from "@/components/ui/use-toast"

const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const timezones = [
  { value: 'Etc/GMT', label: 'GMT/UTC+0' },
  { value: 'Europe/London', label: 'GMT+0 London' },
  { value: 'Europe/Dublin', label: 'GMT+0 Dublin' },
  { value: 'Europe/Lisbon', label: 'GMT+0 Lisbon' },
  { value: 'Africa/Casablanca', label: 'GMT+0 Casablanca' },
  { value: 'Europe/Paris', label: 'GMT+1 Paris' },
  { value: 'Europe/Berlin', label: 'GMT+1 Berlin' },
  { value: 'Europe/Rome', label: 'GMT+1 Rome' },
  { value: 'Europe/Madrid', label: 'GMT+1 Madrid' },
  { value: 'Europe/Athens', label: 'GMT+2 Athens' },
  { value: 'Europe/Kiev', label: 'GMT+2 Kiev' },
  { value: 'Africa/Cairo', label: 'GMT+2 Cairo' },
  { value: 'Europe/Moscow', label: 'GMT+3 Moscow' },
  { value: 'Asia/Istanbul', label: 'GMT+3 Istanbul' },
  { value: 'Asia/Dubai', label: 'GMT+4 Dubai' },
  { value: 'Asia/Karachi', label: 'GMT+5 Karachi' },
  { value: 'Asia/Dhaka', label: 'GMT+6 Dhaka' },
  { value: 'Asia/Bangkok', label: 'GMT+7 Bangkok' },
  { value: 'Asia/Singapore', label: 'GMT+8 Singapore' },
  { value: 'Asia/Tokyo', label: 'GMT+9 Tokyo' },
  { value: 'Australia/Sydney', label: 'GMT+10 Sydney' },
  { value: 'Pacific/Noumea', label: 'GMT+11 Noumea' },
  { value: 'Pacific/Auckland', label: 'GMT+12 Auckland' },
  { value: 'Pacific/Apia', label: 'GMT+13 Apia' },
  { value: 'Pacific/Kiritimati', label: 'GMT+14 Kiritimati' },
  { value: 'Atlantic/Azores', label: 'GMT-1 Azores' },
  { value: 'Atlantic/Cape_Verde', label: 'GMT-1 Cape Verde' },
  { value: 'Atlantic/South_Georgia', label: 'GMT-2 South Georgia' },
  { value: 'America/Sao_Paulo', label: 'GMT-3 São Paulo' },
  { value: 'America/New_York', label: 'GMT-5 New York' },
  { value: 'America/Chicago', label: 'GMT-6 Chicago' },
  { value: 'America/Denver', label: 'GMT-7 Denver' },
  { value: 'America/Los_Angeles', label: 'GMT-8 Los Angeles' },
  { value: 'America/Anchorage', label: 'GMT-9 Anchorage' },
  { value: 'Pacific/Honolulu', label: 'GMT-10 Honolulu' },
  { value: 'Pacific/Midway', label: 'GMT-11 Midway' },
  { value: 'Pacific/Niue', label: 'GMT-11 Niue' },
];

interface TimeSlot {
  start: string
  end: string
}

interface DayAvailability {
  isAvailable: boolean
  timeSlots: TimeSlot[]
}

export function WeeklyAvailability() {
  // State variables for the availability
  const [availability, setAvailability] = useState<DayAvailability[]>(
        daysOfWeek.map((day, index) => ({
            isAvailable: index >= 1 && index <= 5, // Monday to Friday are true
            timeSlots: [{ start: '09:00', end: '17:00' }]
        }))
    )
  
  // Create a toast
  const toast = useToast()
  
  // State variables for the form
  const [currency, setCurrency] = useState('EUR')
  const [timeZone, setTimeZone] = useState('UTC/GMT+0')
  const [meetingPrice, setMeetingPrice] = useState('0')
  const [meetingDuration, setMeetingDuration] = useState('30')

  // State variables for the save status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    // Set the time zone to the user's time zone
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const matchingTimeZone = timezones.find(tz => tz.value === userTimeZone);
    if (matchingTimeZone) {
      setTimeZone(matchingTimeZone.value);
    }
  }, []);

  const handleDayToggle = (index: number) => {
    // Toggle the availability of a day
    setAvailability(prev => prev.map((day, i) => 
      i === index ? { ...day, isAvailable: !day.isAvailable } : day
    ))
  }

  const handleTimeChange = (dayIndex: number, slotIndex: number, field: 'start' | 'end', value: string) => {
    // Handle the time change for a time slot
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
    // Add a time slot to a day
    setAvailability(prev => prev.map((day, i) => 
      i === dayIndex ? {
        ...day,
        timeSlots: [...day.timeSlots, { start: '09:00', end: '17:00' }]
      } : day
    ))
  }

  const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
    // Remove a time slot from a day
    setAvailability(prev => prev.map((day, i) => 
      i === dayIndex ? {
        ...day,
        timeSlots: day.timeSlots.filter((_, j) => j !== slotIndex)
      } : day
    ))
  }

  const testToast = () => {
    toast.toast({
      title: "Test",
      description: "This is a test toast.",
      color: 'bg-green-100'
    })
  }

  const handleSave = async () => {
    // Save the availability to the database
    setSaveStatus('loading');
    setStatusMessage('Saving your availability...');

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()
    
    // Handle user feedback if the user is not logged in
    if (!user) {
      toast.toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to save your availability.",
      })
      return
    }
    
    // Handle user feedback if the availability is being saved
    toast.toast({
      title: "Saving...",
      description: "Your availability is being saved.",
    })
    
    // Create the availability data object
    const availabilityData = {
      user_id: user.id,
      weekly_availability: availability,
      time_zone: timeZone,
      meeting_duration: parseInt(meetingDuration),
      meeting_price: parseFloat(meetingPrice),
      currency: currency
    }
    
    // Save the availability to the database
    const { data, error } = await supabase
      .from('schedules')
      .upsert(availabilityData, { onConflict: 'user_id' })
      .select()
  
    if (error) {
      console.error('Error saving availability:', error)
      alert('Failed to save availability. Please try again.')
    } else {
      console.log('Availability saved:', data)
      alert('Availability settings saved successfully!')
    }

     // Reset status
    setSaveStatus('idle');
    setStatusMessage('');
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
              {timezones.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
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

      <div>
        <Label htmlFor="price">Meeting Price</Label>
        <div className="flex items-center space-x-2">
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="currency" className="w-[80px]">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            id="price"
            placeholder="Enter price"
            value={meetingPrice}
            onChange={(e) => setMeetingPrice(e.target.value)}
            min="0"
            step="0.01"
            className="flex-grow"
          />
        </div>
      </div>

      <Button 
        onClick={testToast} 
        className="w-full"
        disabled={saveStatus === 'loading'}
      >
        {saveStatus === 'loading' ? 'Saving...' : 'Save Availability'}
      </Button>
    </div>
  )
}