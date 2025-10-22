import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Info } from 'lucide-react'

export interface BillingPreferences {
	billingType: 'in-advance' | 'right-after' | 'monthly'
	billingAmount: string
	firstConsultationAmount?: string
	meetingDurationMin?: string
	firstMeetingDurationMin?: string
	/**
	 * When to send the payment email for in-advance billing.
	 * Values are hours relative to start_time: '0' (immediately), '24', '72', '168', or '-1' (after consultation).
	 * For monthly billing, this field is ignored.
	 */
	paymentEmailLeadHours?: string
}

// Legacy helper kept for compatibility (no longer rendered as a separate selector)
const AVAILABLE_BILLING_TYPES = ['in-advance', 'right-after', 'monthly'] as const

interface BillingPreferencesFormProps {
	values: BillingPreferences
	onChange: (values: BillingPreferences) => void
	disabled?: boolean
}

export function BillingPreferencesForm({ values, onChange, disabled }: BillingPreferencesFormProps) {
	// Helper function to check if a billing type is currently available
	const isBillingTypeAvailable = (billingType: string) => {
		return AVAILABLE_BILLING_TYPES.includes(billingType as any)
	}
	const handleInputChange = (field: keyof BillingPreferences, value: string) => {
		onChange({ ...values, [field]: value })
	}

	// Human-readable description for when the payment email will be sent
	const getPaymentTimingText = (): string => {
		if (values.billingType === 'monthly') return 'de forma consolidada el primer día de cada mes.'
		const lead = values.paymentEmailLeadHours ?? '0'
		if (lead === '-1') return 'pocos minutos después de la cita.'
		if (lead === '0' || lead === '') return 'inmediatamente al crear la cita.'
		if (lead === '168') return '7 días antes de la cita.'
		return `${lead} horas antes de la cita.`
	}

	return (
		<div className="space-y-6 mt-6">
			<div className="space-y-4">
				{/* Normal price + duration in one row */}
				<div className="space-y-2">
					<label className="block text-md font-medium text-gray-700">Precio y duración de la consulta</label>
					<p className="text-sm text-gray-500 mb-2">
						Configura el precio por defecto y la duración en minutos de tus consultas.
					</p>
					<div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
						{/* Price 75% (3/4) */}
						<div className="md:col-span-3">
							<div className="relative">
								<Input
									id="billingAmount"
									type="number"
									step="0.01"
									min={1}
									value={values.billingAmount}
									onChange={(e) => handleInputChange('billingAmount', e.target.value)}
									onBlur={(e) => {
										const v = e.target.value
										if (!v) return
										const n = parseFloat(v)
										if (!isNaN(n) && n < 1) {
											handleInputChange('billingAmount', '1')
										}
									}}
									className="pr-8 h-12"
									disabled={disabled}
								/>
								<span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
									€
								</span>
							</div>
						</div>
						{/* Duration 25% (1/4) */}
						<div className="md:col-span-1">
							<div className="relative">
								<Input
									id="meetingDurationMin"
									type="number"
									inputMode="numeric"
									pattern="[0-9]*"
									min={5}
									max={240}
									step={5}
									/* presets removed to avoid showing native dropdown */
									placeholder="p. ej. 50"
									value={values.meetingDurationMin || ''}
									onKeyDown={(e) => {
										if (['e', 'E', '+', '-', '.', '/'].includes(e.key)) e.preventDefault()
									}}
									onChange={(e) =>
										handleInputChange('meetingDurationMin', e.target.value.replace(/\D/g, ''))
									}
									onBlur={(e) => {
										const n = parseInt(e.target.value, 10)
										if (Number.isNaN(n)) return handleInputChange('meetingDurationMin', '')
										handleInputChange('meetingDurationMin', String(Math.min(240, Math.max(5, n))))
									}}
									className="h-12 pr-12 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:pointer-events-none"
									disabled={disabled}
								/>
								<span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
									min
								</span>
								{/* datalist removed intentionally */}
							</div>
						</div>
					</div>
				</div>

				{/* First price + duration in one row */}
				<div className="space-y-2">
					<label className="block text-md font-medium text-gray-700">
						Precio y duración de la primera consulta (opcional)
					</label>
					<p className="text-sm text-gray-500 mb-2">
						Esto es opcional y solo en el caso de que quieras tener un precio especificio para tus primeras
						consultas.
					</p>
					<div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
						{/* First price 75% */}
						<div className="md:col-span-3">
							<div className="relative">
								<Input
									id="firstConsultationAmount"
									type="number"
									step="0.01"
									min={0}
									value={values.firstConsultationAmount || ''}
									onChange={(e) => handleInputChange('firstConsultationAmount', e.target.value)}
									className="pr-8 h-12"
									disabled={disabled}
								/>
								<span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
									€
								</span>
							</div>
						</div>
						{/* First duration 25% */}
						<div className="md:col-span-1">
							<div className="relative">
								<Input
									id="firstMeetingDurationMin"
									type="number"
									inputMode="numeric"
									pattern="[0-9]*"
									min={5}
									max={240}
									step={5}
									/* presets removed to avoid showing native dropdown */
									placeholder="0"
									value={values.firstMeetingDurationMin || ''}
									onKeyDown={(e) => {
										if (['e', 'E', '+', '-', '.', '/'].includes(e.key)) e.preventDefault()
									}}
									onChange={(e) =>
										handleInputChange('firstMeetingDurationMin', e.target.value.replace(/\D/g, ''))
									}
									onBlur={(e) => {
										const n = parseInt(e.target.value, 10)
										if (Number.isNaN(n)) return handleInputChange('firstMeetingDurationMin', '')
										handleInputChange(
											'firstMeetingDurationMin',
											String(Math.min(240, Math.max(5, n)))
										)
									}}
									className="h-12 pr-12 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
									disabled={disabled}
								/>
								<span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
									min
								</span>
							</div>
						</div>
					</div>
				</div>
				<div className="space-y-2">
					<div>
						<label htmlFor="paymentEmailLeadHours" className="block text-md font-medium text-gray-700">
							Cuándo enviar el email de pago
						</label>
						<p className="text-sm text-gray-500 mb-2">Selecciona cuándo facturar/envíar el cobro.</p>
					</div>
					{(() => {
						const timingValue =
							values.billingType === 'monthly' ? 'monthly' : (values.paymentEmailLeadHours ?? '0')
						return (
							<Select
								value={timingValue}
								onValueChange={(value) => {
									if (value === 'monthly') {
										onChange({
											...values,
											billingType: 'monthly',
											paymentEmailLeadHours: ''
										})
									} else {
										onChange({
											...values,
											paymentEmailLeadHours: value,
											billingType: value === '-1' ? 'right-after' : 'in-advance'
										})
									}
								}}
								disabled={disabled}
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
				<p className="text-sm text-gray-600 flex items-center gap-1">
					<Info className="h-4 w-4 text-teal-600" />
					<span>
						Tus pacientes recibirán un email para abonar la consulta{' '}
						<strong>{getPaymentTimingText()}</strong>
					</span>
				</p>
			</div>
		</div>
	)
}
