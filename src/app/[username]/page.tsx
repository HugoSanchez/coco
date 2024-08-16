'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Calendar from '@/components/Calendar'
import TimeSlots from '@/components/TimeSlots'
import { ConfirmationForm } from '@/components/ConfirmationForm'
import { Clock, ChevronLeft } from 'lucide-react'
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"

import { TimeSlot } from '@/lib/calendar'


export default function BookingPage() {
    const { username }:{username: string} = useParams()
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [availableSlots, setAvailableSlots] = useState<{ [day: string]: TimeSlot[]; }>({})
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [userTimeZone, setUserTimeZone] = useState('UTC') 
    const [currentMonth, setCurrentMonth] = useState(new Date())

    const handleMonthChange = (newMonth: Date) => {
        setCurrentMonth(newMonth)
    }
    
    const handleDateSelect = async (date: Date) => {
        setSelectedDate(date)
        setIsDrawerOpen(true)
    }

    const handleConfirmBooking = async (confirmationDetails: any) => {
        console.log('Confirming booking for:', confirmationDetails)
        // Handle booking confirmation
    }

    const handleClickBack = () => {
        // If there's a selected slot, we don't want to close the drawer
        // but render the available slots again.
        if (selectedSlot) setSelectedSlot(null)
        // If there's no selected slot, we close the drawer.
        else {
            setSelectedDate(null)
            setIsDrawerOpen(false)
        }
    }

    const fetchAvailableSlots = async (month: Date) => {
        try {
            const response = await fetch(`/api/available-slots?username=${username}&month=${month.toISOString()}`)
            if (!response.ok) throw new Error('Failed to fetch available slots')
            const data = await response.json()
            console.log(data)
            setAvailableSlots(data)
        } catch (error) {
            console.error('Error fetching available slots:', error)
            // Handle error (e.g., show error message to user)
        }
    }

    useEffect(() => {
        fetchAvailableSlots(currentMonth)
        setUserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username, currentMonth])

    return (
        <div className="container flex justify-center px-6 py-24 md:py-20 min-h-screen">
            <div className="mb:h-[80vh] md:max-w-[30vw] overflow-hidden">
                <div className="flex flex-col md:flex-row h-full">

                {/* Calendar and Time Slots Section */}
                <div className="flex flex-col md:flex-row">
                    <div className="md:mb-0k space-y-8 md:space-y-16">
                        <div className='flex flex-col'>
                            <h2 className='text-3xl font-light mb-2'>Book an appointment with {username.charAt(0).toUpperCase() + username.slice(1)}</h2>
                        </div>

                        <div className="w-full flex flex-col mt-4 md:flex-row">
                            <Calendar 
                                username={username}
                                selectedDay={selectedDate}
                                availableSlots={availableSlots}
                                onSelectDate={handleDateSelect} 
                                onMonthChange={handleMonthChange}
                                />
                        </div>
                        <div className='bg-gray-50'>
                            <h2 className="text-lg font-semibold">About {username.charAt(0).toUpperCase() + username.slice(1)}</h2>
                            <p className='text-md text-gray-700 font-light mb-6'>Book my personalized nutrition consultation today! Achieve balance, vitality, and well-being with expert guidance.</p>
                            <div className='flex flex-row items-center'>
                                <Clock className='w-4 h-4 mr-2' /> 
                                <p className='font-light text-gray-700'>{"60 minutes"}</p>
                            </div>      
                            
                        </div>
                    </div>
                </div>
                </div>
            </div>
            {/* Drawer for Time Slots */}
            <Drawer direction='right' open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <DrawerContent className="w-full sm:max-w-md bg-gray-50">
                    <div className="p-4">
                        <Button
                            variant="ghost"
                            onClick={handleClickBack}
                            className="mb-4"
                        >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                        <DrawerTitle>
                            
                        </DrawerTitle>
                        {selectedSlot ? (
                            <ConfirmationForm
                                selectedSlot={selectedSlot}
                                userTimeZone={userTimeZone}
                                onConfirm={handleConfirmBooking}
                                onCancel={() => setSelectedSlot(null)}
                            />
                        ) : (
                            <TimeSlots 
                                    date={selectedDate} 
                                    availableSlots={availableSlots} 
                                    userTimeZone={userTimeZone}
                                    onSelectSlot={(slot) => {
                                        // Handle slot selection
                                        console.log('Selected slot:', slot)
                                        setSelectedSlot(slot)
                                    }} 
                                />
                        )}
                        
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    )
    
}


/**
 * 
 * 
 * <div className="md:w-1/2 mb-6 md:mb-0k">
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
 * 
 *  <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700">Time zone</label>
              <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                <option>Central European Time (15:12)</option>
                
                </select>
                </div>
 * 
 */