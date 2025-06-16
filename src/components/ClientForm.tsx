"use client"

import { useState } from 'react'
import { X, DollarSign, User, Mail, FileText, ChevronRight, ChevronDown, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useUser } from '@/contexts/UserContext'
import { createClient } from '@/lib/db/clients'

interface ClientFormProps {
  isOpen: boolean
  onClose: () => void
  onClientCreated: () => void
}

export function ClientForm({ isOpen, onClose, onClientCreated }: ClientFormProps) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!user) {
        throw new Error('Not authenticated')
      }

      const payload = {
        user_id: user.id,
        name: formData.name,
        email: formData.email,
        description: formData.description || null,
        should_bill: formData.shouldBill,
        billing_amount: formData.billingAmount ? parseFloat(formData.billingAmount) : null,
        billing_type: formData.billingType || null,
        billing_frequency: formData.billingFrequency || null,
        billing_trigger: formData.billingTrigger || null,
        billing_advance_days: formData.billingAdvanceDays ? parseInt(formData.billingAdvanceDays) : 0
      }

      await createClient(payload)

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

      onClientCreated()
    } catch (error) {
      console.error('Error creating client:', error)
      alert(error instanceof Error ? error.message : 'Failed to create client')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-1/3 overflow-y-auto p-8 bg-gray-50 [&>button]:hidden">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-2xl font-bold">
            Añade un nuevo paciente
          </SheetTitle>
		  <SheetDescription>
			Crea un nuevo paciente y configura las preferencias de facturación.
		  </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
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
                onChange={(e) => handleInputChange('email', e.target.value)}
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
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Cualquier información relevante que quieras recordar."
                className="min-h-12"
                rows={3}
              />
            </div>
          </div>

          {/* Billing Configuration */}
          <div className="space-y-4">
            <div
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded-md transition-colors"
              onClick={() => handleInputChange('shouldBill', !formData.shouldBill)}
            >
              {formData.shouldBill ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )}
              <h3 className="text-lg font-medium">
                Opciones de facturación
              </h3>
            </div>

            {formData.shouldBill && (
              <div className="space-y-4 pl-6 border-l-2 border-gray-100">
                <div className="space-y-2">
                  <Label htmlFor="billingAmount">Cantidad</Label>
                  <div className="relative">
                    <Input
                      id="billingAmount"
                      type="number"
                      step="0.01"
                      value={formData.billingAmount}
                      onChange={(e) => handleInputChange('billingAmount', e.target.value)}
                      placeholder="0.00"
                      className="pr-8 h-12"
                    />
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
                      €
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billingType">Tipo de facturación</Label>
                  <Select value={formData.billingType} onValueChange={(value) => handleInputChange('billingType', value)}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation_based">Por Consulta</SelectItem>
                      <SelectItem value="recurring">Recurrente (Mensual o Semanal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.billingType === 'recurring' && (
                  <div className="space-y-2">
                    <Label htmlFor="billingFrequency">Frequency</Label>
                    <Select value={formData.billingFrequency} onValueChange={(value) => handleInputChange('billingFrequency', value)}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Choose frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.billingType === 'consultation_based' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="billingTrigger">Cuándo enviar la factura</Label>
                      <Select value={formData.billingTrigger} onValueChange={(value) => handleInputChange('billingTrigger', value)}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Selecciona un timing" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="after_consultation">Después de la consulta (24h)</SelectItem>
                          <SelectItem value="before_consultation">Antes de la consulta (días antes)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.billingTrigger === 'before_consultation' && (
                      <div className="space-y-2">
                        <Label htmlFor="billingAdvanceDays">Días de antelación</Label>
                        <Input
                          id="billingAdvanceDays"
                          type="number"
                          min="1"
                          value={formData.billingAdvanceDays}
                          onChange={(e) => handleInputChange('billingAdvanceDays', e.target.value)}
                          placeholder="3"
                          className="h-12"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6">
            <Button type="submit" disabled={loading} className="flex-1 text-md font-medium">
              <UserPlus className="h-4 w-4 mr-2" />
              {loading ? 'Guardando...' : 'Añadir'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
