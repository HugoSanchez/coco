"use client"

import { useState, useEffect } from 'react'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClientForm } from './ClientForm'
import { supabase } from '@/lib/supabase'
import { Tables } from '@/types/database.types'

type Client = Tables<'clients'>

export function ClientList() {
	const [clients, setClients] = useState<Client[]>([])
	const [loading, setLoading] = useState(true)
	const [isFormOpen, setIsFormOpen] = useState(false)

	const fetchClients = async () => {
		try {
			const { data: { session } } = await supabase.auth.getSession()
			if (!session) return

			const response = await fetch('/api/clients')
			if (response.ok) {
				const clientsData = await response.json()
				setClients(clientsData)
			}
		} catch (error) {
			console.error('Error fetching clients:', error)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchClients()
	}, [])

	const handleClientCreated = () => {
		fetchClients() // Refresh the list
		setIsFormOpen(false) // Close the form
	}

	const getBillingDisplay = (client: Client) => {
		if (!client.should_bill) return 'No billing'

		if (client.billing_type === 'recurring') {
			return `${client.billing_frequency} - $${client.billing_amount}`
		} else if (client.billing_type === 'consultation_based') {
			const timing = client.billing_trigger === 'before_consultation'
				? `${client.billing_advance_days} days before`
				: 'after consultation'
			return `Per consultation (${timing}) - $${client.billing_amount}`
		} else if (client.billing_type === 'project_based') {
			return `Project billing - $${client.billing_amount}`
		}

		return 'Custom billing'
	}

	const getBillingBadgeColor = (type?: string | null) => {
		switch (type) {
			case 'recurring': return 'bg-blue-100 text-blue-800'
			case 'consultation_based': return 'bg-green-100 text-green-800'
			case 'project_based': return 'bg-purple-100 text-purple-800'
			default: return 'bg-gray-100 text-gray-800'
		}
	}

	if (loading) {
		return (
		<Card>
			<CardContent className="flex justify-center py-8">
			<div className="text-gray-500">Loading clients...</div>
			</CardContent>
		</Card>
		)
	}

	return (
		<>
		<Card>
			<CardHeader>
			<div className="flex items-center justify-between">
				<div>
				<CardTitle className="flex items-center gap-2">
					<Users className="h-5 w-5" />
					Clients ({clients.length})
				</CardTitle>
				<CardDescription>
					Manage your clients and their billing preferences
				</CardDescription>
				</div>
				<Button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2">
				<Plus className="h-4 w-4" />
				Add Client
				</Button>
			</div>
			</CardHeader>
			<CardContent>
			{clients.length === 0 ? (
				<div className="text-center py-8">
				<Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
				<h3 className="text-lg font-medium text-gray-900 mb-2">No clients yet</h3>
				<p className="text-gray-500 mb-4">Get started by adding your first client</p>
				<Button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2">
					<Plus className="h-4 w-4" />
					Add Your First Client
				</Button>
				</div>
			) : (
				<div className="overflow-x-auto">
				<Table>
					<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Email</TableHead>
						<TableHead>Billing</TableHead>
						<TableHead>Type</TableHead>
						<TableHead>Created</TableHead>
					</TableRow>
					</TableHeader>
					<TableBody>
					{clients.map((client) => (
						<TableRow key={client.id}>
						<TableCell>
							<div>
							<div className="font-medium">{client.name}</div>
							{client.description && (
								<div className="text-sm text-gray-500 truncate max-w-xs">
								{client.description}
								</div>
							)}
							</div>
						</TableCell>
						<TableCell>{client.email}</TableCell>
						<TableCell>
							<div className="text-sm">
							{getBillingDisplay(client)}
							</div>
						</TableCell>
						<TableCell>
							<Badge
							variant="secondary"
							className={getBillingBadgeColor(client.billing_type)}
							>
							{client.billing_type?.replace('_', ' ') || 'none'}
							</Badge>
						</TableCell>
						<TableCell>
							<div className="text-sm text-gray-500">
							{client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}
							</div>
						</TableCell>
						</TableRow>
					))}
					</TableBody>
				</Table>
				</div>
			)}
			</CardContent>
		</Card>

		<ClientForm
			isOpen={isFormOpen}
			onClose={() => setIsFormOpen(false)}
			onClientCreated={handleClientCreated}
		/>
		</>
	)
}
