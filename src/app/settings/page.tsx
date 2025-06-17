'use client'

import { useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Calendar, CreditCard, Settings } from 'lucide-react'
import { ProfileSetup } from '@/components/ProfileSetup'

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
  const { user } = useUser()
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')

  if (!user) {
    redirect('/login')
  }

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
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Calendario</h2>
              <p className="text-gray-600">Configura tus preferencias de calendario</p>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600">Calendar settings content will go here...</p>
              {/* Calendar form components will be added here */}
            </div>
          </div>
        )

      case 'billing':
        return (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Opciones de Facturación</h2>
              <p className="text-gray-600">Configura tus preferencias de facturación por defecto</p>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600">Billing preferences form will go here...</p>
              {/* BillingPreferencesForm component will be added here */}
            </div>
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
              <h1 className="text-xl font-medium text-gray-900 mb-1">Settings</h1>
            </div>

            <nav className="space-y-1">
              {settingsMenuItems.map((item) => {
                const isActive = activeSection === item.id

                return (
                  <button
                    key={item.id}
                    className={`w-full text-left px-3 py-2 text-base font-light rounded-md transition-colors ${
                      isActive
                        ? "bg-gray-200 font-medium text-gray-900"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                    onClick={() => setActiveSection(item.id)}
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
