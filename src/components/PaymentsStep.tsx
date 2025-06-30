'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/use-toast'
import { useUser } from '@/contexts/UserContext'
import { useSearchParams } from 'next/navigation'

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
	subtitle = 'Conecta tu cuenta de Stripe para poder recibir pagos de tus pacientes de forma segura.',
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
				const response = await fetch(
					'/api/payments/stripe/onboarding-status'
				)
				if (response.ok) {
					const data = await response.json()
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
		const stripeOnboarding = searchParams.get('stripe_onboarding')

		// Prevent processing the same return multiple times
		if (hasProcessedReturn || !stripeOnboarding) {
			return
		}

		if (stripeOnboarding === 'success') {
			setHasProcessedReturn(true)

			// Update the database to mark onboarding as completed
			const updateOnboardingStatus = async () => {
				try {
					await fetch('/api/payments/stripe/update-onboarding', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						}
					})
				} catch (error) {
					console.error('Error updating onboarding status:', error)
					// Don't block the flow if this fails
				}
			}

			updateOnboardingStatus()

			// Clean up the URL
			const url = new URL(window.location.href)
			url.searchParams.delete('stripe_onboarding')
			window.history.replaceState({}, '', url.toString())

			// Use setTimeout to avoid the infinite loop
			setTimeout(() => {
				onComplete()
			}, 0)
		} else if (stripeOnboarding === 'refresh') {
			setHasProcessedReturn(true)

			toast({
				title: 'Configuración interrumpida',
				description:
					'Puedes continuar configurando tu cuenta cuando quieras.',
				variant: 'destructive'
			})

			// Clean up the URL
			const url = new URL(window.location.href)
			url.searchParams.delete('stripe_onboarding')
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
			const createResponse = await fetch(
				'/api/payments/stripe/create-account',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					}
				}
			)

			const createData = await createResponse.json()

			if (!createResponse.ok) {
				// If account already exists, that's fine, continue to onboarding
				if (!createData.error?.includes('already exists')) {
					throw new Error(
						createData.error || 'Error al crear cuenta de Stripe'
					)
				}
			}

			// Now create the onboarding link
			const onboardingResponse = await fetch(
				'/api/payments/stripe/onboarding-link',
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
						<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
							<h3 className="font-medium text-blue-900 mb-2">
								¿Por qué conectar Stripe?
							</h3>
							<ul className="text-sm text-blue-800 space-y-1">
								<li>• Recibe pagos seguros de tus pacientes</li>
								<li>• Procesa tarjetas de crédito y débito</li>
								<li>• Gestión automática de facturas</li>
								<li>
									• Transferencias directas a tu cuenta
									bancaria
								</li>
							</ul>
						</div>

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

						<Button
							onClick={handleSkip}
							variant="ghost"
							className="w-full"
							disabled={isLoading || isCheckingStatus}
						>
							Saltar por ahora
						</Button>
					</div>
				) : (
					<div className="space-y-4">
						<div className="bg-green-50 border border-green-200 rounded-lg p-4">
							<h3 className="font-medium text-green-900 mb-2">
								✓ Cuenta de Stripe configurada
							</h3>
							<p className="text-sm text-green-800">
								Ya puedes recibir pagos de tus pacientes de
								forma segura.
							</p>
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
