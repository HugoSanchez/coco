'use client'

import React, { useState } from 'react';
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ConnectCalendar } from "@/components/ConnectCalendar"
import { BillingPreferencesForm, BillingPreferences } from "@/components/BillingPreferencesForm"
import { saveBillingPreferences } from '@/lib/db/profiles';
import { useUser } from '@/contexts/UserContext';

interface BillingPreferencesStepProps {
    onComplete: () => void;
}

const defaultPrefs: BillingPreferences = {
  shouldBill: false,
  billingAmount: '',
  billingType: '',
  billingFrequency: '',
  billingTrigger: '',
  billingAdvanceDays: ''
};

export function BillingPreferencesStep({ onComplete }: BillingPreferencesStepProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [billingPrefs, setBillingPrefs] = useState<BillingPreferences>(defaultPrefs);
    const { toast } = useToast();
    const { user } = useUser();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await saveBillingPreferences(user.id, billingPrefs);
            // toast({ title: 'Preferencias guardadas', description: 'Tus preferencias de facturación han sido guardadas.' });
            onComplete();
        } catch (error: any) {
			console.log(error);
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
			<div>
				<h2 className="text-2xl font-bold">3. Configura tus preferencias de facturación</h2>
				<p className='text-md text-gray-500 my-2'>Podrás cambiar tus preferencias siempre que quieras. Además, podrás tener opciones de facturación especificas para cada paciente si lo necesitas.</p>
			</div>
            <form onSubmit={handleSubmit} className='mb-8'>
				<div className='pt-2'>
					<BillingPreferencesForm
						values={billingPrefs}
						onChange={setBillingPrefs}
						disabled={isLoading}
					/>
				</div>
                <Button
                    type="submit"
                    disabled={isLoading}
                    className='mt-8 h-12 w-full shadow-sm bg-teal-400 hover:bg-teal-400 hover:opacity-90 text-md'
                >
                    {isLoading ? 'Guardando...' : 'Continuar'}
                </Button>
            </form>
        </div>
    );
}
