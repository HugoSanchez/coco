"use client"

import { useState, useEffect } from 'react'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClientForm } from './ClientForm'
import { Tables } from '@/types/database.types'
import { useUser } from '@/contexts/UserContext'
import { getClientsForUser } from '@/lib/db/clients'

type Client = Tables<'clients'>

export function ClientList() {
	const [clients, setClients] = useState<Client[]>([])
	const [loading, setLoading] = useState(true)
	const [isFormOpen, setIsFormOpen] = useState(false)
	const { user } = useUser()

	const fetchClients = async () => {
		try {
			setLoading(true)
			if (!user) {
				throw new Error('Not authenticated')
			}
			const data = await getClientsForUser(user.id)
			setClients(data)
		} catch (error) {
			console.error('Error fetching clients:', error)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchClients()
	}, [user])

	const handleClientCreated = () => {
		setIsFormOpen(false)
		fetchClients()
	}

	if (loading) {
		return <div>Loading clients...</div>
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold">Clients</h2>
				<Button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2">
					<Plus className="h-4 w-4" />
					Add Client
				</Button>
			</div>

			{clients.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							No clients yet
						</CardTitle>
						<CardDescription>
							Add your first client to get started with billing and scheduling.
						</CardDescription>
					</CardHeader>
				</Card>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>Your Clients</CardTitle>
						<CardDescription>
							Manage your client relationships and billing settings.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Billing</TableHead>
									<TableHead>Created</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{clients.map((client) => (
									<TableRow key={client.id}>
										<TableCell className="font-medium">{client.name}</TableCell>
										<TableCell>{client.email}</TableCell>
										<TableCell>
											{client.should_bill ? (
												<div className="flex items-center gap-2">
													<Badge variant="secondary">
														€{client.billing_amount}
													</Badge>
													<span className="text-sm text-gray-500">
														{client.billing_type === 'recurring' ? client.billing_frequency : client.billing_type}
													</span>
												</div>
											) : (
												<Badge variant="outline">No billing</Badge>
											)}
										</TableCell>
										<TableCell>
											{client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			<ClientForm
				isOpen={isFormOpen}
				onClose={() => setIsFormOpen(false)}
				onClientCreated={handleClientCreated}
			/>
		</div>
	)
}
