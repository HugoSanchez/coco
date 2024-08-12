'use client'

import React, { useState } from 'react';
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

interface PaymentSetupProps {
    onComplete: () => void;
}

export function PaymentSetup({ onComplete }: PaymentSetupProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate an API call
        setTimeout(() => {
            setIsLoading(false);
            toast({
                title: "Success",
                description: "Payment setup completed successfully!",
                color: "success",
            });
            onComplete();
        }, 1500); // Simulate a delay of 1.5 seconds
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Payment Setup</h2>
            <p className="mb-6 text-gray-600">
                Set up your payment details to start receiving payments for your bookings.
            </p>
            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Placeholder for future payment form fields */}
                <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full h-12 shadow-sm bg-teal-400 hover:bg-teal-400 hover:opacity-90"
                >
                    {isLoading ? 'Processing...' : 'Complete Payment Setup'}
                </Button>
            </form>
        </div>
    );
}