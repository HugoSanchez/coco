'use client'

import React, { useState } from 'react';
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ConnectCalendar } from "@/components/ConnectCalendar"
import { ClientFormFields } from "@/components/ClientFormFields"

interface CustomerStepProps {
    onComplete: () => void;
}

export function CustomerStep({ onComplete }: CustomerStepProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleClientCreated = () => {
        // Client was successfully created, proceed to dashboard
        onComplete();
    };

    return (
        <div>
			<div>
				<h2 className="text-2xl font-bold">4. Añade tu primer cliente</h2>
				<p className='text-md text-gray-500 my-2'>Si no lo tienes claro, puedes empezar por añadirte a ti mismo para así poder testear nuestras funcionalidades.</p>
			</div>
            <div className='mb-8'>
				<div className='pt-2'>
					<ClientFormFields
						onSuccess={handleClientCreated}
					/>
				</div>
            </div>
        </div>
    );
}
