import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useUser } from '@/contexts/UserContext'
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
	const [formData, setFormData] = useState({
		name: '',
		email: '',
		description: '',
		shouldBill: false,
		billingAmount: '',
		billingType: '',
		billingFrequency: '',
		billingTrigger: '',
		billingAdvanceDays: ''
	})
	const [useDefaultBilling, setUseDefaultBilling] = useState(false)

	const submitForm = useCallback(async () => {
		setLoading(true)
		if (onLoadingChange) onLoadingChange(true)
		try {
			if (!user) throw new Error('Not authenticated')

			// Prepare client data
			const clientPayload: CreateClientPayload = {
				user_id: user.id,
				name: formData.name,
				email: formData.email,
				description: formData.description || null
			}

			// Prepare billing data if billing is enabled
			let billingPayload:
				| Omit<ClientBillingSettingsPayload, 'user_id' | 'client_id'>
				| undefined

			if (useDefaultBilling && formData.shouldBill) {
				billingPayload = {
					should_bill: true,
					billing_amount: formData.billingAmount
						? parseFloat(formData.billingAmount)
						: null,
					billing_type: formData.billingType || null,
					billing_frequency: formData.billingFrequency || null,
					billing_trigger: formData.billingTrigger || null,
					billing_advance_days: formData.billingAdvanceDays
						? parseInt(formData.billingAdvanceDays)
						: null
				}
			}

			// Create client with optional billing settings
			await createClientWithBilling(clientPayload, billingPayload)

			// Reset form
			setFormData({
				name: '',
				email: '',
				description: '',
				shouldBill: false,
				billingAmount: '',
				billingType: '',
				billingFrequency: '',
				billingTrigger: '',
				billingAdvanceDays: ''
			})
			setUseDefaultBilling(false)

			onSuccess()
		} catch (error) {
			console.error('Error creating client:', error)
			alert(
				error instanceof Error
					? error.message
					: 'Failed to create client'
			)
		} finally {
			setLoading(false)
			if (onLoadingChange) onLoadingChange(false)
		}
	}, [user, formData, useDefaultBilling, onSuccess, onLoadingChange])

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

	const getBillingRecurrenceValue = () => {
		if (formData.billingType === 'consultation_based') {
			return 'consultation_based'
		} else if (formData.billingType === 'recurring') {
			return formData.billingFrequency
		}
		return ''
	}

	const handleRecurrenceChange = (value: string) => {
		if (value === 'consultation_based') {
			handleInputChange('billingType', 'consultation_based')
			handleInputChange('billingFrequency', '')
		} else if (value === 'weekly') {
			handleInputChange('billingType', 'recurring')
			handleInputChange('billingFrequency', 'weekly')
		} else if (value === 'monthly') {
			handleInputChange('billingType', 'recurring')
			handleInputChange('billingFrequency', 'monthly')
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-6 mt-6">
			{/* Basic Information */}
			<div className="space-y-6">
				<div className="space-y-2">
					<Label htmlFor="name">Nombre del paciente</Label>
					<Input
						id="name"
						value={formData.name}
						onChange={(e) =>
							handleInputChange('name', e.target.value)
						}
						placeholder="Nombre completo del cliente"
						className="h-12"
						required
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
						placeholder="cliente@ejemplo.com"
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
				<div className="flex items-center space-x-2 pt-2">
					<Checkbox
						id="useDefaultBilling"
						checked={useDefaultBilling}
						className="h-4 w-4"
						onCheckedChange={(checked) =>
							setUseDefaultBilling(checked === true)
						}
					/>
					<Label
						htmlFor="useDefaultBilling"
						className="text-sm text-gray-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
					>
						Añadir condiciones de facturación particulares para este
						paciente
					</Label>
				</div>

				{useDefaultBilling && (
					<div className="space-y-6 mt-6">
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
									className="text-sm text-gray-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
								>
									Habilitar facturación para este cliente
								</Label>
							</div>

							{formData.shouldBill && (
								<>
									<div className="space-y-2">
										<div>
											<label
												htmlFor="billingAmount"
												className="block text-md font-medium text-gray-700"
											>
												Precio de la consulta
											</label>
											<p className="text-sm text-gray-500 mb-2">
												Honorarios a aplicar por defecto
												en tus consultas.
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
									<div className="space-y-2">
										<div>
											<label
												htmlFor="billingRecurrence"
												className="block text-md font-medium text-gray-700"
											>
												Recurrencia de facturación
											</label>
											<p className="text-sm text-gray-500 mb-2">
												Selecciona la frecuencia con la
												que deseas facturar a tus
												pacientes.
											</p>
										</div>
										<Select
											value={getBillingRecurrenceValue()}
											onValueChange={
												handleRecurrenceChange
											}
										>
											<SelectTrigger className="h-12">
												<SelectValue placeholder="Selecciona recurrencia" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="consultation_based">
													Por Consulta{' '}
													<span className="text-xs text-gray-500">
														- Enviar una factura
														antes o después de cada
														consulta
													</span>
												</SelectItem>
												<SelectItem value="weekly">
													Semanal{' '}
													<span className="text-xs text-gray-500">
														- Enviar una factura a
														final de semana
													</span>
												</SelectItem>
												<SelectItem value="monthly">
													Mensual{' '}
													<span className="text-xs text-gray-500">
														- Enviar una factura a
														final de mes
													</span>
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
									{/* Only show billingTrigger if consultation_based */}
									{getBillingRecurrenceValue() ===
										'consultation_based' && (
										<>
											<div className="space-y-2">
												<div>
													<label
														htmlFor="billingTrigger"
														className="block text-md font-medium text-gray-700"
													>
														Cuándo enviar la factura
													</label>
													<p className="text-sm text-gray-500 mb-2">
														Selecciona si quieres
														que enviemos la factura
														antes o después de la
														consulta.
													</p>
												</div>
												<Select
													value={
														formData.billingTrigger
													}
													onValueChange={(value) =>
														handleInputChange(
															'billingTrigger',
															value
														)
													}
												>
													<SelectTrigger className="h-12">
														<SelectValue placeholder="Selecciona un timing" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="after_consultation">
															Después de la
															consulta{' '}
															<span className="text-xs text-gray-500">
																- Enviaremos la
																factura hasta
																24h después de
																la consulta
															</span>
														</SelectItem>
														<SelectItem value="before_consultation">
															Antes de la consulta
															<span className="text-xs text-gray-500">
																- Enviaremos la
																factura unos
																días antes de la
																consulta
															</span>
														</SelectItem>
													</SelectContent>
												</Select>
											</div>
											{formData.billingTrigger ===
												'before_consultation' && (
												<div className="space-y-2">
													<Label htmlFor="billingAdvanceDays">
														Días de antelación
													</Label>
													<Input
														id="billingAdvanceDays"
														type="number"
														min="1"
														value={
															formData.billingAdvanceDays
														}
														onChange={(e) =>
															handleInputChange(
																'billingAdvanceDays',
																e.target.value
															)
														}
														placeholder="3"
														className="h-12"
													/>
												</div>
											)}
										</>
									)}
								</>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Actions */}
			{!hideSubmitButton && (
				<div className="flex gap-3 pt-6">
					<Button
						type="submit"
						variant="default"
						disabled={loading}
						className="flex-1 text-md font-medium"
					>
						<UserPlus className="h-4 w-4 mr-2" />
						{loading ? 'Guardando...' : 'Añadir'}
					</Button>
					{onCancel && (
						<Button
							type="button"
							variant="outline"
							onClick={onCancel}
							className="flex-1 text-md font-medium"
						>
							Cancelar
						</Button>
					)}
				</div>
			)}
		</form>
	)
}
