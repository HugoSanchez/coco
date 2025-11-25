/**
 * useClientManagement Hook
 *
 * This hook manages client/patient data fetching and form state.
 * It handles:
 * - Fetching clients for the current user
 * - Managing the client form modal (open/close)
 * - Tracking which client is being edited
 * - Refreshing the client list after create/edit operations
 *
 * The hook can be used across different pages (Dashboard, Calendar, etc.) to
 * manage clients in a consistent way.
 *
 * @example
 * ```tsx
 * const { clients, loading, isFormOpen, editingClient, openCreateForm, openEditForm, closeForm, refreshClients } = useClientManagement({
 *   onClientCreated: () => {
 *     // Handle client creation (e.g., refresh bookings)
 *   }
 * })
 *
 * // Open form to create new client
 * openCreateForm()
 *
 * // Open form to edit existing client
 * openEditForm(client)
 *
 * // Render form
 * {isFormOpen && (
 *   <ClientForm
 *     isOpen={isFormOpen}
 *     onClose={closeForm}
 *     onClientCreated={refreshClients}
 *     editMode={!!editingClient}
 *     initialData={editingClient || undefined}
 *   />
 * )}
 * ```
 */

import { useState, useCallback, useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { getClientsForUser, type Client } from '@/lib/db/clients'

/**
 * Configuration options for the useClientManagement hook
 */
interface UseClientManagementOptions {
	/**
	 * Optional callback invoked when a client is successfully created
	 * @param client - The newly created client
	 */
	onClientCreated?: (client: Client) => void

	/**
	 * Optional callback invoked when a client is successfully updated
	 * @param client - The updated client
	 */
	onClientUpdated?: (client: Client) => void

	/**
	 * Optional callback invoked when clients are refreshed
	 * @param clients - The refreshed list of clients
	 */
	onClientsRefreshed?: (clients: Client[]) => void

	/**
	 * Optional callback invoked when an error occurs while fetching clients
	 * @param error - The error that occurred
	 */
	onError?: (error: Error) => void

	/**
	 * Whether to automatically fetch clients on mount
	 * Defaults to true
	 */
	autoFetch?: boolean
}

/**
 * Return type for useClientManagement hook
 */
interface UseClientManagementReturn {
	/**
	 * Array of clients for the current user
	 */
	clients: Client[]

	/**
	 * Whether clients are currently being fetched
	 */
	loading: boolean

	/**
	 * Whether the client form modal is open
	 */
	isFormOpen: boolean

	/**
	 * The client currently being edited, or null if creating a new client
	 */
	editingClient: Client | null

	/**
	 * Opens the form modal in create mode (no client selected)
	 *
	 * Steps:
	 * 1. Clear any editing client state
	 * 2. Open the form modal
	 */
	openCreateForm: () => void

	/**
	 * Opens the form modal in edit mode with the given client
	 *
	 * Steps:
	 * 1. Set the editing client
	 * 2. Open the form modal
	 *
	 * @param client - The client to edit
	 */
	openEditForm: (client: Client) => void

	/**
	 * Closes the form modal and clears editing state
	 *
	 * Steps:
	 * 1. Close the form modal
	 * 2. Clear the editing client state
	 */
	closeForm: () => void

	/**
	 * Refreshes the client list by fetching fresh data from the database
	 *
	 * Steps:
	 * 1. Set loading state to true
	 * 2. Fetch clients for the current user
	 * 3. Update clients state
	 * 4. Call onClientsRefreshed callback if provided
	 * 5. Set loading state to false
	 * 6. Handle errors with onError callback if provided
	 *
	 * @returns Promise that resolves when refresh is complete
	 */
	refreshClients: () => Promise<void>
}

/**
 * Custom hook that manages client data fetching and form state
 *
 * @param options - Optional configuration callbacks and settings
 * @returns Object containing clients state, loading state, form state, and control functions
 */
export function useClientManagement(options: UseClientManagementOptions = {}): UseClientManagementReturn {
	const { onClientCreated, onClientUpdated, onClientsRefreshed, onError, autoFetch = true } = options

	const { user } = useUser()

	// State for clients list
	const [clients, setClients] = useState<Client[]>([])

	// State for loading indicator
	const [loading, setLoading] = useState(false)

	// State for form modal visibility
	const [isFormOpen, setIsFormOpen] = useState(false)

	// State for client being edited
	const [editingClient, setEditingClient] = useState<Client | null>(null)

	/**
	 * Fetches clients for the current user from the database
	 *
	 * This is a private helper function that performs the actual data fetching.
	 * It's separated to allow for refreshing without changing other state.
	 *
	 * @returns Promise<Client[]> - The fetched clients
	 * @throws Error if the database operation fails
	 */
	const fetchClients = useCallback(async (): Promise<Client[]> => {
		if (!user?.id) {
			return []
		}

		// Step 1: Fetch clients from database
		const data = await getClientsForUser(user.id)

		// Step 2: Return the fetched clients
		return data as Client[]
	}, [user?.id])

	/**
	 * Refreshes the client list by fetching fresh data
	 */
	const refreshClients = useCallback(async (): Promise<void> => {
		try {
			// Step 1: Set loading state
			setLoading(true)

			// Step 2: Fetch fresh clients
			const fetchedClients = await fetchClients()

			// Step 3: Update clients state
			setClients(fetchedClients)

			// Step 4: Invoke onClientsRefreshed callback if provided
			onClientsRefreshed?.(fetchedClients)
		} catch (error) {
			// Handle errors
			const err = error instanceof Error ? error : new Error('Unknown error occurred')
			onError?.(err)
			// Re-throw to allow caller to handle if needed
			throw err
		} finally {
			// Step 5: Set loading state to false
			setLoading(false)
		}
	}, [fetchClients, onClientsRefreshed, onError])

	/**
	 * Opens the form modal in create mode
	 */
	const openCreateForm = useCallback(() => {
		// Step 1: Clear editing client state (we're creating, not editing)
		setEditingClient(null)

		// Step 2: Open the form modal
		setIsFormOpen(true)
	}, [])

	/**
	 * Opens the form modal in edit mode with the given client
	 */
	const openEditForm = useCallback((client: Client) => {
		// Step 1: Set the editing client
		setEditingClient(client)

		// Step 2: Open the form modal
		setIsFormOpen(true)
	}, [])

	/**
	 * Closes the form modal and clears editing state
	 */
	const closeForm = useCallback(() => {
		// Step 1: Close the form modal
		setIsFormOpen(false)

		// Step 2: Clear the editing client state
		setEditingClient(null)
	}, [])

	// Auto-fetch clients on mount if enabled
	useEffect(() => {
		if (autoFetch && user?.id) {
			refreshClients().catch((error) => {
				// Error already handled in refreshClients via onError callback
				console.error('Error auto-fetching clients:', error)
			})
		}
	}, [autoFetch, user?.id, refreshClients])

	// Return all state and control functions
	return {
		clients,
		loading,
		isFormOpen,
		editingClient,
		openCreateForm,
		openEditForm,
		closeForm,
		refreshClients
	}
}
