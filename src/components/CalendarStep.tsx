'use client'

import React, { useState } from 'react';
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ConnectCalendar } from "@/components/ConnectCalendar"

interface CalendarStepProps {
    onComplete: () => void;
}

export function CalendarStep({ onComplete }: CalendarStepProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		// This simply moves to the next step
        e.preventDefault();
        setIsLoading(true);
		onComplete();
		setIsLoading(false);
    };

    return (
        <div>
            <div className='mb-8'>
                <p className="block text-md font-medium text-gray-700">Connect your Calendar</p>
                <p className='text-sm text-gray-500 mb-2'>Coco will always be in sync with your google calendar.</p>
				<div className='pt-2'>
					<ConnectCalendar />
				</div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
				<Button
					type="submit"
					disabled={isLoading}
					className='h-12 w-full shadow-sm bg-teal-400 hover:bg-teal-400 hover:opacity-90'
				>
					{isLoading ? 'Saving...' : 'Continue'}
				</Button>
            </form>
        </div>
    );
}
