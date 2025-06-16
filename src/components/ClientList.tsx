"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Users, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClientForm } from './ClientForm'
import { Tables } from '@/types/database.types'

// Accept clients and loading as props
export type Client = Tables<'clients'>

export function ClientList({ clients, loading }: { clients: Client[]; loading: boolean }) {
	const [isFormOpen, setIsFormOpen] = useState(false)

	const handleClientCreated = () => {
		setIsFormOpen(false)
		// The parent (dashboard) should re-fetch clients after creation
	}

	if (loading) {
		return <div>Loading clients...</div>
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="flex flex-row items-center">
					<div className="grid gap-1">
						<CardTitle>Pacientes</CardTitle>
						<CardDescription>
							Tu lista de pacientes activos.
						</CardDescription>
					</div>
					<Button onClick={() => setIsFormOpen(true)} size="sm" className="ml-auto gap-1 bg-gray-100 text-gray-800 hover:bg-gray-200">
						Añadir
						<Plus className="h-5 w-5" />
					</Button>
				</CardHeader>
				<CardContent>
					<div className="max-h-[28rem] overflow-y-auto scrollbar-hide">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Paciente</TableHead>
									<TableHead className="hidden xl:table-column">Billing</TableHead>
									<TableHead className="hidden xl:table-column">Status</TableHead>
									<TableHead className="hidden md:table-cell lg:hidden xl:table-column">Created</TableHead>
									<TableHead className="text-right">Total facturado</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{clients.map((client) => (
									<TableRow key={client.id}>
										<TableCell>
											<div className="font-medium">{client.name}</div>
											<div className="hidden text-sm text-muted-foreground md:inline">
												{client.email}
											</div>
										</TableCell>
										<TableCell className="hidden xl:table-column">
											{client.billing_type === 'recurring' ? client.billing_frequency : client.billing_type || 'N/A'}
										</TableCell>
										<TableCell className="hidden xl:table-column">
											<Badge className="text-xs" variant={client.should_bill ? 'secondary' : 'outline'}>
												{client.should_bill ? 'Active' : 'No billing'}
											</Badge>
										</TableCell>
										<TableCell className="hidden md:table-cell lg:hidden xl:table-column">
											{client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}
										</TableCell>
										<TableCell className="text-right">
											{client.billing_amount ? `€${client.billing_amount}` : '-'}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			<ClientForm
				isOpen={isFormOpen}
				onClose={() => setIsFormOpen(false)}
				onClientCreated={handleClientCreated}
			/>
		</div>
	)
}
