import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface BillingPreferences {
  shouldBill: boolean
  billingAmount: string
  billingType: string
  billingFrequency: string
  billingTrigger: string
  billingAdvanceDays: string
}

interface BillingPreferencesFormProps {
  values: BillingPreferences
  onChange: (values: BillingPreferences) => void
  disabled?: boolean
}

export function BillingPreferencesForm({ values, onChange, disabled }: BillingPreferencesFormProps) {
  const handleInputChange = (field: keyof BillingPreferences, value: string | boolean) => {
    onChange({ ...values, [field]: value })
  }

  // Handle the simplified recurrence selection
  const handleRecurrenceChange = (value: string) => {
    if (value === 'consultation_based') {
      onChange({ ...values, billingType: 'consultation_based', billingFrequency: '' })
    } else if (value === 'weekly') {
      onChange({ ...values, billingType: 'recurring', billingFrequency: 'weekly' })
    } else if (value === 'monthly') {
      onChange({ ...values, billingType: 'recurring', billingFrequency: 'monthly' })
    }
  }

  // Determine the current select value
  let recurrenceValue = '';
  if (values.billingType === 'recurring' && values.billingFrequency === 'weekly') {
    recurrenceValue = 'weekly';
  } else if (values.billingType === 'recurring' && values.billingFrequency === 'monthly') {
    recurrenceValue = 'monthly';
  } else if (values.billingType === 'consultation_based') {
    recurrenceValue = 'consultation_based';
  }

  return (
    <div className="space-y-6 mt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div>
                <label htmlFor="name" className="block text-md font-medium text-gray-700">Precio de la consulta</label>
                <p className='text-sm text-gray-500 mb-2'>Honorarios a aplicar por defecto en tus consultas.</p>
              </div>
              <div className="relative">
                <Input
                  id="billingAmount"
                  type="number"
                  step="0.01"
                  value={values.billingAmount}
                  onChange={(e) => handleInputChange('billingAmount', e.target.value)}
                  placeholder="0.00"
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
                <label htmlFor="name" className="block text-md font-medium text-gray-700">Recurrencia de facturación</label>
                <p className='text-sm text-gray-500 mb-2'>Selecciona la frecuencia con la que deseas facturar a tus pacientes.</p>
              </div>
              <Select value={recurrenceValue} onValueChange={handleRecurrenceChange} disabled={disabled}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecciona recurrencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation_based">Por Consulta <span className='text-xs text-gray-500'>- Enviar una factura antes o después de cada consulta</span></SelectItem>
                  <SelectItem value="weekly">Semanal <span className='text-xs text-gray-500'>- Enviar una factura a final de semana</span></SelectItem>
                  <SelectItem value="monthly">Mensual <span className='text-xs text-gray-500'>- Enviar una factura a final de mes</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Only show billingTrigger if consultation_based */}
            {recurrenceValue === 'consultation_based' && (
              <>
                <div className="space-y-2">
				<div>
					<label htmlFor="name" className="block text-md font-medium text-gray-700">Cuándo enviar la factura</label>
					<p className='text-sm text-gray-500 mb-2'>Selecciona si quieres que enviemos la factura antes o después de la consulta.</p>
				</div>
                  <Select value={values.billingTrigger} onValueChange={(value) => handleInputChange('billingTrigger', value)} disabled={disabled}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Selecciona un timing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="after_consultation">Después de la consulta <span className='text-xs text-gray-500'>- Enviaremos la factura hasta 24h después de la consulta</span></SelectItem>
                      <SelectItem value="before_consultation">Antes de la consulta<span className='text-xs text-gray-500'>- Enviaremos la factura unos días antes de la consulta</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {values.billingTrigger === 'before_consultation' && (
                  <div className="space-y-2">
                    <Label htmlFor="billingAdvanceDays">Días de antelación</Label>
                    <Input
                      id="billingAdvanceDays"
                      type="number"
                      min="1"
                      value={values.billingAdvanceDays}
                      onChange={(e) => handleInputChange('billingAdvanceDays', e.target.value)}
                      placeholder="3"
                      className="h-12"
                      disabled={disabled}
                    />
                  </div>
                )}
              </>
            )}
          </div>
    </div>
  )
}
