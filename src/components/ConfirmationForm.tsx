import { useState } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { TimeSlot } from '@/lib/calendar'
import { Apple, AppleIcon } from 'lucide-react'
import { FaApple } from 'react-icons/fa';
import { Spinner } from './ui/spinner';


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
    const [loading, setLoading] = useState(false);

    const startTime = toZonedTime(new Date(selectedSlot.start), userTimeZone);
    const endTime = toZonedTime(new Date(selectedSlot.end), userTimeZone);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // onConfirm({ name, email });
    };

    return (
        <div className="p-4">
        <h2 className="text-xl font-bold mb-4">100,00€</h2>
        <p className="mb-4">
            You&apos;re booking an appointment with Clara
            <br />
            <strong>{format(startTime, 'MMMM d, yyyy')}</strong>
            <br />
            <strong>{format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}</strong>
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-8">
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
            <p className="mb-4">
                <em className='text-sm font-light'>Conference details will be sent via email immediately after booking.</em>
            </p>
            <div className="flex justify-between">
            <Button onClick={handleSubmit} className="w-full mt-8 h-12 text-white hover:bg-gray-800 flex items-center justify-center">
                {
                    loading ? 
                    <Spinner radius='small' />
                    :
                    <>
                    <FaApple className="mr-2 h-5 w-5" />
                    <p className='text-lg'>Pay</p>
                    </>
                }
            </Button>
            </div>
        </form>
        </div>
    );
}