'use client'

import { SideSheet } from './SideSheet'
import { ClientFormFields } from './ClientFormFields'

/**
 * Props interface for the ClientForm component
 *
 * @interface ClientFormProps
 * @property isOpen - Controls whether the form modal is visible
 * @property onClose - Callback function called when the form is closed
 * @property onClientCreated - Callback function called when a client is successfully created
 */
interface ClientFormProps {
	isOpen: boolean
	onClose: () => void
	onClientCreated: () => void
}

/**
 * ClientForm Component
 *
 * A modal form component for creating new clients/patients. Wraps the ClientFormFields
 * component in a SideSheet modal for a better user experience.
 *
 * FEATURES:
 * - Modal presentation using SideSheet
 * - Client creation with billing preferences
 * - Success and cancel callbacks
 * - Responsive design
 *
 * USAGE:
 * This component is typically used in client management pages where users
 * need to add new patients to their system.
 *
 * @component
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false)
 *
 * <ClientForm
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onClientCreated={() => {
 *     setIsOpen(false)
 *     refreshClients()
 *   }}
 * />
 * ```
 */
export function ClientForm({
	isOpen,
	onClose,
	onClientCreated
}: ClientFormProps) {
	return (
		<SideSheet
			isOpen={isOpen}
			onClose={onClose}
			title={<>Añade un nuevo paciente</>}
			description={
				<>
					Crea un nuevo paciente y configura las preferencias de
					facturación.
				</>
			}
		>
			<ClientFormFields onSuccess={onClientCreated} onCancel={onClose} />
		</SideSheet>
	)
}
