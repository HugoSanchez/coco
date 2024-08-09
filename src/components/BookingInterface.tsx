import { useState, useEffect } from 'react';

export function BookingInterface({ userId }: { userId: string }) {
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);

  async function fetchAvailableSlots() {
    const startDate = new Date(); // Today
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const response = await fetch(`/api/available-slots?userId=${userId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
    const data = await response.json();
    setAvailableSlots(data.availableSlots);
  }

  useEffect(() => {
    fetchAvailableSlots();
    // Set up polling to refresh slots every minute
    const intervalId = setInterval(fetchAvailableSlots, 60000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleBooking = (slot: any) => {
    console.log('Booking', slot);
  };

  return (
    <div>
      <h2>Available Slots</h2>
      {availableSlots.map(slot => (
        <button key={slot.start} onClick={() => handleBooking(slot)}>
          {new Date(slot.start).toLocaleString()} - {new Date(slot.end).toLocaleString()}
        </button>
      ))}
    </div>
  );
}