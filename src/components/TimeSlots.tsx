import { format, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

interface TimeSlot {
  start: string;
  end: string;
}

interface TimeSlotsProps {
  date: Date | null
  availableSlots: { [day: string]: TimeSlot[] }
  onSelectSlot: (slot: TimeSlot) => void
  userTimeZone: string
}

export default function TimeSlots({ date, availableSlots, onSelectSlot, userTimeZone }: TimeSlotsProps) {
  if (!date) {
    return <div className="text-gray-500">Select a date to view available times</div>
  }

  const dateKey = format(date, 'yyyy-MM-dd')
  const slotsForDate = availableSlots[dateKey] || []

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">{format(date, 'EEEE, MMMM d')}</h3>
      <div className="grid grid-cols-1 gap-2 border border-blue-600">
        {
            slotsForDate.length === 0 && (
                <div className="text-gray-500">No available times for this day</div>
            )
        }
        {slotsForDate.map((slot, index) => {
          const startTime = toZonedTime(parseISO(slot.start), userTimeZone)
          const endTime = toZonedTime(parseISO(slot.end), userTimeZone)
          return (
            <button
              key={index}
              onClick={() => onSelectSlot(slot)}
              className="bg-white border border-gray-300 rounded-md py-2 px-4 hover:bg-blue-50 hover:border-blue-500 text-sm font-medium text-gray-700"
            >
              {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
            </button>
          )
        })}
      </div>
      <p className="mt-4 text-sm text-gray-500">Times are shown in your local timezone: {userTimeZone}</p>
    </div>
  )
}