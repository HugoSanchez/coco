'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { formatSpanishDateTimeExact } from '@/lib/dates/format'
import { FaCheckCircle } from 'react-icons/fa'

interface CancelState {
	loading: boolean
	error: string | null
	username: string | null
	practitionerName: string | null
	startIso: string | null
	status: string | null
	submitting: boolean
	done: boolean
}

export default function CancellationPage() {
	const { id } = useParams()
	const params = useSearchParams()
	const sig = params.get('sig') || ''

	const [state, setState] = useState<CancelState>({
		loading: true,
		error: null,
		username: null,
		practitionerName: null,
		startIso: null,
		status: null,
		submitting: false,
		done: false
	})

	useEffect(() => {
		async function load() {
			try {
				// Reuse context endpoint with action=cancel
				const res = await fetch(
					`/api/public/bookings/${id}/context?sig=${encodeURIComponent(sig)}&action=cancel`
				)
				if (!res.ok) {
					const payload = await res.json().catch(() => ({}))
					throw new Error(payload?.error || 'invalid_link')
				}
				const ctx = await res.json()

				// Optionally get practitioner name (lightweight: username page fetch)
				let practitionerName: string | null = null
				if (ctx?.username) {
					try {
						const p = await fetch(`/api/public/profile?username=${ctx.username}`)
						if (p.ok) {
							const data = await p.json()
							practitionerName = data?.name || null
						}
					} catch {}
				}

				setState((prev) => ({
					...prev,
					loading: false,
					username: ctx?.username || null,
					startIso: ctx?.currentStart || null,
					status: ctx?.status || null,
					practitionerName
				}))
			} catch (e) {
				setState((prev) => ({ ...prev, loading: false, error: 'Enlace no válido o caducado.' }))
			}
		}
		load()
	}, [id, sig])

	const onCancel = async () => {
		setState((p) => ({ ...p, submitting: true }))
		try {
			const res = await fetch(`/api/public/bookings/${id}/cancel`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sig })
			})
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}))
				throw new Error(payload?.error || 'No se pudo cancelar la cita.')
			}
			setState((p) => ({ ...p, done: true, status: 'canceled' }))
		} catch (e) {
			setState((p) => ({ ...p, error: e instanceof Error ? e.message : 'Error desconocido' }))
		} finally {
			setState((p) => ({ ...p, submitting: false }))
		}
	}

	if (state.loading) {
		return (
			<div className="container flex justify-center items-center min-h-screen">
				<Spinner size="sm" color="dark" />
			</div>
		)
	}

	if (state.error) {
		return (
			<div className="container flex justify-center items-center min-h-screen">
				<div className="text-center text-gray-700">{state.error}</div>
			</div>
		)
	}

	if (state.done || state.status === 'canceled') {
		return (
			<div className="container flex justify-center px-6 py-20 min-h-screen">
				<div className="md:max-w-[30vw] w-full overflow-visible">
					<div className="space-y-4 p-4 mt-16 flex flex-col items-center h-full">
						<FaCheckCircle className="text-teal-400 text-4xl" />
						<h2 className="text-2xl font-bold">Cita cancelada</h2>
						<p className="text-center text-xs">Puedes cerrar esta página.</p>
					</div>
				</div>
			</div>
		)
	}

	const readable = state.startIso ? formatSpanishDateTimeExact(new Date(state.startIso)) : ''

	return (
		<div className="container flex justify-center px-6 py-20 min-h-screen">
			<div className="md:max-w-[30vw] w-full overflow-visible">
				<div className="flex flex-col space-y-10">
					<h2 className="text-xl font-semibold">Cancelar cita</h2>
					<p className="text-gray-700">
						Cita {state.practitionerName ? `con ${state.practitionerName} ` : ''}
						el {readable}.{' '}
						<span className="font-bold text-gray-800">¿Estás seguro de que quieres cancelarla?</span>
					</p>
					<Button onClick={onCancel} disabled={state.submitting} className="w-full h-12">
						{state.submitting ? (
							<span className="flex items-center justify-center gap-2">
								<Spinner size="sm" color="light" />
								Cancelando...
							</span>
						) : (
							'Cancelar'
						)}
					</Button>
				</div>
			</div>
		</div>
	)
}
