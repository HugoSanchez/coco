import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/use-toast'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import {
	createClientWithBilling,
	upsertClientWithBilling,
	type CreateClientPayload,
	type ClientBillingSettingsPayload,
	type UpsertClientPayload,
	type UpsertBillingPayload,
	type Client,
	clientEmailExists
} from '@/lib/db/clients'
import {
	getClientBillingSettings,
	getUserDefaultBillingSettings,
	getBillingPreferences
} from '@/lib/db/billing-settings'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserPlus, Save } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
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

	// Helper function to convert YYYY-MM-DD to DD/MM/YYYY for display
	const formatDateForDisplay = (dateString: string | null | undefined): string => {
		if (!dateString) return ''
		// If already in DD/MM/YYYY format, return as is
		if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return dateString
		// Convert YYYY-MM-DD to DD/MM/YYYY
		const parts = dateString.split('-')
		if (parts.length === 3) {
			return `${parts[2]}/${parts[1]}/${parts[0]}`
		}
		return dateString
	}

	// Helper function to convert DD/MM/YYYY to YYYY-MM-DD for database
	const formatDateForDatabase = (dateString: string): string | null => {
		if (!dateString || !dateString.trim()) return null
		// If already in YYYY-MM-DD format, return as is
		if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString
		// Convert DD/MM/YYYY to YYYY-MM-DD
		const parts = dateString.split('/')
		if (parts.length === 3) {
			const day = parts[0].padStart(2, '0')
			const month = parts[1].padStart(2, '0')
			const year = parts[2]
			// Basic validation
			if (day.length === 2 && month.length === 2 && year.length === 4) {
				return `${year}-${month}-${day}`
			}
		}
		return null
	}

	// Helper function to format date input as user types (DD/MM/YYYY)
	const formatDateInput = (value: string): string => {
		// Remove all non-digits
		const digits = value.replace(/\D/g, '')

		// Limit to 8 digits (DDMMYYYY)
		const limited = digits.slice(0, 8)

		// Add slashes automatically
		if (limited.length <= 2) {
			return limited
		} else if (limited.length <= 4) {
			return `${limited.slice(0, 2)}/${limited.slice(2)}`
		} else {
			return `${limited.slice(0, 2)}/${limited.slice(2, 4)}/${limited.slice(4)}`
		}
	}

	// Initialize form data with either initial data (edit mode) or empty values (create mode)
	const [formData, setFormData] = useState({
		name: initialData?.name || '',
		lastName: initialData?.last_name || '',
		email: initialData?.email || '',
		description: initialData?.description || '',
		phone: (initialData as any)?.phone || '',
		nationalId: (initialData as any)?.national_id || '',
		dateOfBirth: formatDateForDisplay((initialData as any)?.date_of_birth),
		address: (initialData as any)?.address || '',
		shouldBill: false, // We'll load this from billing settings separately
		billingAmount: '', // We'll load this from billing settings separately
		paymentEmailLeadHours: '0',
		billingType: 'in-advance' as 'in-advance' | 'right-after' | 'monthly',
		applyVat: false // VAT checkbox state
	})

	// Duplicate email detection state
	const [checkingDuplicate, setCheckingDuplicate] = useState(false)
	const [duplicateExists, setDuplicateExists] = useState(false)
	const [existingClientId, setExistingClientId] = useState<string | null>(null)
	const [confirmingDuplicate, setConfirmingDuplicate] = useState(false)

	// Helpers to know when we're editing and whether the email changed vs original
	const isEditing = Boolean(editMode && initialData?.id)
	const originalEmail = (initialData?.email || '').trim().toLowerCase()
	const currentEmail = (formData.email || '').trim().toLowerCase()
	const emailChanged = isEditing ? currentEmail !== originalEmail : true
	// Debounce + stale request guards
	const emailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const lastRequestIdRef = useRef<number>(0)

	// Track if defaults have been applied (to avoid re-applying when user edits)
	const defaultsAppliedRef = useRef(false)
	const [userDefaults, setUserDefaults] = useState<{
		billingAmount: string
		billingType: 'in-advance' | 'right-after' | 'monthly'
		paymentEmailLeadHours: string
		applyVat: boolean
	} | null>(null)

	// Load user default billing settings on mount (for create mode)
	useEffect(() => {
		const loadUserDefaults = async () => {
			if (!editMode && user?.id) {
				try {
					const defaultSettings = await getUserDefaultBillingSettings(user.id)
					const prefs = await getBillingPreferences(user.id)

					if (defaultSettings || prefs) {
						const amountString = defaultSettings?.billing_amount?.toString() || prefs?.billingAmount || ''
						const billingType =
							(defaultSettings?.billing_type as 'in-advance' | 'right-after' | 'monthly') ||
							(prefs?.billingType as 'in-advance' | 'right-after' | 'monthly') ||
							'in-advance'
						const leadHours =
							defaultSettings?.payment_email_lead_hours != null
								? String(defaultSettings.payment_email_lead_hours)
								: prefs?.paymentEmailLeadHours || '0'
						const vatRate =
							defaultSettings?.vat_rate_percent ??
							(prefs?.vatRatePercent ? parseFloat(prefs.vatRatePercent) : null)

						setUserDefaults({
							billingAmount: amountString,
							billingType,
							paymentEmailLeadHours: leadHours,
							applyVat: vatRate != null && vatRate > 0
						})
					}
				} catch (error) {
					console.error('Error loading user default billing settings:', error)
					// Don't show error toast, just continue without defaults
				}
			}
		}

		loadUserDefaults()
	}, [editMode, user?.id])

	// Load existing billing settings when in edit mode
	useEffect(() => {
		const loadBillingSettings = async () => {
			if (editMode && initialData && user) {
				try {
					const billingSettings = await getClientBillingSettings(user.id, initialData.id)

					if (billingSettings) {
						const amountString = billingSettings.billing_amount?.toString() || ''
						const vatRate = (billingSettings as any).vat_rate_percent

						setFormData((prev) => ({
							...prev,
							shouldBill: true,
							billingAmount: amountString,
							billingType: (billingSettings as any).billing_type || 'in-advance',
							paymentEmailLeadHours:
								(billingSettings as any).payment_email_lead_hours != null
									? String((billingSettings as any).payment_email_lead_hours)
									: '0',
							applyVat: vatRate != null && vatRate > 0
						}))
						defaultsAppliedRef.current = true // Mark as applied so we don't overwrite
					}
				} catch (error) {
					console.error('Error loading billing settings:', error)
					// Don't show error toast, just continue without billing data
				}
			}
		}

		loadBillingSettings()
	}, [editMode, initialData, user])

	// Apply defaults when billing section is opened (for create mode only)
	useEffect(() => {
		if (!editMode && formData.shouldBill && userDefaults && !defaultsAppliedRef.current) {
			setFormData((prev) => ({
				...prev,
				billingAmount: userDefaults.billingAmount,
				billingType: userDefaults.billingType,
				paymentEmailLeadHours: userDefaults.paymentEmailLeadHours,
				applyVat: userDefaults.applyVat
			}))
			defaultsAppliedRef.current = true
		}
	}, [formData.shouldBill, userDefaults, editMode])

	const submitForm = useCallback(async () => {
		setLoading(true)
		if (onLoadingChange) onLoadingChange(true)
		try {
			if (!user) throw new Error('Not authenticated')

			// Re-check duplicate quickly on submit to be safe
			let shouldConfirmDuplicate = false
			try {
				const emailToCheck = (formData.email || '').trim()
				if (emailToCheck && !editMode) {
					setCheckingDuplicate(true)
					const { exists } = await clientEmailExists(user.id, emailToCheck, undefined)
					setDuplicateExists(Boolean(exists))
					shouldConfirmDuplicate = Boolean(exists)
				}
			} catch {
				// do nothing; advisory only
			} finally {
				setCheckingDuplicate(false)
			}

			if (shouldConfirmDuplicate && !confirmingDuplicate) {
				setConfirmingDuplicate(true)
				return
			}

			// Prepare client data for upsert (include ID for edit mode)
			const clientPayload: UpsertClientPayload = {
				...(editMode && initialData?.id ? { id: initialData.id } : {}), // Include ID only in edit mode
				user_id: user.id,
				name: formData.name,
				last_name: formData.lastName || null,
				email: formData.email,
				description: formData.description || null,
				phone: formData.phone || null,
				national_id: formData.nationalId || null,
				date_of_birth: formatDateForDatabase(formData.dateOfBirth),
				address: formData.address || null
			}

			// Prepare billing data if billing is enabled
			let billingPayload: UpsertBillingPayload | undefined

			if (formData.shouldBill) {
				billingPayload = {
					billing_amount: formData.billingAmount ? parseFloat(formData.billingAmount) : null,
					billing_type: formData.billingType,
					currency: 'EUR', // Default currency
					payment_email_lead_hours:
						formData.paymentEmailLeadHours !== '' ? parseInt(formData.paymentEmailLeadHours, 10) : null,
					vat_rate_percent: formData.applyVat ? 21.0 : null
				}
			}

			// Upsert client with optional billing settings (works for both create and update)
			await upsertClientWithBilling(clientPayload, billingPayload)

			// Try to retrieve the created/updated client so caller can auto-select it
			let createdClient: Client | undefined = undefined
			try {
				const list = await getClientsForUser(user.id)
				createdClient = (list as Client[]).find((c) => c.email?.toLowerCase() === formData.email.toLowerCase())
			} catch {}

			// Reset form only in create mode (in edit mode, keep the form populated)
			if (!editMode) {
				setFormData({
					name: '',
					lastName: '',
					email: '',
					description: '',
					phone: '',
					nationalId: '',
					dateOfBirth: '',
					address: '',
					shouldBill: false,
					billingAmount: '',
					paymentEmailLeadHours: '0',
					billingType: 'in-advance',
					applyVat: false
				})
				defaultsAppliedRef.current = false // Reset so defaults can be applied again for next client
			}

			onSuccess(createdClient)

			// Context-aware success message
			toast({
				title: editMode ? 'Paciente actualizado correctamente' : 'Paciente creado correctamente',
				description: editMode
					? 'Los datos del paciente han sido actualizados.'
					: 'El paciente ha sido añadido a tu lista.',
				variant: 'default',
				color: 'success'
			})
		} catch (error) {
			console.error(`Error ${editMode ? 'updating' : 'creating'} client:`, error)
			toast({
				title: editMode ? 'Error al actualizar paciente' : 'Error al crear paciente',
				description: editMode
					? 'No se pudieron actualizar los datos del paciente. Inténtalo de nuevo.'
					: 'No se pudo crear el paciente. Inténtalo de nuevo.',
				variant: 'destructive'
			})
		} finally {
			setLoading(false)
			if (onLoadingChange) onLoadingChange(false)
		}
	}, [user, formData, onSuccess, onLoadingChange, toast, editMode, initialData, confirmingDuplicate])

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
		if (field === 'email') {
			// Reset duplicate state while the user edits the email
			setDuplicateExists(false)
			setExistingClientId(null)
		}
	}

	const isValidEmail = useCallback((value: string) => {
		const v = value.trim()
		if (!v) return false
		// Simple validity check; avoids false positives without overfitting
		return /.+@.+\..+/.test(v)
	}, [])

	const checkDuplicateEmailValue = useCallback(
		async (emailValue: string) => {
			if (!user) return
			const email = (emailValue || '').trim()
			if (!email) {
				setDuplicateExists(false)
				setExistingClientId(null)
				return
			}

			// In edit mode, only check duplicates if the email actually changed
			if (isEditing && !emailChanged) {
				setDuplicateExists(false)
				setExistingClientId(null)
				return
			}

			const requestId = ++lastRequestIdRef.current
			try {
				setCheckingDuplicate(true)
				const { exists, existingClientId } = await clientEmailExists(
					user.id,
					email,
					editMode && initialData?.id ? initialData.id : undefined
				)
				if (requestId !== lastRequestIdRef.current) return
				setDuplicateExists(Boolean(exists))
				setExistingClientId(existingClientId ?? null)
			} catch {
				if (requestId !== lastRequestIdRef.current) return
				setDuplicateExists(false)
				setExistingClientId(null)
			} finally {
				if (requestId === lastRequestIdRef.current) {
					setCheckingDuplicate(false)
				}
			}
		},
		[user, editMode, initialData, isEditing, emailChanged]
	)

	const checkDuplicateEmail = useCallback(async () => {
		if (isEditing && !emailChanged) return
		await checkDuplicateEmailValue(formData.email)
	}, [checkDuplicateEmailValue, formData.email, isEditing, emailChanged])

	// Debounced duplicate check on email input changes
	useEffect(() => {
		if (emailDebounceRef.current) {
			clearTimeout(emailDebounceRef.current)
			emailDebounceRef.current = null
		}
		const currentEmailLocal = formData.email
		if (!isValidEmail(currentEmailLocal)) {
			// Reset when invalid / empty
			setDuplicateExists(false)
			setExistingClientId(null)
			return
		}

		// In edit mode, only check if email actually changed
		if (isEditing && !emailChanged) {
			setDuplicateExists(false)
			setExistingClientId(null)
			return
		}

		emailDebounceRef.current = setTimeout(() => {
			checkDuplicateEmailValue(currentEmailLocal)
		}, 600)
		return () => {
			if (emailDebounceRef.current) {
				clearTimeout(emailDebounceRef.current)
				emailDebounceRef.current = null
			}
		}
	}, [formData.email, isValidEmail, checkDuplicateEmailValue, isEditing, emailChanged])

	return (
		<form onSubmit={handleSubmit} className="mt-6">
			{/* Basic Information */}
			<div className="space-y-6">
				<div className="space-y-2">
					<Label htmlFor="name">Nombre</Label>
					<Input
						id="name"
						value={formData.name}
						onChange={(e) => handleInputChange('name', e.target.value)}
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
						onChange={(e) => handleInputChange('lastName', e.target.value)}
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
						onChange={(e) => handleInputChange('email', e.target.value)}
						onBlur={checkDuplicateEmail}
						placeholder="paciente@ejemplo.com"
						className="h-12"
						required
					/>
					{checkingDuplicate && (
						<div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
							<Spinner size="sm" color="dark" />
							<span>Comprobando duplicados…</span>
						</div>
					)}
					{!checkingDuplicate && duplicateExists && emailChanged && (
						<div className="text-xs text-red-700 font-medium mt-1 ml-1">
							Ya existe un paciente con este email.
						</div>
					)}
				</div>
			</div>

			{/* Notes Section */}
			<div className="space-y-4 mt-6">
				<CollapsibleSection
					title="Notas opcionales"
					defaultOpen={false}
					className="pt-2"
					contentClassName="space-y-4 pt-4 pb-4"
					showBackground={true}
				>
					<div className="space-y-2">
						<Label htmlFor="description">Notas</Label>
						<Textarea
							id="description"
							value={formData.description}
							onChange={(e) => handleInputChange('description', e.target.value)}
							placeholder="Cualquier información relevante que quieras recordar."
							className="min-h-12"
							rows={3}
						/>
					</div>
				</CollapsibleSection>
			</div>

			{/* Additional Fields */}
			<div className="space-y-4">
				<CollapsibleSection
					title="Campos adicionales"
					defaultOpen={false}
					className="pt-2"
					contentClassName="space-y-4 pt-4 pb-4"
					showBackground={true}
				>
					<div className="space-y-2">
						<Label htmlFor="phone">Teléfono</Label>
						<Input
							id="phone"
							type="tel"
							value={formData.phone}
							onChange={(e) => handleInputChange('phone', e.target.value)}
							placeholder="+34 123 456 789"
							className="h-12"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="nationalId">DNI</Label>
						<Input
							id="nationalId"
							value={formData.nationalId}
							onChange={(e) => handleInputChange('nationalId', e.target.value)}
							placeholder="12345678A"
							className="h-12"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="dateOfBirth">Fecha de nacimiento</Label>
						<Input
							id="dateOfBirth"
							type="text"
							value={formData.dateOfBirth}
							onChange={(e) => {
								const formatted = formatDateInput(e.target.value)
								handleInputChange('dateOfBirth', formatted)
							}}
							placeholder="DD/MM/YYYY"
							className="h-12"
							maxLength={10}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="address">Dirección</Label>
						<Textarea
							id="address"
							value={formData.address}
							onChange={(e) => handleInputChange('address', e.target.value)}
							placeholder="Calle, número, ciudad, código postal"
							className="min-h-12"
							rows={3}
						/>
					</div>
				</CollapsibleSection>
			</div>

			{/* Billing Configuration */}
			<div className="space-y-4">
				<CollapsibleSection
					title="Condiciones de facturación"
					open={formData.shouldBill}
					onOpenChange={(open) => handleInputChange('shouldBill', open)}
					className="pt-2"
					contentClassName="space-y-2 pt-4"
					showBackground={true}
				>
					<div>
						<label htmlFor="billingAmount" className="block text-md font-medium text-gray-700">
							Precio de la consulta
						</label>
						<p className="text-sm text-gray-500 mb-2">Honorarios a aplicar por defecto en tus consultas.</p>
					</div>
					<div className="relative">
						<Input
							id="billingAmount"
							type="number"
							step="0.01"
							min={1}
							value={formData.billingAmount}
							onChange={(e) => {
								handleInputChange('billingAmount', e.target.value)
								handleInputChange('shouldBill', true)
							}}
							onBlur={(e) => {
								const v = e.target.value
								if (!v) return
								const n = parseFloat(v)
								if (!isNaN(n) && n < 1) {
									handleInputChange('billingAmount', '1')
								}
							}}
							placeholder="0.00"
							className="pr-8 h-12"
						/>
						<span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">€</span>
					</div>

					{/* Per-patient email timing */}
					<div className="space-y-2 pt-4">
						<div>
							<label className="block text-md font-medium text-gray-700">
								Cuándo enviar el email de pago
							</label>
							<p className="text-sm text-gray-500 mb-2">Solo para este paciente.</p>
						</div>
						{(() => {
							const timingValue =
								(formData.billingType === 'monthly' ? 'monthly' : formData.paymentEmailLeadHours) || '0'
							return (
								<Select
									value={timingValue}
									onValueChange={(val) => {
										handleInputChange('shouldBill', true)
										if (val === 'monthly') {
											setFormData((prev) => ({
												...prev,
												billingType: 'monthly',
												paymentEmailLeadHours: ''
											}))
										} else {
											setFormData((prev) => ({
												...prev,
												paymentEmailLeadHours: val,
												billingType: val === '-1' ? 'right-after' : 'in-advance'
											}))
										}
									}}
								>
									<SelectTrigger className="h-12">
										<SelectValue placeholder="Selecciona cuándo enviar el email" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="0">Inmediatamente</SelectItem>
										<SelectItem value="24">24 horas antes</SelectItem>
										<SelectItem value="72">72 horas antes</SelectItem>
										<SelectItem value="168">1 semana antes</SelectItem>
										<SelectItem value="-1">Después de la consulta</SelectItem>
										<SelectItem value="monthly">Mensualmente</SelectItem>
									</SelectContent>
								</Select>
							)
						})()}
					</div>

					{/* VAT Checkbox */}
					<div className="space-y-1 pt-6">
						<div className="flex items-center space-x-2">
							<Checkbox
								id="applyVat"
								checked={formData.applyVat}
								className="h-4 w-4"
								onCheckedChange={(checked) => {
									handleInputChange('applyVat', checked === true)
									handleInputChange('shouldBill', true)
								}}
							/>
							<Label
								htmlFor="applyVat"
								className="text-sm text-gray-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
							>
								Aplicar IVA
							</Label>
						</div>
						{formData.applyVat && (
							<p className="text-xs text-gray-500 ml-6">
								Se aplicará automáticamente el IVA del 21% a todas las facturas que se generen para este
								paciente.
							</p>
						)}
					</div>
				</CollapsibleSection>
			</div>
			{/* Actions */}
			{!hideSubmitButton && (
				<div className="flex flex-col space-y-3 pt-6">
					{confirmingDuplicate && !editMode && (
						<div className="text-sm text-yellow-800 bg-yellow-100 border border-yellow-200 rounded px-3 py-2">
							Ya existe un paciente con este email. ¿Crear de todos modos?
						</div>
					)}
					<Button type="submit" variant="default" disabled={loading} className="w-full text-md font-medium">
						{loading
							? editMode
								? 'Guardando...'
								: 'Creando...'
							: editMode
								? 'Guardar cambios'
								: confirmingDuplicate
									? 'Confirmar duplicado'
									: 'Añadir paciente'}
					</Button>
					{onCancel && !hideCancelButton && (
						<Button
							type="button"
							variant="ghost"
							onClick={() => {
								if (confirmingDuplicate) {
									setConfirmingDuplicate(false)
									return
								}
								onCancel()
							}}
							className="w-full text-md font-medium text-gray-600 hover:text-gray-800"
						>
							{confirmingDuplicate ? 'Cancelar' : 'Cancelar'}
						</Button>
					)}
				</div>
			)}
		</form>
	)
}
