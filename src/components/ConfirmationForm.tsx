import { useState } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { TimeSlot } from '@/lib/calendar'

interface ConfirmationFormProps {
    selectedSlot: TimeSlot;
    userTimeZone: string;
    onConfirm: (bookingDetails: BookingDetails) => void;
    onCancel: () => void;
}

interface BookingDetails {
    name: string;
    email: string;
}

export function ConfirmationForm({ selectedSlot, userTimeZone, onConfirm, onCancel }: ConfirmationFormProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    const startTime = toZonedTime(new Date(selectedSlot.start), userTimeZone);
    const endTime = toZonedTime(new Date(selectedSlot.end), userTimeZone);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm({ name, email });
    };

    return (
        <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Confirm Your Booking</h2>
        <p className="mb-4">
            You&apos;re booking an appointment for:
            <br />
            <strong>{format(startTime, 'MMMM d, yyyy')}</strong>
            <br />
            <strong>{format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}</strong>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
            <Input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
            />
            </div>
            <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <Input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />
            </div>
            <div className="flex justify-between">
            <Button type="button" onClick={onCancel} variant="outline">Cancel</Button>
            <Button type="submit">Confirm Booking</Button>
            </div>
        </form>
        </div>
    );
}