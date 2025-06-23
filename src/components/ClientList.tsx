'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Users, ArrowUpRight } from 'lucide-react'
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
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClientForm } from './ClientForm'
import { Tables } from '@/types/database.types'

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
 */
interface ClientListProps {
	clients: Client[]
	loading: boolean
}

/**
 * ClientList Component
 *
 * Displays a list of clients/patients in a table format with the ability to
 * add new clients. Provides a clean interface for managing client relationships.
 *
 * FEATURES:
 * - Displays clients in a responsive table
 * - Add new client functionality via modal
 * - Loading state handling
 * - Scrollable table for many clients
 * - Client name and email display
 *
 * COMPONENT STRUCTURE:
 * - Card container with header and content
 * - Table with client information
 * - Add client button in header
 * - ClientForm modal for adding new clients
 *
 * @component
 * @example
 * ```tsx
 * <ClientList
 *   clients={clients}
 *   loading={isLoading}
 * />
 * ```
 */
export function ClientList({ clients, loading }: ClientListProps) {
	// State to control the client form modal visibility
	const [isFormOpen, setIsFormOpen] = useState(false)

	/**
	 * Handles successful client creation
	 *
	 * Closes the form modal and signals to the parent component
	 * that clients should be re-fetched to show the new client.
	 */
	const handleClientCreated = () => {
		setIsFormOpen(false)
		// The parent (dashboard) should re-fetch clients after creation
		// This could be enhanced with a callback prop for better communication
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
								</TableRow>
							</TableHeader>

							{/* Table body with client rows */}
							<TableBody>
								{clients.map((client) => (
									<TableRow key={client.id}>
										<TableCell>
											{/* Client name (always visible) */}
											<div className="font-medium">
												{client.name}
											</div>
											{/* Client email (hidden on mobile for space) */}
											<div className="hidden text-sm text-muted-foreground md:inline">
												{client.email}
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{/* Client form modal for adding new clients */}
			<ClientForm
				isOpen={isFormOpen}
				onClose={() => setIsFormOpen(false)}
				onClientCreated={handleClientCreated}
			/>
		</div>
	)
}
