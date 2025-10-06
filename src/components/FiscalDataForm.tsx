'use client'

import { useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { updateFiscalData } from '@/lib/db/profiles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface FiscalDataFormProps {
	onSaved?: () => void
}

export default function FiscalDataForm({ onSaved }: FiscalDataFormProps) {
	const { user, profile, refreshProfile } = useUser()
	const [saving, setSaving] = useState(false)
	const [form, setForm] = useState({
		tax_id: profile?.tax_id || '',
		fiscal_address_line1: profile?.fiscal_address_line1 || '',
		fiscal_address_line2: profile?.fiscal_address_line2 || '',
		fiscal_city: profile?.fiscal_city || '',
		fiscal_province: profile?.fiscal_province || '',
		fiscal_postal_code: profile?.fiscal_postal_code || '',
		fiscal_country: profile?.fiscal_country || 'ES'
	})

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target
		setForm((f) => ({ ...f, [name]: value }))
	}

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!user) return
		setSaving(true)
		try {
			await updateFiscalData(user.id, {
				tax_id: form.tax_id.trim(),
				fiscal_address_line1: form.fiscal_address_line1.trim(),
				fiscal_address_line2: form.fiscal_address_line2.trim() || null,
				fiscal_city: form.fiscal_city.trim(),
				fiscal_province: form.fiscal_province.trim(),
				fiscal_postal_code: form.fiscal_postal_code.trim(),
				fiscal_country: form.fiscal_country.trim() || 'ES'
			})
			await refreshProfile()
			onSaved?.()
		} finally {
			setSaving(false)
		}
	}

	return (
		<form onSubmit={onSubmit} className="space-y-6">
			<div>
				<h2 className="text-2xl font-bold">{'Datos fiscales'}</h2>
				<p className="text-md text-gray-500 my-1">{'Recogemos estos datos para aplicarlos a tus facturas.'}</p>
			</div>
			<div>
				<label className="block text-md font-medium text-gray-700 mb-2">DNI / NIF</label>
				<Input
					name="tax_id"
					value={form.tax_id}
					onChange={onChange}
					className="autofill:bg-white transition-none text-gray-700"
					placeholder="12345678X"
					required
				/>
			</div>
			<div>
				<label className="block text-md font-medium text-gray-700 mb-2">Dirección</label>
				<Input
					name="fiscal_address_line1"
					value={form.fiscal_address_line1}
					onChange={onChange}
					className="autofill:bg-white transition-none text-gray-700"
					placeholder="Calle Ejemplo 123"
					required
				/>
			</div>
			<div>
				<label className="block text-md font-medium text-gray-700 mb-2">
					Información adicional{' '}
					<span className="text-sm text-gray-500 font-normal">(opcional: piso, puerta, etc.)</span>
				</label>
				<Input
					name="fiscal_address_line2"
					value={form.fiscal_address_line2}
					onChange={onChange}
					className="autofill:bg-white transition-none text-gray-700"
					placeholder="Piso 2ºB"
				/>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<label className="block text-md font-medium text-gray-700 mb-2">Ciudad</label>
					<Input
						name="fiscal_city"
						value={form.fiscal_city}
						onChange={onChange}
						className="autofill:bg-white transition-none text-gray-700"
						required
					/>
				</div>
				<div>
					<label className="block text-md font-medium text-gray-700 mb-2">Provincia</label>
					<Input
						name="fiscal_province"
						value={form.fiscal_province}
						onChange={onChange}
						className="autofill:bg-white transition-none text-gray-700"
						required
					/>
				</div>
				<div>
					<label className="block text-md font-medium text-gray-700 mb-2">Código postal</label>
					<Input
						name="fiscal_postal_code"
						value={form.fiscal_postal_code}
						onChange={onChange}
						className="autofill:bg-white transition-none text-gray-700"
						required
					/>
				</div>
			</div>
			<div>
				<label className="block text-md font-medium text-gray-700 mb-2">País</label>
				<Input
					name="fiscal_country"
					value={form.fiscal_country}
					onChange={onChange}
					className="autofill:bg-white transition-none text-gray-700"
					placeholder="ES"
					required
				/>
			</div>
			<div className="pt-2">
				<Button type="submit" variant="default" disabled={saving} className="h-12 w-full shadow-sm text-md">
					{saving ? 'Guardando…' : 'Guardar'}
				</Button>
			</div>
		</form>
	)
}
