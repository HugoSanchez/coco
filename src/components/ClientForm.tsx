"use client"

import { SideSheet } from './SideSheet'
import { ClientFormFields } from './ClientFormFields'

interface ClientFormProps {
  isOpen: boolean
  onClose: () => void
  onClientCreated: () => void
}

export function ClientForm({ isOpen, onClose, onClientCreated }: ClientFormProps) {
  return (
    <SideSheet
      isOpen={isOpen}
      onClose={onClose}
      title={<>Añade un nuevo paciente</>}
      description={<>Crea un nuevo paciente y configura las preferencias de facturación.</>}
    >
      <ClientFormFields onSuccess={onClientCreated} onCancel={onClose} />
    </SideSheet>
  )
}
