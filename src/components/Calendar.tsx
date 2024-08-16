import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { 
    format, 
    addMonths, 
    subMonths, 
    startOfMonth, 
    endOfMonth, 
    eachDayOfInterval, 
    isSameMonth, 
    isSameDay, 
    isToday, 
    isBefore,
    startOfWeek,
    endOfWeek,
    isSunday
} from 'date-fns'

import { TimeSlot } from '@/lib/calendar'

interface CalendarProps {
    username: string
    selectedDay: Date | null
    onSelectDate: (date: Date) => void
    availableSlots: { [day: string]: TimeSlot[] };
}

export default function Calendar({ onSelectDate, selectedDay, availableSlots }: CalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date())

    useEffect(() => {
        // Ensure the initial month is set to the current month or later
        const today = new Date()
        if (isBefore(currentMonth, startOfMonth(today))) {
        setCurrentMonth(startOfMonth(today))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const prevMonth = () => {
        const newMonth = subMonths(currentMonth, 1)
        if (!isBefore(startOfMonth(newMonth), startOfMonth(new Date()))) {
        setCurrentMonth(newMonth)
        }
    }
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: startDate, end: endDate })

    return (
        <div className="w-full">
        <div className="flex items-center justify-between mb-4">
            <button 
                disabled={isSameMonth(currentMonth, new Date())}
                onClick={prevMonth} 
                className={`p-2 ${isSameMonth(currentMonth, new Date()) ? '' : 'rounded-full bg-emerald-100'}`}>
            <ChevronLeft className="h-5 w-5 text-gray-400" />
            </button>
            <h2 className="text-lg font-semibold text-gray-800">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={nextMonth} className="p-2 rounded-full bg-emerald-100">
            <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
            <div key={day} className="text-center md:p-2 md:h-10 md:w-10 md:text-left font-medium text-xs text-gray-400 mb-1 py-4">
                {day}
            </div>
            ))}
            {days.map(day => {
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isSelectable = isCurrentMonth && !isBefore(day, new Date())
                const dateKey = format(day, 'yyyy-MM-dd');
                const hasAvailableSlots = availableSlots[dateKey] && availableSlots[dateKey].length > 0 && day >= new Date();
                return (
                    <div 
                        key={day.toString()}
                        className='h-12 w-12 md:h-14 md:w-14 rounded-full text-center flex items-center justify-center'
                    >
                    <button
                        key={day.toString()}
                        onClick={() => isSelectable && onSelectDate(day)}
                        disabled={!isSelectable}
                        className={`p-2 h-10 w-10 md:h-12 md:w-12 text-center text-sm font-medium rounded-full 
                        ${hasAvailableSlots ? 'bg-emerald-100' : ''}
                        ${isSelectable ? 'hover:bg-emerald-200 hover:opacity-80' : 'cursor-default'}
                        ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                        ${isSameDay(day, selectedDay as Date) ? 'bg-emerald-200 text-emerald-500 font-semibold' : ''}
                        ${isSameDay(day, new Date()) && selectedDay === null ? 'bg-emerald-200' : ''}
                        ${isSameDay(day, new Date()) && selectedDay !== null ? 'bg-gray-200' : ''}
                        ${isSunday(day) ? '' : ''}`
                        }
                    >
                        {format(day, 'd')}
                    </button>
                </div>
                )
            })}
        </div>
        </div>
    )
}