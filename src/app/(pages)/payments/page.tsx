'use client'

import { useCallback, useEffect, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table'

type PaymentRow = {
	paymentIntentId: string
	created: number
	amount: number
	currency: string
	paymentStatus: string
	bookingId?: string
	chargeId?: string
	net?: number
	fee?: number
	availableOn?: number
}

type PaymentsResponse = {
	rows: PaymentRow[]
	nextPage?: string | null
	hasMore?: boolean
}

function formatCurrencyMinor(amountMinor: number, currency: string) {
	const amount = amountMinor / 100
	try {
		return new Intl.NumberFormat('es-ES', {
			style: 'currency',
			currency: currency || 'EUR'
		}).format(amount)
	} catch {
		return `${amount.toFixed(2)} ${currency || 'EUR'}`
	}
}

function formatDate(ts: number) {
	return new Date(ts * 1000).toLocaleString('es-ES')
}

function statusBadgeVariant(status: string): string {
	switch (status) {
		case 'succeeded':
			return 'bg-teal-100 text-teal-800 border-teal-200'
		case 'processing':
			return 'bg-yellow-50 text-yellow-800 border-yellow-200'
		case 'requires_action':
		case 'requires_payment_method':
			return 'bg-orange-50 text-orange-800 border-orange-200'
		case 'canceled':
			return 'bg-gray-100 text-gray-700 border-gray-200'
		default:
			return 'bg-gray-100 text-gray-700 border-gray-200'
	}
}

export default function PaymentsPage() {
	const [rows, setRows] = useState<PaymentRow[]>([])
	const [loading, setLoading] = useState<boolean>(true)
	const [error, setError] = useState<string | null>(null)
	const [nextPage, setNextPage] = useState<string | null>(null)
	const [hasMore, setHasMore] = useState<boolean>(false)
	const [initialLoaded, setInitialLoaded] = useState<boolean>(false)

	const fetchPage = useCallback(async (page?: string | null) => {
		setLoading(true)
		setError(null)
		try {
			const params = new URLSearchParams()
			params.set('limit', '50')
			if (page) params.set('page', page)
			const res = await fetch(`/api/payments/list?${params.toString()}`, {
				method: 'GET',
				cache: 'no-store'
			})
			if (!res.ok) {
				throw new Error('Failed to fetch payments')
			}
			const data: PaymentsResponse = await res.json()
			setRows((prev) => (page ? [...prev, ...data.rows] : data.rows))
			setNextPage(data.nextPage ?? null)
			setHasMore(!!data.hasMore)
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Unknown error')
		} finally {
			setLoading(false)
			setInitialLoaded(true)
		}
	}, [])

	useEffect(() => {
		fetchPage(null)
	}, [fetchPage])

	return (
		<div className="px-6 py-6">
			<div className="mb-4 flex items-center justify-between">
				<h1 className="text-lg font-semibold">Pagos</h1>
				<div />
			</div>

			<div className="border rounded-md overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Fecha</TableHead>
							<TableHead>Importe</TableHead>
							<TableHead>Estado</TableHead>
							<TableHead>Comisión</TableHead>
							<TableHead>Neto</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((r) => (
							<TableRow key={r.paymentIntentId}>
								<TableCell>{formatDate(r.created)}</TableCell>
								<TableCell>
									{formatCurrencyMinor(r.amount, r.currency)}
								</TableCell>
								<TableCell>
									<Badge
										variant="outline"
										className={`text-xs ${statusBadgeVariant(r.paymentStatus)}`}
									>
										{r.paymentStatus}
									</Badge>
								</TableCell>
								<TableCell>
									{typeof r.fee === 'number'
										? formatCurrencyMinor(
												Math.abs(r.fee),
												r.currency
											)
										: '—'}
								</TableCell>
								<TableCell>
									{typeof r.net === 'number'
										? formatCurrencyMinor(r.net, r.currency)
										: '—'}
								</TableCell>
							</TableRow>
						))}

						{!rows.length && initialLoaded && !loading && (
							<TableRow>
								<TableCell
									colSpan={5}
									className="text-center text-sm py-10 text-gray-500"
								>
									No hay pagos todavía
								</TableCell>
							</TableRow>
						)}

						{loading && (
							<TableRow>
								<TableCell
									colSpan={5}
									className="py-6 text-center"
								>
									<Spinner size="sm" color="dark" />
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-between mt-4">
				{error ? (
					<div className="text-sm text-red-600">{error}</div>
				) : (
					<div />
				)}
				<div>
					<Button
						variant="default"
						disabled={!hasMore || !nextPage || loading}
						onClick={() => fetchPage(nextPage)}
					>
						Cargar más
					</Button>
				</div>
			</div>
		</div>
	)
}
