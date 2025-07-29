'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Spinner } from '@/components/ui/spinner'
import { useUser } from '@/contexts/UserContext'
import {
	getBillingPreferences,
	saveBillingPreferences
} from '@/lib/db/billing-settings'
import {
	BillingPreferencesForm,
	BillingPreferences
} from '@/components/BillingPreferencesForm'

interface BillingPreferencesStepProps {
	onComplete: () => void
	title?: string
	subtitle?: string
	buttonText?: string
	loadingText?: string
	showSuccessToast?: boolean
	skipOnComplete?: boolean
}

const defaultPrefs: BillingPreferences = {
	billingType: 'in-advance',
	billingAmount: '80'
}

export function BillingPreferencesStep({
	onComplete,
	title = '3. Configura tus preferencias de facturación',
	subtitle = 'Podrás cambiar tus preferencias siempre que quieras. Además, podrás tener opciones de facturación especificas para cada paciente si lo necesitas.',
	buttonText = 'Continuar',
	loadingText = 'Guardando...',
	showSuccessToast = false,
	skipOnComplete = false
}: BillingPreferencesStepProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [isLoadingPrefs, setIsLoadingPrefs] = useState(true)
	const [billingPrefs, setBillingPrefs] =
		useState<BillingPreferences>(defaultPrefs)
	const { toast } = useToast()
	const { user } = useUser()

	// Fetch existing billing preferences when component mounts
	useEffect(() => {
		const fetchBillingPreferences = async () => {
			// If user is not logged in, return;
			if (!user?.id) return
			// Set loading state to true
			setIsLoadingPrefs(true)
			// Fetch existing billing preferences from DB
			const existingPrefs = await getBillingPreferences(user.id)
			// Set billing preferences if they exist
			if (existingPrefs) setBillingPrefs(existingPrefs)
			// Set loading state to false
			setIsLoadingPrefs(false)
		}

		fetchBillingPreferences()
	}, [user?.id])

	const handleSubmit = async (e: React.FormEvent) => {
		// Prevent default form submission
		e.preventDefault()
		// Set loading state to true
		setIsLoading(true)
		// Try to save billing preferences
		try {
			// Save billing preferences using the new unified system
			await saveBillingPreferences(user?.id, billingPrefs)

			// Show success toast if enabled
			if (showSuccessToast) {
				toast({
					title: 'Configuración guardada',
					description:
						'Preferencias de facturación actualizadas correctamente.',
					color: 'success'
				})
			}

			// If skipOnComplete is false, call onComplete
			if (!skipOnComplete) onComplete()
		} catch (error: any) {
			// If error, log error
			console.log(error)
			// Show error toast
			toast({
				title: 'Error',
				description: 'Hubo un problema al guardar las preferencias.',
				color: 'error'
			})
		} finally {
			// Always reset loading state regardless of success/failure
			setIsLoading(false)
		}
	}

	if (isLoadingPrefs) {
		return (
			<div className="flex items-center justify-center py-8">
				<Spinner size="sm" />
			</div>
		)
	}

	return (
		<div>
			<div>
				<h2 className="text-2xl font-bold">{title}</h2>
				<p className="text-md text-gray-500 my-2">{subtitle}</p>
			</div>

			<form onSubmit={handleSubmit} className="mb-8">
				<div className="pt-2">
					<BillingPreferencesForm
						values={billingPrefs}
						onChange={setBillingPrefs}
					/>
				</div>
				<Button
					type="submit"
					variant="default"
					disabled={isLoading}
					className="mt-8 h-12 w-full shadow-sm text-md"
				>
					{isLoading ? loadingText : buttonText}
				</Button>
			</form>
		</div>
	)
}
