'use client'

import { useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { User, Calendar, CreditCard, Settings } from 'lucide-react'
import { ProfileSetup } from '@/components/ProfileSetup'
import { CalendarStep } from '@/components/CalendarStep'
import { BillingPreferencesStep } from '@/components/BillingPreferencesStep'

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

export default function SettingsPage() {
	const { user, loading } = useUser()
	const [activeSection, setActiveSection] =
		useState<SettingsSection>('profile')

	const renderSectionContent = () => {
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
										onClick={() =>
											setActiveSection(item.id)
										}
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
