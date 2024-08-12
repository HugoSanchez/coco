'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Calendar from '@/components/Calendar'
import TimeSlots from '@/components/TimeSlots'
import { getAvailableSlots } from '@/lib/calendar'
import { Clock, Video } from 'lucide-react'

export default function BookingPage() {
  const { username } = useParams()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])

  useEffect(() => {
    if (selectedDate) {
      // getAvailableSlots(username as string, selectedDate).then(setAvailableSlots)
    }
  }, [username, selectedDate])

  return (
    <div className="container mx-auto px-4 py-8 lg:py-24 min-h-screen max-w-7xl">
      <div className="h-[80vh] bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="flex flex-col md:flex-row h-full">
          {/* Information Section */}
          <div className="p-6 md:w-3/12 h-full border-r-2 border-gray-100">
            <h1 className="text-2xl font-semibold mb-2">{username}</h1>
            <h2 className="text-xl font-medium mb-4">Primera consulta</h2>
            <div className="flex items-center mb-2">
              <Clock className="w-5 h-5 mr-2 text-gray-500" />
              <span>30 min</span>
            </div>
            <div className="flex items-center">
              <Video className="w-5 h-5 mr-2 text-gray-500" />
              <span className="text-sm text-gray-600">Web conferencing details provided upon confirmation.</span>
            </div>
          </div>

          {/* Calendar and Time Slots Section */}
          <div className="p-6 md:w-9/12 flex flex-col md:flex-row">
            <div className="md:w-1/2 md:mb-0k">
                <h2 className="text-xl font-semibold mb-4">Select a Date & Time</h2>
                <div className="w-full flex flex-col md:flex-row md:space-x-6">
                    <Calendar onSelectDate={setSelectedDate} />
                </div>
            </div>
            <div className="md:w-1/2 mb-6 md:mb-0k">
              <div className="md:w-1/2 p-6">
                <TimeSlots 
                  date={selectedDate} 
                  availableSlots={availableSlots} 
                  onSelectSlot={(slot) => {
                    // Handle slot selection
                  }} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


/**
 * 
 * 
 *  <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700">Time zone</label>
              <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                <option>Central European Time (15:12)</option>
                
                </select>
                </div>
 * 
 */