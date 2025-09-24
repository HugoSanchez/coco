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
	upsertClientWithBilling,
	type CreateClientPayload,
	type ClientBillingSettingsPayload,
	type UpsertClientPayload,
	type UpsertBillingPayload,
	type Client
} from '@/lib/db/clients'
import { getClientBillingSettings } from '@/lib/db/billing-settings'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { UserPlus, Save } from 'lucide-react'
import { getClientsForUser } from '@/lib/db/clients'

interface ClientFormFieldsProps {
	onSuccess: (client?: Client) => void
	onCancel?: () => void
	hideSubmitButton?: boolean
	hideCancelButton?: boolean
	onFormSubmit?: (e: React.FormEvent) => void
	onSubmitFunction?: (submitFn: () => Promise<void>) => void
	onLoadingChange?: (loading: boolean) => void
	// New props for edit mode
	editMode?: boolean
	initialData?: Client
}

export function ClientFormFields({
	onSuccess,
	onCancel,
	hideSubmitButton = false,
	hideCancelButton = false,
	onFormSubmit,
	onSubmitFunction,
	onLoadingChange,
	editMode = false,
	initialData
}: ClientFormFieldsProps) {
	const [loading, setLoading] = useState(false)
	const { user } = useUser()
	const { toast } = useToast()

	// Initialize form data with either initial data (edit mode) or empty values (create mode)
	const [formData, setFormData] = useState({
		name: initialData?.name || '',
		lastName: initialData?.last_name || '',
		email: initialData?.email || '',
		description: initialData?.description || '',
		shouldBill: false, // We'll load this from billing settings separately
		billingAmount: '', // We'll load this from billing settings separately
		paymentEmailLeadHours: '0'
	})

	// Load existing billing settings when in edit mode
	useEffect(() => {
		const loadBillingSettings = async () => {
			if (editMode && initialData && user) {
				try {
					const billingSettings = await getClientBillingSettings(
						user.id,
						initialData.id
					)

					if (billingSettings) {
						const amountString =
							billingSettings.billing_amount?.toString() || ''

						setFormData((prev) => ({
							...prev,
							shouldBill: true,
							billingAmount: amountString,
							paymentEmailLeadHours:
								(billingSettings as any)
									.payment_email_lead_hours != null
									? String(
											(billingSettings as any)
												.payment_email_lead_hours
										)
									: '0'
						}))
					}
				} catch (error) {
					console.error('Error loading billing settings:', error)
					// Don't show error toast, just continue without billing data
				}
			}
		}

		loadBillingSettings()
	}, [editMode, initialData, user])

	const submitForm = useCallback(async () => {
		setLoading(true)
		if (onLoadingChange) onLoadingChange(true)
		try {
			if (!user) throw new Error('Not authenticated')

			// Prepare client data for upsert (include ID for edit mode)
			const clientPayload: UpsertClientPayload = {
				...(editMode && initialData?.id ? { id: initialData.id } : {}), // Include ID only in edit mode
				user_id: user.id,
				name: formData.name,
				last_name: formData.lastName || null,
				email: formData.email,
				description: formData.description || null
			}

			// Prepare billing data if billing is enabled
			let billingPayload: UpsertBillingPayload | undefined

			if (formData.shouldBill) {
				billingPayload = {
					billing_amount: formData.billingAmount
						? parseFloat(formData.billingAmount)
						: null,
					billing_type: 'in-advance', // Default to in-advance billing
					currency: 'EUR', // Default currency
					payment_email_lead_hours:
						formData.paymentEmailLeadHours !== ''
							? parseInt(formData.paymentEmailLeadHours, 10)
							: null
				}
			}

			// Upsert client with optional billing settings (works for both create and update)
			await upsertClientWithBilling(clientPayload, billingPayload)

			// Try to retrieve the created/updated client so caller can auto-select it
			let createdClient: Client | undefined = undefined
			try {
				const list = await getClientsForUser(user.id)
				createdClient = (list as Client[]).find(
					(c) =>
						c.email?.toLowerCase() === formData.email.toLowerCase()
				)
			} catch {}

			// Reset form only in create mode (in edit mode, keep the form populated)
			if (!editMode) {
				setFormData({
					name: '',
					lastName: '',
					email: '',
					description: '',
					shouldBill: false,
					billingAmount: '',
					paymentEmailLeadHours: '0'
				})
			}

			onSuccess(createdClient)

			// Context-aware success message
			toast({
				title: editMode
					? 'Paciente actualizado correctamente'
					: 'Paciente creado correctamente',
				description: editMode
					? 'Los datos del paciente han sido actualizados.'
					: 'El paciente ha sido añadido a tu lista.',
				variant: 'default',
				color: 'success'
			})
		} catch (error) {
			console.error(
				`Error ${editMode ? 'updating' : 'creating'} client:`,
				error
			)
			toast({
				title: editMode
					? 'Error al actualizar paciente'
					: 'Error al crear paciente',
				description: editMode
					? 'No se pudieron actualizar los datos del paciente. Inténtalo de nuevo.'
					: 'No se pudo crear el paciente. Inténtalo de nuevo.',
				variant: 'destructive'
			})
		} finally {
			setLoading(false)
			if (onLoadingChange) onLoadingChange(false)
		}
	}, [
		user,
		formData,
		onSuccess,
		onLoadingChange,
		toast,
		editMode,
		initialData
	])

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
										min={1}
										value={formData.billingAmount}
										onChange={(e) =>
											handleInputChange(
												'billingAmount',
												e.target.value
											)
										}
										onBlur={(e) => {
											const v = e.target.value
											if (!v) return
											const n = parseFloat(v)
											if (!isNaN(n) && n < 1) {
												handleInputChange(
													'billingAmount',
													'1'
												)
											}
										}}
										placeholder="0.00"
										className="pr-8 h-12"
									/>
									<span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
										€
									</span>
								</div>

								{/* Per-patient email timing */}
								<div className="space-y-2">
									<div>
										<label className="block text-md font-medium text-gray-700">
											Cuándo enviar el email de pago
										</label>
										<p className="text-sm text-gray-500 mb-2">
											Solo para este paciente.
										</p>
									</div>
									<Select
										value={formData.paymentEmailLeadHours}
										onValueChange={(val) =>
											handleInputChange(
												'paymentEmailLeadHours',
												val
											)
										}
									>
										<SelectTrigger className="h-12">
											<SelectValue placeholder="Selecciona cuándo enviar el email" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="0">
												Inmediatamente
											</SelectItem>
											<SelectItem value="24">
												24 horas antes
											</SelectItem>
											<SelectItem value="72">
												72 horas antes
											</SelectItem>
											<SelectItem value="168">
												1 semana antes
											</SelectItem>
											<SelectItem value="-1">
												Después de la consulta
											</SelectItem>
										</SelectContent>
									</Select>
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
						{loading
							? editMode
								? 'Guardando...'
								: 'Creando...'
							: editMode
								? 'Guardar cambios'
								: 'Añadir paciente'}
					</Button>
					{onCancel && !hideCancelButton && (
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
