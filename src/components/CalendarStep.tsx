'use client'

import React, { useState } from 'react';
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ConnectCalendar } from "@/components/ConnectCalendar"

interface CalendarStepProps {
    onComplete: () => void;
    title?: string;
    subtitle?: string;
    buttonText?: string;
    loadingText?: string;
}

export function CalendarStep({
    onComplete,
    title = "2. Connecta tu calendario",
    subtitle = "Coco estará siempre sincronizado con tu calendario de Google de manera que te resulte fácil y automático agendar nuevas consultas.",
    buttonText = "Continuar",
    loadingText = "Guardando..."
}: CalendarStepProps) {
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
			<div>
				<h2 className="text-2xl font-bold">{title}</h2>
				<p className='text-md text-gray-500 my-2'>{subtitle}</p>
			</div>
            <div className='mb-8'>
				<div className='pt-2'>
					<ConnectCalendar />
				</div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
				<Button
					type="submit"
					disabled={isLoading}
					className='h-12 w-full shadow-sm bg-teal-400 hover:bg-teal-400 hover:opacity-90 text-md'
				>
					{isLoading ? loadingText : buttonText}
				</Button>
            </form>
        </div>
    );
}
