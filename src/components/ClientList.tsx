'use client'

import { useState } from 'react'
import { Plus, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/components/ui/card'
import { ClientForm } from './ClientForm'
import { Tables } from '@/types/database.types'
import { getClientFullName } from '@/lib/db/clients'

/**
 * Type alias for Client data from the database
 * Provides type safety for client data operations
 */
export type Client = Tables<'clients'>

/**
 * Props interface for the ClientList component
 *
 * @interface ClientListProps
 * @property clients - Array of client objects to display
 * @property loading - Boolean indicating if clients are being fetched
 * @property onClientCreated - Callback function called when a client is successfully created
 * @property onEditClient - Optional callback function called when a client needs to be edited
 */
interface ClientListProps {
	clients: Client[]
	loading: boolean
	onClientCreated?: () => void
	onEditClient?: (client: Client) => void
}

/**
 * ClientList Component
 *
 * Displays a list of clients/patients in a table format with the ability to
 * add new clients and edit existing ones through action dropdowns.
 */
export function ClientList({
	clients,
	loading,
	onClientCreated,
	onEditClient
}: ClientListProps) {
	// State to control the client form modal visibility
	const [isFormOpen, setIsFormOpen] = useState(false)
	// State to track which client is being edited
	const [editingClient, setEditingClient] = useState<Client | null>(null)

	/**
	 * Handles successful client creation
	 *
	 * Closes the form modal and refreshes the client list
	 * by calling the parent component's refresh callback.
	 */
	const handleClientCreated = () => {
		setIsFormOpen(false)
		setEditingClient(null) // Clear editing state
		// Call parent callback to refresh the client list
		onClientCreated?.()
	}

	/**
	 * Handles the edit client action
	 * Opens the form modal in edit mode with the selected client data
	 */
	const handleEditClient = (client: Client) => {
		setEditingClient(client)
		setIsFormOpen(true)
		// Optionally notify parent component
		onEditClient?.(client)
	}

	/**
	 * Handles closing the form modal
	 * Resets both form and editing state
	 */
	const handleCloseForm = () => {
		setIsFormOpen(false)
		setEditingClient(null)
	}

	// Show loading state while clients are being fetched
	if (loading) {
		return <div>Loading clients...</div>
	}

	return (
		<div className="space-y-6">
			{/* Main client list card */}
			<Card>
				{/* Card header with title and add button */}
				<CardHeader className="flex flex-row items-center">
					<div className="grid gap-1">
						<CardTitle>Pacientes</CardTitle>
						<CardDescription>
							Tu lista de pacientes activos.
						</CardDescription>
					</div>

					{/* Add new client button */}
					<Button
						onClick={() => setIsFormOpen(true)}
						size="sm"
						className="ml-auto gap-1 bg-gray-100 text-gray-800 hover:bg-gray-200"
					>
						Añadir
						<Plus className="h-5 w-5" />
					</Button>
				</CardHeader>

				{/* Card content with client table */}
				<CardContent>
					{/* Scrollable table container */}
					<div className="max-h-[28rem] overflow-y-auto scrollbar-hide">
						<Table>
							{/* Table header */}
							<TableHeader>
								<TableRow>
									<TableHead>Paciente</TableHead>
									<TableHead className="text-right">
										Acciones
									</TableHead>
								</TableRow>
							</TableHeader>

							{/* Table body with client rows */}
							<TableBody>
								{clients.map((client) => (
									<TableRow key={client.id}>
										<TableCell>
											{/* Client name (always visible) */}
											<div className="font-medium">
												{getClientFullName(client)}
											</div>
											{/* Client email (hidden on mobile for space) */}
											<div className="hidden text-sm text-muted-foreground md:inline">
												{client.email}
											</div>
										</TableCell>
										{/* Actions dropdown */}
										<TableCell className="text-right py-2">
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														className="h-8 w-8 p-0 hover:bg-gray-100"
													>
														<MoreHorizontal className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() =>
															handleEditClient(
																client
															)
														}
													>
														Editar
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{/* Client form modal for adding new clients or editing existing ones */}
			<ClientForm
				isOpen={isFormOpen}
				onClose={handleCloseForm}
				onClientCreated={handleClientCreated}
				editMode={!!editingClient}
				initialData={editingClient || undefined}
			/>
		</div>
	)
}
