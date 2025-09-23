import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { Info } from 'lucide-react'

export interface BillingPreferences {
	billingType: 'in-advance' | 'right-after' | 'monthly'
	billingAmount: string
	firstConsultationAmount?: string
	/**
	 * When to send the payment email for in-advance billing.
	 * Values are hours relative to start_time: '0' (immediately), '24', '72', '168', or '-1' (after consultation).
	 */
	paymentEmailLeadHours?: string
}

// Define which billing types are currently available
const AVAILABLE_BILLING_TYPES = ['in-advance'] as const

interface BillingPreferencesFormProps {
	values: BillingPreferences
	onChange: (values: BillingPreferences) => void
	disabled?: boolean
}

export function BillingPreferencesForm({
	values,
	onChange,
	disabled
}: BillingPreferencesFormProps) {
	// Helper function to check if a billing type is currently available
	const isBillingTypeAvailable = (billingType: string) => {
		return AVAILABLE_BILLING_TYPES.includes(billingType as any)
	}
	const handleInputChange = (
		field: keyof BillingPreferences,
		value: string
	) => {
		onChange({ ...values, [field]: value })
	}

	// Human-readable description for when the payment email will be sent
	const getPaymentTimingText = (): string => {
		const lead = values.paymentEmailLeadHours ?? '0'
		if (lead === '-1') return 'pocos minutos después de la cita.'
		if (lead === '0' || lead === '')
			return 'inmediatamente al crear la cita.'
		if (lead === '168') return '7 días antes de la cita.'
		return `${lead} horas antes de la cita.`
	}

	return (
		<div className="space-y-6 mt-6">
			<div className="space-y-4">
				<div className="space-y-2">
					<div>
						<label
							htmlFor="billingAmount"
							className="block text-md font-medium text-gray-700"
						>
							Precio de la consulta
						</label>
						<p className="text-sm text-gray-500 mb-2">
							Honorarios a aplicar por defecto en tus consultas.
						</p>
					</div>
					<div className="relative">
						<Input
							id="billingAmount"
							type="number"
							step="0.01"
							min={1}
							value={values.billingAmount}
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
				<div className="space-y-2">
					<div>
						<label
							htmlFor="firstConsultationAmount"
							className="block text-md font-medium text-gray-700"
						>
							Precio primera consulta (opcional)
						</label>
						<p className="text-sm text-gray-500 mb-2">
							Si lo dejas vacío, se usará el precio habitual.
						</p>
					</div>
					<div className="relative">
						<Input
							id="firstConsultationAmount"
							type="number"
							step="0.01"
							min={0}
							value={values.firstConsultationAmount || ''}
							onChange={(e) =>
								handleInputChange(
									'firstConsultationAmount',
									e.target.value
								)
							}
							className="pr-8 h-12"
							disabled={disabled}
						/>
						<span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
							€
						</span>
					</div>
				</div>
				<div className="space-y-2">
					<div>
						<label
							htmlFor="paymentEmailLeadHours"
							className="block text-md font-medium text-gray-700"
						>
							Cuándo enviar el email de pago
						</label>
						<p className="text-sm text-gray-500 mb-2">
							Aplica a nuevas citas con facturación por
							adelantado.
						</p>
					</div>
					<Select
						value={values.paymentEmailLeadHours ?? '0'}
						onValueChange={(value) =>
							handleInputChange('paymentEmailLeadHours', value)
						}
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
							<SelectItem value="-1">
								Después de la consulta
							</SelectItem>
						</SelectContent>
					</Select>
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
