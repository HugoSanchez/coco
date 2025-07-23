'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/use-toast'
import { useUser } from '@/contexts/UserContext'
import { useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'

interface PaymentsStepProps {
	onComplete: () => void
	title?: string
	subtitle?: string
	buttonText?: string
	loadingText?: string
}

export function PaymentsStep({
	onComplete,
	title = '5. Configura tus pagos',
	subtitle = 'Stripe es la plataforma de pagos más usada en el mundo. Conecta tu cuenta para poder recibir pagos de tus pacientes directamente a tu cuenta bancaria.',
	buttonText = 'Configurar cuenta de Stripe',
	loadingText = 'Creando enlace...'
}: PaymentsStepProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [hasStripeAccount, setHasStripeAccount] = useState(false)
	const [isCheckingStatus, setIsCheckingStatus] = useState(true)
	const [hasProcessedReturn, setHasProcessedReturn] = useState(false)
	const { toast } = useToast()
	const { user } = useUser()
	const searchParams = useSearchParams()

	// Check onboarding status when component loads
	useEffect(() => {
		const checkOnboardingStatus = async () => {
			if (!user?.id) {
				setIsCheckingStatus(false)
				return
			}

			try {
				const response = await fetch('/api/payments/onboarding-status')
				if (response.ok) {
					const data = await response.json()
					console.log('data', data)
					setHasStripeAccount(data.onboarding_completed || false)
				}
			} catch (error) {
				console.error('Error checking onboarding status:', error)
				// If there's an error, default to not completed
			} finally {
				setIsCheckingStatus(false)
			}
		}

		checkOnboardingStatus()
	}, [user?.id])

	// Check if user returned from Stripe onboarding
	useEffect(() => {
		const stripeReady = searchParams.get('stripe_ready')
		const stripeIncomplete = searchParams.get('stripe_incomplete')
		const stripeError = searchParams.get('stripe_error')
		const reason = searchParams.get('reason')

		// Prevent processing the same return multiple times
		if (
			hasProcessedReturn ||
			(!stripeReady && !stripeIncomplete && !stripeError)
		) {
			return
		}

		setHasProcessedReturn(true)

		if (stripeReady === 'true') {
			// Account is ready for payments - proceed to next step
			setHasStripeAccount(true)

			toast({
				title: 'Cuenta configurada correctamente',
				description:
					'Tu cuenta de Stripe está lista para recibir pagos.'
			})

			// Clean up URL and proceed
			const url = new URL(window.location.href)
			url.searchParams.delete('stripe_ready')
			window.history.replaceState({}, '', url.toString())

			setTimeout(() => {
				onComplete()
			}, 0)
		} else if (stripeIncomplete === 'true') {
			// Account needs more setup - show appropriate message
			let message =
				'Necesitas completar la configuración de tu cuenta de Stripe.'

			if (reason === 'form_incomplete') {
				message = 'Completa tu información en Stripe para continuar.'
			} else if (reason === 'verification_needed') {
				message = 'Verificación en proceso. Puede tomar hasta 7 días.'
			} else if (reason === 'payouts_disabled') {
				message = 'Verificación bancaria pendiente.'
			}

			toast({
				title: 'Configuración pendiente',
				description: message,
				variant: 'destructive'
			})

			// Clean up URL
			const url = new URL(window.location.href)
			url.searchParams.delete('stripe_incomplete')
			url.searchParams.delete('reason')
			window.history.replaceState({}, '', url.toString())
		} else if (stripeError) {
			// Error occurred - show error message
			toast({
				title: 'Error en la configuración',
				description:
					'Hubo un problema verificando tu cuenta. Intenta de nuevo.',
				variant: 'destructive'
			})

			// Clean up URL
			const url = new URL(window.location.href)
			url.searchParams.delete('stripe_error')
			window.history.replaceState({}, '', url.toString())
		}
	}, [searchParams, toast, onComplete, hasProcessedReturn])

	const handleConnectStripe = async () => {
		if (!user?.id) {
			toast({
				title: 'Error',
				description: 'Debes estar autenticado para conectar tu cuenta.',
				variant: 'destructive'
			})
			return
		}

		setIsLoading(true)
		try {
			// First, create the account
			const createResponse = await fetch('/api/payments/create-account', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			})

			const createData = await createResponse.json()

			if (!createResponse.ok) {
				throw new Error(
					createData.error || 'Error al crear cuenta de Stripe'
				)
			}

			// Account created successfully or already exists - both are fine
			console.log('Create account result:', createData)

			// Now create the onboarding link
			const onboardingResponse = await fetch(
				'/api/payments/onboarding-link',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					}
				}
			)

			const onboardingData = await onboardingResponse.json()

			if (!onboardingResponse.ok) {
				throw new Error(
					onboardingData.error ||
						'Error al crear enlace de configuración'
				)
			}

			// Show success message and redirect to Stripe's onboarding
			toast({
				title: 'Redirigiendo a Stripe',
				description:
					'Te enviaremos a completar la configuración de tu cuenta.',
				color: 'success'
			})

			// Small delay to show the toast, then redirect
			setTimeout(() => {
				window.location.href = onboardingData.url
			}, 1000)
		} catch (error: any) {
			console.error('Error connecting Stripe:', error)
			toast({
				title: 'Error',
				description:
					error.message ||
					'Error al conectar con Stripe. Inténtalo de nuevo.',
				variant: 'destructive'
			})
		} finally {
			setIsLoading(false)
		}
	}

	const handleContinue = () => {
		onComplete()
	}

	const handleSkip = () => {
		onComplete()
	}

	return (
		<div>
			<div>
				<h2 className="text-2xl font-bold">{title}</h2>
				<p className="text-md text-gray-500 my-2">{subtitle}</p>
			</div>

			<div className="pt-6">
				{!hasStripeAccount ? (
					<div className="space-y-4">
						<Button
							onClick={handleConnectStripe}
							disabled={isLoading || isCheckingStatus}
							className="w-full h-12 text-md"
						>
							{isCheckingStatus ? (
								<>
									<Spinner size="sm" className="mr-2" />
									Verificando estado...
								</>
							) : isLoading ? (
								<>
									<Spinner size="sm" className="mr-2" />
									{loadingText}
								</>
							) : (
								buttonText
							)}
						</Button>
					</div>
				) : (
					<div className="space-y-4">
						<div className="py-4 flex">
							<Check className="w-6 h-6 mr-2" />
							<h3 className="font-medium mb-2">
								Cuenta de Stripe configurada
							</h3>
						</div>

						<Button
							onClick={handleContinue}
							className="w-full h-12 text-md"
						>
							Continuar
						</Button>
					</div>
				)}
			</div>
		</div>
	)
}
