import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'

export interface BillingPreferences {
	billingType: 'in-advance' | 'right-after' | 'monthly'
	billingAmount: string
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
							htmlFor="billingType"
							className="block text-md font-medium text-gray-700"
						>
							Tipo de facturación
						</label>
						<p className="text-sm text-gray-500 mb-2">
							Selecciona cuándo quieres facturar a tus pacientes.
						</p>
					</div>
					<Select
						value={values.billingType}
						onValueChange={(value) => {
							// Only allow selection of available billing types
							if (isBillingTypeAvailable(value)) {
								handleInputChange('billingType', value as any)
							}
						}}
						disabled={disabled}
					>
						<SelectTrigger className="h-12">
							<SelectValue placeholder="Selecciona tipo de facturación" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem
								value="in-advance"
								className={`${
									isBillingTypeAvailable('in-advance')
										? 'hover:bg-gray-100 cursor-pointer'
										: 'opacity-50 cursor-not-allowed'
								}`}
							>
								Por Adelantado{' '}
								<span className="text-xs text-gray-500">
									- El pago se solicita al reservar la cita
								</span>
							</SelectItem>
							<SelectItem
								value="right-after"
								className={`${
									isBillingTypeAvailable('right-after')
										? 'hover:bg-gray-100 cursor-pointer'
										: 'opacity-50 cursor-not-allowed'
								}`}
							>
								Después de la Consulta{' '}
								<span className="text-xs text-gray-500">
									- Enviar factura automáticamente tras la
									consulta
								</span>
								{!isBillingTypeAvailable('right-after') && (
									<span className="text-xs text-black font-medium ml-1">
										(Próximamente)
									</span>
								)}
							</SelectItem>
							<SelectItem
								value="monthly"
								className={`${
									isBillingTypeAvailable('monthly')
										? 'hover:bg-gray-100 cursor-pointer'
										: 'opacity-50 cursor-not-allowed'
								}`}
							>
								Mensual{' '}
								<span className="text-xs text-gray-500">
									- Enviar una factura a final de mes
								</span>
								{!isBillingTypeAvailable('monthly') && (
									<span className="text-xs text-black font-medium ml-1">
										(Próximamente)
									</span>
								)}
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	)
}
