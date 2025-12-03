'use client'

import { useState } from 'react'
import { SideSheetHeadless } from './SideSheetHeadless'
import { ClientFormFields } from './ClientFormFields'
import type { Client } from '@/lib/db/clients'
import type { ClientFormDraft } from '@/hooks/useClientFormPersistence'

/**
 * Props interface for the ClientForm component
 *
 * @interface ClientFormProps
 * @property isOpen - Controls whether the form modal is visible
 * @property onClose - Callback function called when the form is closed
 * @property onClientCreated - Callback function called when a client is successfully created or updated
 * @property editMode - Optional boolean indicating if we're editing an existing client
 * @property initialData - Optional client data for editing mode
 */
interface ClientFormProps {
	isOpen: boolean
	onClose: () => void
	onClientCreated: (client?: Client) => void
	editMode?: boolean
	initialData?: Client
	persistKey?: string
	saveDraft?: (draft: ClientFormDraft) => void
	loadDraft?: () => ClientFormDraft | null
	clearPersistedDraft?: () => void
}

/**
 * ClientForm Component
 *
 * A modal form component for creating new clients/patients or editing existing ones.
 * Wraps the ClientFormFields component in a SideSheet modal for a better user experience.
 *
 * FEATURES:
 * - Modal presentation using SideSheet
 * - Client creation and editing with billing preferences
 * - Success and cancel callbacks
 * - Responsive design
 * - Context-aware titles and descriptions
 *
 * USAGE:
 * This component is typically used in client management pages where users
 * need to add new patients or edit existing ones in their system.
 *
 * @component
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false)
 * const [editingClient, setEditingClient] = useState<Client | null>(null)
 *
 * <ClientForm
 *   isOpen={isOpen}
 *   onClose={() => { setIsOpen(false); setEditingClient(null) }}
 *   onClientCreated={() => {
 *     setIsOpen(false)
 *     setEditingClient(null)
 *     refreshClients()
 *   }}
 *   editMode={!!editingClient}
 *   initialData={editingClient || undefined}
 * />
 * ```
 */
export function ClientForm({
	isOpen,
	onClose,
	onClientCreated,
	editMode = false,
	initialData,
	persistKey,
	saveDraft,
	loadDraft,
	clearPersistedDraft
}: ClientFormProps) {
	const [scrollableRef, setScrollableRef] = useState<HTMLDivElement | null>(null)
	const fallbackKey = editMode && initialData?.id ? `client-form-${initialData.id}` : 'client-form'
	return (
		<SideSheetHeadless
			isOpen={isOpen}
			onClose={onClose}
			title={
				editMode ? <>Editar paciente</> : <>Añade un nuevo paciente</>
			}
			description={
				editMode ? (
					<>
						Actualiza la información del paciente y sus preferencias
						de facturación.
					</>
				) : (
					<>
						Crea un nuevo paciente y configura las preferencias de
						facturación.
					</>
				)
			}
			onScrollableRef={setScrollableRef}
		>
			<ClientFormFields
				key={persistKey ?? fallbackKey}
				onSuccess={onClientCreated}
				onCancel={onClose}
				editMode={editMode}
				initialData={initialData}
				persistKey={persistKey}
				saveDraft={saveDraft}
				loadDraft={loadDraft}
				clearPersistedDraft={clearPersistedDraft}
				scrollableRef={scrollableRef}
			/>
		</SideSheetHeadless>
	)
}
