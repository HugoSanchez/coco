import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/use-toast'
import {
	createClientWithBilling,
	type CreateClientPayload,
	type ClientBillingSettingsPayload
} from '@/lib/db/clients'
import { UserPlus } from 'lucide-react'

interface ClientFormFieldsProps {
	onSuccess: () => void
	onCancel?: () => void
	hideSubmitButton?: boolean
	onFormSubmit?: (e: React.FormEvent) => void
	onSubmitFunction?: (submitFn: () => Promise<void>) => void
	onLoadingChange?: (loading: boolean) => void
}

export function ClientFormFields({
	onSuccess,
	onCancel,
	hideSubmitButton = false,
	onFormSubmit,
	onSubmitFunction,
	onLoadingChange
}: ClientFormFieldsProps) {
	const [loading, setLoading] = useState(false)
	const { user } = useUser()
	const { toast } = useToast()
	const [formData, setFormData] = useState({
		name: '',
		lastName: '',
		email: '',
		description: '',
		shouldBill: false,
		billingAmount: ''
	})

	const submitForm = useCallback(async () => {
		setLoading(true)
		if (onLoadingChange) onLoadingChange(true)
		try {
			if (!user) throw new Error('Not authenticated')

			// Prepare client data
			const clientPayload: CreateClientPayload = {
				user_id: user.id,
				name: formData.name,
				last_name: formData.lastName || null,
				email: formData.email,
				description: formData.description || null
			}

			// Prepare billing data if billing is enabled
			let billingPayload:
				| Omit<ClientBillingSettingsPayload, 'user_id' | 'client_id'>
				| undefined

			if (formData.shouldBill) {
				billingPayload = {
					billing_amount: formData.billingAmount
						? parseFloat(formData.billingAmount)
						: null,
					billing_type: 'in-advance', // Default to in-advance billing
					currency: 'EUR' // Default currency
				}
			}

			// Create client with optional billing settings
			await createClientWithBilling(clientPayload, billingPayload)

			// Reset form
			setFormData({
				name: '',
				lastName: '',
				email: '',
				description: '',
				shouldBill: false,
				billingAmount: ''
			})

			onSuccess()
			toast({
				title: 'Paciente creado correctamente',
				description: 'El paciente ha sido añadido a tu lista.',
				variant: 'default',
				color: 'success'
			})
		} catch (error) {
			console.error('Error creating client:', error)
			toast({
				title: 'Error al crear paciente',
				description:
					'No se pudo crear el paciente. Inténtalo de nuevo.',
				variant: 'destructive'
			})
		} finally {
			setLoading(false)
			if (onLoadingChange) onLoadingChange(false)
		}
	}, [user, formData, onSuccess, onLoadingChange, toast])

	// Expose the submit function to parent
	useEffect(() => {
		if (onSubmitFunction) {
			onSubmitFunction(submitForm)
		}
	}, [onSubmitFunction, submitForm])

	const handleSubmit = async (e: React.FormEvent) => {
		if (onFormSubmit) {
			onFormSubmit(e)
			return
		}
		e.preventDefault()
		await submitForm()
	}

	const handleInputChange = (field: string, value: string | boolean) => {
		setFormData((prev) => ({ ...prev, [field]: value }))
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-6 mt-6">
			{/* Basic Information */}
			<div className="space-y-6">
				<div className="space-y-2">
					<Label htmlFor="name">Nombre</Label>
					<Input
						id="name"
						value={formData.name}
						onChange={(e) =>
							handleInputChange('name', e.target.value)
						}
						placeholder="Nombre completo del paciente"
						className="h-12"
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="lastName">Apellidos</Label>
					<Input
						id="lastName"
						value={formData.lastName}
						onChange={(e) =>
							handleInputChange('lastName', e.target.value)
						}
						placeholder="Apellidos del paciente"
						className="h-12"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						type="email"
						value={formData.email}
						onChange={(e) =>
							handleInputChange('email', e.target.value)
						}
						placeholder="paciente@ejemplo.com"
						className="h-12"
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="description">Notas opcionales</Label>
					<Textarea
						id="description"
						value={formData.description}
						onChange={(e) =>
							handleInputChange('description', e.target.value)
						}
						placeholder="Cualquier información relevante que quieras recordar."
						className="min-h-12"
						rows={3}
					/>
				</div>
			</div>
			{/* Billing Configuration */}
			<div className="space-y-4">
				<div className="space-y-6 mt-8">
					<div className="space-y-4">
						<div className="flex items-center space-x-2">
							<Checkbox
								id="shouldBill"
								checked={formData.shouldBill}
								className="h-4 w-4"
								onCheckedChange={(checked) =>
									handleInputChange(
										'shouldBill',
										checked === true
									)
								}
							/>
							<Label
								htmlFor="shouldBill"
								className="text-sm text-gray-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
							>
								Crear condiciones de facturación para este
								cliente
							</Label>
						</div>

						{formData.shouldBill && (
							<div className="space-y-2">
								<div>
									<label
										htmlFor="billingAmount"
										className="block text-md font-medium text-gray-700"
									>
										Precio de la consulta
									</label>
									<p className="text-sm text-gray-500 mb-2">
										Honorarios a aplicar por defecto en tus
										consultas.
									</p>
								</div>
								<div className="relative">
									<Input
										id="billingAmount"
										type="number"
										step="0.01"
										value={formData.billingAmount}
										onChange={(e) =>
											handleInputChange(
												'billingAmount',
												e.target.value
											)
										}
										placeholder="0.00"
										className="pr-8 h-12"
									/>
									<span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
										€
									</span>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
			{/* Actions */}
			{!hideSubmitButton && (
				<div className="flex flex-col space-y-3 pt-6">
					<Button
						type="submit"
						variant="default"
						disabled={loading}
						className="w-full text-md font-medium"
					>
						<UserPlus className="h-4 w-4 mr-2" />
						{loading ? 'Guardando...' : 'Añadir'}
					</Button>
					{onCancel && (
						<Button
							type="button"
							variant="ghost"
							onClick={onCancel}
							className="w-full text-md font-medium text-gray-600 hover:text-gray-800"
						>
							Cancelar
						</Button>
					)}
				</div>
			)}
		</form>
	)
}
