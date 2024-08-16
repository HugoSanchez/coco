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
      <h3 className="text-lg font-light text-gray-900 mb-4">Available times for {format(date, 'EEEE, MMMM d')}</h3>
      <div className="grid grid-cols-1 gap-2">
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
              className="bg-white border border-gray-200 rounded-md py-4 px-4 hover:bg-emerald-50 hover:border-emerald-300 text-sm font-medium text-gray-700"
            >
              {format(startTime, 'h:mm a')}
            </button>
          )
        })}
      </div>
      <p className="mt-8 text-sm text-gray-500 font-light">Times are shown in your local timezone: {userTimeZone}</p>
    </div>
  )
}