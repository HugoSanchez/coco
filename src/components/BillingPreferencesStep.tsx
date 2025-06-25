'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { ConnectCalendar } from '@/components/ConnectCalendar'
import {
	BillingPreferencesForm,
	BillingPreferences
} from '@/components/BillingPreferencesForm'
import { saveBillingPreferences, getBillingPreferences } from '@/lib/db/billing'
import { useUser } from '@/contexts/UserContext'

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
	shouldBill: false,
	billingAmount: '',
	billingType: '',
	billingFrequency: '',
	billingTrigger: '',
	billingAdvanceDays: ''
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
			if (!user?.id) return

			try {
				setIsLoadingPrefs(true)
				const existingPrefs = await getBillingPreferences(user.id)

				if (existingPrefs) {
					setBillingPrefs(existingPrefs)
				}
			} catch (error) {
				console.error('Error loading billing preferences:', error)
				// Keep default preferences if loading fails
			} finally {
				setIsLoadingPrefs(false)
			}
		}

		fetchBillingPreferences()
	}, [user?.id])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsLoading(true)
		try {
			await saveBillingPreferences(user.id, billingPrefs)

			if (showSuccessToast) {
				toast({
					title: 'Preferencias actualizadas',
					description:
						'Tus preferencias de facturación se han guardado correctamente.',
					color: 'success'
				})
			}

			if (!skipOnComplete) {
				onComplete()
			}
		} catch (error: any) {
			console.log(error)
			if (showSuccessToast) {
				toast({
					title: 'Error',
					description:
						'Hubo un problema al guardar las preferencias. Inténtalo de nuevo.',
					color: 'error'
				})
			} else {
				toast({
					title: 'Error',
					description: error.message,
					variant: 'destructive'
				})
			}
		} finally {
			setIsLoading(false)
		}
	}

	if (isLoadingPrefs) {
		return (
			<div className="flex items-center justify-center py-8">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
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
						disabled={isLoading}
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
