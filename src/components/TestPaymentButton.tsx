'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

export function TestPaymentButton({ bookingId }: { bookingId?: string }) {
	const [loading, setLoading] = useState(false)
	const { toast } = useToast()

	const handleTestPayment = async () => {
		if (!bookingId) {
			toast({
				title: 'Error',
				description: 'No booking ID provided',
				variant: 'destructive'
			})
			return
		}

		setLoading(true)
		try {
			const response = await fetch('/api/billing/generate-payment-link', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ bookingId })
			})

			const data = await response.json()

			if (data.success && data.checkoutUrl) {
				// Redirect to Stripe checkout
				window.location.href = data.checkoutUrl
			} else {
				toast({
					title: 'Error',
					description: data.error || 'Failed to create payment link',
					variant: 'destructive'
				})
			}
		} catch (error) {
			console.error('Error testing payment:', error)
			toast({
				title: 'Error',
				description: 'Failed to generate payment link',
				variant: 'destructive'
			})
		} finally {
			setLoading(false)
		}
	}

	return (
		<Button
			onClick={handleTestPayment}
			disabled={loading || !bookingId}
			variant="outline"
			size="sm"
		>
			{loading ? 'Generando...' : '💳 Probar Pago'}
		</Button>
	)
}
