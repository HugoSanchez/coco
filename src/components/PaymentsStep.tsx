'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/use-toast'
import { useUser } from '@/contexts/UserContext'
import { Check, AlertTriangle } from 'lucide-react'

interface PaymentsStepProps {
	onComplete: () => void
	title?: string
	subtitle?: string
	buttonText?: string
	loadingText?: string
	source?: 'onboarding' | 'settings'
}

export function PaymentsStep({
	onComplete,
	title = '5. Configura tus pagos',
	subtitle = 'Stripe es la plataforma de pagos más usada en el mundo. Conecta tu cuenta para poder recibir pagos de tus pacientes directamente a tu cuenta bancaria.',
	buttonText = 'Configurar cuenta de Stripe',
	loadingText = 'Creando enlace...',
	source = 'onboarding'
}: PaymentsStepProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [hasStripeAccount, setHasStripeAccount] = useState<boolean | null>(
		null
	)
	const [isCheckingStatus, setIsCheckingStatus] = useState(true)
	const { user } = useUser()
	const { toast } = useToast()

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
					setHasStripeAccount(data.onboarding_completed || false)
				}
			} catch (error) {
				console.error('Error checking Stripe status:', error)
				// If there's an error, default to not completed
			} finally {
				setIsCheckingStatus(false)
			}
		}

		checkOnboardingStatus()
	}, [user?.id])

	// Check if user returned from Stripe onboarding - refresh status
	useEffect(() => {
		if (user?.id) {
			// Small delay to allow webhook to process first
			const timer = setTimeout(async () => {
				try {
					const response = await fetch(
						'/api/payments/onboarding-status'
					)
					if (response.ok) {
						const data = await response.json()
						const wasIncomplete = hasStripeAccount !== true
						const isNowComplete = data.onboarding_completed

						setHasStripeAccount(isNowComplete)

						// Auto-proceed if account became ready
						if (wasIncomplete && isNowComplete) {
							setTimeout(() => {
								onComplete()
							}, 500)
						}
					}
				} catch (error) {
					console.error('Error rechecking Stripe status:', error)
				}
			}, 1000)

			return () => clearTimeout(timer)
		}
	}, [user?.id, onComplete, hasStripeAccount])

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

			// Now create the onboarding link with source context
			const onboardingResponse = await fetch(
				`/api/payments/onboarding-link?source=${source}`,
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

			{/* Notice for incomplete onboarding - only show after status check is complete */}
			{!isCheckingStatus && hasStripeAccount === false && (
				<div className="my-4 rounded-md bg-gray-200 px-5 py-3 flex items-center gap-5">
					<AlertTriangle className="w-5 h-5 text-gray-600 flex-shrink-0" />
					<div>
						<p className="text-sm text-gray-600">
							Tu configuración de pagos está incompleta. Algunos
							detalles están pendientes en Stripe.{' '}
							<strong>
								Completa la configuración para poder recibir
								pagos de tus pacientes.
							</strong>
						</p>
					</div>
				</div>
			)}

			<div className="pt-6">
				{hasStripeAccount !== true ? (
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

						{source === 'settings' ? (
							<Button
								onClick={handleConnectStripe}
								disabled={isLoading}
								className="w-full h-12 text-md bg-gray-200"
								variant="outline"
							>
								{isLoading ? (
									<>
										<Spinner size="sm" className="mr-2" />
										Actualizando...
									</>
								) : (
									'Actualizar configuración'
								)}
							</Button>
						) : (
							<Button
								onClick={handleContinue}
								className="w-full h-12 text-md"
							>
								Continuar
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
