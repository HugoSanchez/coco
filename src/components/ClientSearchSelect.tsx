'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { User } from 'lucide-react'
import { getClientFullName } from '@/lib/db/clients'

interface Client {
	id: string
	name: string
	last_name?: string | null
	email: string
}

interface ClientSearchSelectProps {
	clients: Client[]
	value: string
	onValueChange: (value: string) => void
	placeholder?: string
	disabled?: boolean
	className?: string
}

export function ClientSearchSelect({
	clients,
	value,
	onValueChange,
	placeholder = 'Buscar paciente...',
	disabled = false,
	className = ''
}: ClientSearchSelectProps) {
	const [searchTerm, setSearchTerm] = useState('')
	const [isOpen, setIsOpen] = useState(false)
	const [selectedClient, setSelectedClient] = useState<Client | null>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)

	// Find selected client when value changes
	useEffect(() => {
		if (value) {
			const client = clients.find((c) => c.id === value)
			setSelectedClient(client || null)
			if (client) {
				setSearchTerm(getClientFullName(client))
			}
		} else {
			setSelectedClient(null)
			setSearchTerm('')
		}
	}, [value, clients])

	// Filter clients based on search term
	const filteredClients = useMemo(() => {
		if (!searchTerm.trim()) return clients

		const search = searchTerm.toLowerCase()
		return clients.filter(
			(client) =>
				getClientFullName(client).toLowerCase().includes(search) ||
				client.email.toLowerCase().includes(search)
		)
	}, [clients, searchTerm])

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setIsOpen(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () =>
			document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value
		setSearchTerm(newValue)
		setIsOpen(true)

		// Clear selection if input doesn't match selected client
		if (selectedClient && newValue !== getClientFullName(selectedClient)) {
			setSelectedClient(null)
			onValueChange('')
		}
	}

	const handleClientSelect = (client: Client) => {
		setSelectedClient(client)
		setSearchTerm(getClientFullName(client))
		setIsOpen(false)
		onValueChange(client.id)
	}

	const handleInputFocus = () => {
		setIsOpen(true)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') {
			setIsOpen(false)
			inputRef.current?.blur()
		}
	}

	return (
		<div ref={containerRef} className={`relative ${className}`}>
			<div className="relative">
				<Input
					ref={inputRef}
					type="text"
					value={searchTerm}
					onChange={handleInputChange}
					onFocus={handleInputFocus}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					disabled={disabled}
					className="pr-10"
				/>
				<User className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
			</div>

			{/* Dropdown */}
			{isOpen && filteredClients.length > 0 && (
				<div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
					{filteredClients.map((client) => (
						<button
							key={client.id}
							type="button"
							className={`w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0 ${
								selectedClient?.id === client.id
									? 'bg-teal-50 text-teal-800'
									: ''
							}`}
							onClick={() => handleClientSelect(client)}
						>
							<div className="font-medium text-gray-900">
								{getClientFullName(client)}
							</div>
							<div className="text-sm text-gray-500">
								{client.email}
							</div>
						</button>
					))}
				</div>
			)}

			{/* No results message */}
			{isOpen && searchTerm && filteredClients.length === 0 && (
				<div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
					<div className="text-sm text-gray-500 text-center">
						No se encontraron pacientes que coincidan con &quot;
						{searchTerm}&quot;
					</div>
				</div>
			)}
		</div>
	)
}
