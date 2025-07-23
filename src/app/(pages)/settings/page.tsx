'use client'

import { useState, useEffect, Suspense } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSearchParams, useRouter } from 'next/navigation'
import { User, Calendar, CreditCard, Settings } from 'lucide-react'
import { ProfileSetup } from '@/components/ProfileSetup'
import { CalendarStep } from '@/components/CalendarStep'
import { BillingPreferencesStep } from '@/components/BillingPreferencesStep'
import { Spinner } from '@/components/ui/spinner'

type SettingsSection = 'profile' | 'calendar' | 'billing'

const settingsMenuItems = [
	{
		id: 'profile' as SettingsSection,
		label: 'Perfil',
		icon: User,
		description: 'Edita tus datos personales'
	},
	{
		id: 'calendar' as SettingsSection,
		label: 'Calendario',
		icon: Calendar,
		description: 'Configure your calendar settings'
	},
	{
		id: 'billing' as SettingsSection,
		label: 'Opciones de Facturación',
		icon: CreditCard,
		description: 'Set up your default billing preferences'
	}
]

function SettingsContent() {
	const { user, loading } = useUser()
	const searchParams = useSearchParams()
	const router = useRouter()
	const [activeSection, setActiveSection] = useState<SettingsSection | null>(
		null
	) // Start with null to show loading
	const [isInitialized, setIsInitialized] = useState(false)

	// Set active section from URL parameter and handle calendar connection feedback
	useEffect(() => {
		// Check for tab parameter in URL and set active section
		const tabParam = searchParams.get('tab')
		if (tabParam && ['profile', 'calendar', 'billing'].includes(tabParam)) {
			setActiveSection(tabParam as SettingsSection)
			setIsInitialized(true)
		} else if (!tabParam) {
			// If no tab parameter, default to profile and update URL
			setActiveSection('profile')
			setIsInitialized(true)
			router.replace('/settings?tab=profile', { scroll: false })
		}

		// Handle calendar connection feedback from OAuth redirect
		const calendarConnected = searchParams.get('calendar_connected')
		if (calendarConnected === 'true') {
			console.log('Calendar successfully connected from settings')
			// Optional: Show success toast here
			// Clean up URL by removing the calendar_connected parameter
			setTimeout(() => {
				const currentTab = searchParams.get('tab') || 'calendar'
				router.replace(`/settings?tab=${currentTab}`, { scroll: false })
			}, 100)
		} else if (calendarConnected === 'false') {
			console.log('Calendar connection failed from settings')
			// Optional: Show error toast here
			// Clean up URL by removing the calendar_connected parameter
			setTimeout(() => {
				const currentTab = searchParams.get('tab') || 'calendar'
				router.replace(`/settings?tab=${currentTab}`, { scroll: false })
			}, 100)
		}
	}, [searchParams, router])

	/**
	 * Handles tab navigation - updates both state and URL
	 * This ensures the URL always reflects the current tab
	 */
	const handleTabChange = (newSection: SettingsSection) => {
		setActiveSection(newSection)
		// Update URL to reflect current tab
		router.push(`/settings?tab=${newSection}`, { scroll: false })
	}

	const renderSectionContent = () => {
		if (!activeSection) return null // Don't render content while loading

		switch (activeSection) {
			case 'profile':
				return (
					<div>
						<ProfileSetup
							title="Edita tu perfil"
							subtitle="Recuerda que esta información será visible para tus pacientes."
							buttonText="Guardar"
							loadingText="Guardando..."
							showSuccessToast={true}
							skipOnComplete={true}
							onComplete={() => {
								// This won't be called due to skipOnComplete=true
								console.log('Profile updated successfully')
							}}
						/>
					</div>
				)

			case 'calendar':
				return (
					<div className="">
						<CalendarStep
							title="Configuración de calendario"
							subtitle="Mantén a coco sincronizado con Google Calendar para gestionar tus citas automáticamente."
							buttonText="Guardar"
							loadingText="Guardando..."
							showContinueButton={false}
							source="settings"
							onComplete={() => {
								console.log('Calendar settings updated')
							}}
						/>
					</div>
				)

			case 'billing':
				return (
					<div className="">
						<BillingPreferencesStep
							title="Opciones de facturación"
							subtitle="Configura tus preferencias de facturación por defecto para tus consultas."
							buttonText="Guardar configuración"
							loadingText="Guardando..."
							showSuccessToast={true}
							skipOnComplete={true}
							onComplete={() => {
								// This won't be called due to skipOnComplete=true
								console.log('Billing preferences updated')
							}}
						/>
					</div>
				)

			default:
				return null
		}
	}

	// Show loading state until we know which tab to display
	if (!isInitialized) {
		return (
			<div className="min-h-screen bg-gray-50 pt-16">
				<div className="flex items-center justify-center h-64">
					<Spinner size="sm" color="dark" />
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-gray-50 pt-16">
			<div className="flex">
				{/* Left Sidebar Menu */}
				<div className="w-96 min-h-screen bg-gray-50 border-r border-gray-200">
					<div className="pt-8 px-16">
						<div className="mb-8">
							<h1 className="text-xl font-medium text-gray-900 mb-1">
								Settings
							</h1>
						</div>

						<nav className="space-y-1">
							{settingsMenuItems.map((item) => {
								const isActive = activeSection === item.id

								return (
									<button
										key={item.id}
										className={`w-full text-left px-3 py-2 text-base font-light rounded-md transition-colors ${
											isActive
												? 'bg-gray-200 font-medium text-gray-900'
												: 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
										}`}
										onClick={() => handleTabChange(item.id)}
									>
										{item.label}
									</button>
								)
							})}
						</nav>
					</div>
				</div>

				{/* Main Content Area */}
				<div className="flex-1">
					<div className="px-8 md:px-24">
						{renderSectionContent()}
					</div>
				</div>
			</div>
		</div>
	)
}

export default function SettingsPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-gray-50 pt-16">
					<div className="flex items-center justify-center h-64">
						<Spinner size="sm" color="dark" />
					</div>
				</div>
			}
		>
			<SettingsContent />
		</Suspense>
	)
}
