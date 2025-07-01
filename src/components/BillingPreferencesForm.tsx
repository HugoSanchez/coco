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
							value={values.billingAmount}
							onChange={(e) =>
								handleInputChange(
									'billingAmount',
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
						onValueChange={(value) =>
							handleInputChange('billingType', value as any)
						}
						disabled={disabled}
					>
						<SelectTrigger className="h-12">
							<SelectValue placeholder="Selecciona tipo de facturación" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem
								value="in-advance"
								className="hover:bg-gray-100"
							>
								Por Adelantado{' '}
								<span className="text-xs text-gray-500">
									- El pago se solicita al reservar la cita
								</span>
							</SelectItem>
							<SelectItem
								value="right-after"
								className="hover:bg-gray-100"
							>
								Después de la Consulta{' '}
								<span className="text-xs text-gray-500">
									- Enviar factura automáticamente tras la
									consulta
								</span>
							</SelectItem>
							<SelectItem
								value="monthly"
								className="hover:bg-gray-100"
							>
								Mensual{' '}
								<span className="text-xs text-gray-500">
									- Enviar una factura a final de mes
								</span>
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	)
}
