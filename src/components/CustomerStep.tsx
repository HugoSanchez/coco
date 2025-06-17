'use client'

import React, { useState } from 'react';
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ConnectCalendar } from "@/components/ConnectCalendar"

interface CustomerStepProps {
    onComplete: () => void;
}

export function CustomerStep({ onComplete }: CustomerStepProps) {
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
				<h2 className="text-2xl font-bold">4. Añade tu primer cliente</h2>
				<p className='text-md text-gray-500 mb-2'>Si tienes dudas, puedes empezar por añadirte a ti mismo/a para así poder testear nuestras funcionalidades!</p>
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
					{isLoading ? 'Guardando...' : 'Continuar'}
				</Button>
            </form>
        </div>
    );
}
