import { format } from 'date-fns'

interface TimeSlotsProps {
  date: Date | null
  availableSlots: string[]
  onSelectSlot: (slot: string) => void
}

export default function TimeSlots({ date, availableSlots, onSelectSlot }: TimeSlotsProps) {
  if (!date) {
    return <div className="text-gray-500">Select a date to view available times</div>
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">{format(date, 'EEEE, MMMM d')}</h3>
      <div className="grid grid-cols-1 gap-2">
        {availableSlots.map(slot => (
          <button
            key={slot}
            onClick={() => onSelectSlot(slot)}
            className="bg-white border border-gray-300 rounded-md py-2 px-4 hover:bg-blue-50 hover:border-blue-500 text-sm font-medium text-gray-700"
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  )
}