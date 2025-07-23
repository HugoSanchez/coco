'use client'

import { useEffect, useState, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/use-toast'
import { useRouter } from 'next/navigation'
import { ClientList } from '@/components/ClientList'
import { BookingsTable, Booking } from '@/components/BookingsTable'
import { SideSheet } from '@/components/SideSheet'
import {
	BookingFilters,
	BookingFiltersState
} from '@/components/BookingFilters'
import {
	Activity,
	FilterX,
	CreditCard,
	DollarSign,
	Users,
	Plus,
	CalendarCheck,
	TriangleAlert
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/components/ui/card'
import { StatCard } from '@/components/StatCard'
import { getClientsForUser, Client, getClientFullName } from '@/lib/db/clients'
import {
	getBookingsWithBills,
	BookingWithBills,
	PaginatedBookingsResult,
	PaginationOptions,
	BookingFilterOptions
} from '@/lib/db/bookings'
import { BookingForm } from '@/components/BookingForm'
import { Spinner } from '@/components/ui/spinner'
import { RefundConfirmationModal } from '@/components/RefundConfirmationModal'
import { MarkAsPaidConfirmationModal } from '@/components/MarkAsPaidConfirmationModal'
import { RescheduleForm } from '@/components/RescheduleForm'
import { StripeConfigurationModal } from '@/components/StripeConfigurationModal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getCurrentMonthNameCapitalized } from '@/lib/utils'

/**
 * Interface for dashboard statistics API response
 * Matches the response structure from /api/dashboard/stats
 */
interface DashboardStats {
	revenue: {
		current: number
		previous: number
		percentageChange: number | null
		currency: string
		formattedCurrent: string
		formattedPrevious: string
	}
	bookings: {
		current: number
		previous: number
		percentageChange: number | null
	}
	pendingBookings: {
		current: number
		previous: number
		percentageChange: number | null
	}
	activeClients: {
		current: number
		previous: number
		percentageChange: number | null
	}
}

/**
 * Interface for dashboard statistics state management
 * Handles loading, error, and data states for statistics
 */
interface DashboardStatsState {
	data: DashboardStats | null
	loading: boolean
	error: string | null
}

// Transform database booking with bills to component booking format
const transformBooking = (dbBooking: BookingWithBills): Booking => {
	// Ensure status is one of the expected values
	const validStatuses = [
		'pending',
		'scheduled',
		'completed',
		'canceled'
	] as const
	const status = validStatuses.includes(dbBooking.status as any)
		? (dbBooking.status as
				| 'pending'
				| 'scheduled'
				| 'completed'
				| 'canceled')
		: 'pending'

	return {
		id: dbBooking.id,
		customerName: getClientFullName(dbBooking.client),
		customerEmail: dbBooking.client?.email || 'Email no disponible',
		bookingDate: new Date(dbBooking.start_time),
		startTime: new Date(dbBooking.start_time),
		status,
		billing_status: dbBooking.billing_status,
		payment_status: dbBooking.payment_status,
		amount: dbBooking.bill?.amount || 0,
		currency: dbBooking.bill?.currency || 'EUR'
	}
}

export default function Dashboard() {
	const { user, profile, loading, stripeOnboardingCompleted } = useUser()
	const [clients, setClients] = useState<Client[]>([])
	const [loadingClients, setLoadingClients] = useState(true)
	const [bookings, setBookings] = useState<Booking[]>([])
	const [loadingBookings, setLoadingBookings] = useState(false)
	const [loadingMore, setLoadingMore] = useState(false)
	const [hasMore, setHasMore] = useState(false)
	const [offset, setOffset] = useState(0)
	const [isFilterOpen, setIsFilterOpen] = useState(false)
	const [isNewBookingOpen, setIsNewBookingOpen] = useState(false)
	const [showStripeConfigModal, setShowStripeConfigModal] = useState(false)
	const [refundingBookingId, setRefundingBookingId] = useState<string | null>(
		null
	)
	const [markingAsPaidBookingId, setMarkingAsPaidBookingId] = useState<
		string | null
	>(null)
	const [isRescheduleOpen, setIsRescheduleOpen] = useState(false)
	const [reschedulingBookingId, setReschedulingBookingId] = useState<
		string | null
	>(null)
	const [filters, setFilters] = useState<BookingFiltersState>({
		customerSearch: '',
		statusFilter: 'all',
		startDate: '',
		endDate: ''
	})
	const [dashboardStats, setDashboardStats] = useState<DashboardStatsState>({
		data: null,
		loading: false,
		error: null
	})

	const { toast } = useToast()
	const router = useRouter()

	/**
	 * Fetches dashboard statistics from the API
	 * Handles loading states and error management
	 */
	const fetchDashboardStats = async () => {
		if (!user) return

		try {
			setDashboardStats((prev) => ({
				...prev,
				loading: true,
				error: null
			}))

			const response = await fetch('/api/dashboard/stats', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(
					errorData.error || 'Failed to fetch dashboard statistics'
				)
			}

			const result = await response.json()

			if (!result.success) {
				throw new Error(
					result.error || 'Failed to fetch dashboard statistics'
				)
			}

			setDashboardStats({
				data: result.data,
				loading: false,
				error: null
			})
		} catch (error) {
			console.error('Error fetching dashboard statistics:', error)
			setDashboardStats({
				data: null,
				loading: false,
				error:
					error instanceof Error
						? error.message
						: 'Failed to load statistics'
			})
		}
	}

	/**
	 * Retry function for dashboard statistics
	 * Provides user-friendly retry mechanism
	 */
	const retryDashboardStats = () => {
		fetchDashboardStats()
	}

	// Fetch dashboard statistics when user is available
	useEffect(() => {
		if (user) {
			fetchDashboardStats()
		}
	}, [user])

	useEffect(() => {
		const fetchBookings = async () => {
			if (!user) return

			try {
				setLoadingBookings(true)
				const result = await getBookingsWithBills(
					user.id,
					{ limit: 10, offset: 0 },
					{
						customerSearch: filters.customerSearch || undefined,
						statusFilter: filters.statusFilter,
						startDate: filters.startDate || undefined,
						endDate: filters.endDate || undefined
					}
				)
				const transformedBookings =
					result.bookings.map(transformBooking)
				setBookings(transformedBookings)
				setHasMore(result.hasMore)
				setOffset(10)
			} catch (error) {
				console.error('Error loading bookings:', error)
				toast({
					title: 'Error',
					description: 'Failed to load bookings.',
					variant: 'destructive'
				})
			} finally {
				setLoadingBookings(false)
			}
		}

		if (user) {
			fetchBookings()
		}
	}, [user, filters, toast])

	useEffect(() => {
		const fetchClients = async () => {
			if (!user) return
			setLoadingClients(true)
			try {
				const data = await getClientsForUser(user.id)
				setClients(data as Client[])
			} catch (e) {
				// handle error
			} finally {
				setLoadingClients(false)
			}
		}
		if (user) {
			fetchClients()
		}
	}, [user])

	const handleClientCreated = async () => {
		// Refresh the client list when a new client is created
		if (!user) return
		setLoadingClients(true)
		try {
			const data = await getClientsForUser(user.id)
			setClients(data as Client[])
		} catch (e) {
			console.error('Error refreshing clients:', e)
		} finally {
			setLoadingClients(false)
		}
	}

	const handleCancelBooking = async (bookingId: string) => {
		try {
			// Show immediate feedback with spinner
			toast({
				title: 'Cancelando cita...',
				description: 'Procesando la cancelación de la cita.',
				variant: 'default',
				color: 'loading'
			})

			// Call our comprehensive cancellation API endpoint
			const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to cancel booking')
			}

			const result = await response.json()

			// Update local state after successful API response
			// Update booking status to canceled and payment status if not already paid
			setBookings((prev) =>
				prev.map((booking) => {
					if (booking.id === bookingId) {
						const updatedBooking = {
							...booking,
							status: 'canceled' as const
						}

						// If payment is still pending, mark it as canceled too
						if (
							booking.payment_status === 'pending' ||
							booking.payment_status === 'not_applicable'
						) {
							updatedBooking.payment_status = 'canceled' as const
						}

						return updatedBooking
					}
					return booking
				})
			)

			toast({
				title: 'Cita cancelada',
				description: 'La cita ha sido cancelada correctamente.',
				variant: 'default',
				color: 'success'
			})
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Failed to cancel booking. Please try again.',
				variant: 'destructive'
			})
		}
	}

	const handleConfirmBooking = async (bookingId: string) => {
		try {
			// Show immediate feedback with spinner
			toast({
				title: 'Confirmando cita...',
				description: 'Procesando la confirmación de la cita.',
				variant: 'default',
				color: 'loading'
			})

			// Call our confirmation API endpoint
			const response = await fetch(`/api/bookings/${bookingId}/confirm`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to confirm booking')
			}

			const result = await response.json()

			// Update local state after successful API response
			setBookings((prev) =>
				prev.map((booking) =>
					booking.id === bookingId
						? {
								...booking,
								status: 'scheduled' as const
							}
						: booking
				)
			)

			toast({
				title: 'Cita marcada como confirmada',
				description:
					'Hemos enviado la invitación al paciente por correo.',
				variant: 'default',
				color: 'success'
			})
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Failed to confirm booking. Please try again.',
				variant: 'destructive'
			})
		}
	}

	const handleMarkAsPaid = async (bookingId: string) => {
		try {
			// Show immediate feedback with spinner
			toast({
				title: 'Marcando como pagada...',
				description: 'Procesando el registro de pago.',
				variant: 'default',
				color: 'loading'
			})

			// Call our mark as paid API endpoint
			const response = await fetch(
				`/api/bookings/${bookingId}/mark-paid`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					}
				}
			)

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to mark as paid')
			}

			const result = await response.json()

			// Update local state after successful API response
			setBookings((prev) =>
				prev.map((booking) =>
					booking.id === bookingId
						? {
								...booking,
								payment_status: 'paid' as const
							}
						: booking
				)
			)

			// Close the modal
			setMarkingAsPaidBookingId(null)

			toast({
				title: 'Pago registrado',
				description: 'La factura ha sido marcada como pagada.',
				variant: 'default',
				color: 'success'
			})
		} catch (error) {
			// Close the modal even on error
			setMarkingAsPaidBookingId(null)

			toast({
				title: 'Error',
				description: 'Failed to mark as paid. Please try again.',
				variant: 'destructive'
			})
		}
	}

	const handleRefundBooking = (bookingId: string) => {
		setRefundingBookingId(bookingId)
	}

	const handleShowMarkAsPaidDialog = (bookingId: string) => {
		setMarkingAsPaidBookingId(bookingId)
	}

	const handleRescheduleBooking = (bookingId: string) => {
		console.log('Opening reschedule slidesheet for booking:', bookingId)

		// Add a small delay to ensure dropdown closes first
		setTimeout(() => {
			setReschedulingBookingId(bookingId)
			setIsRescheduleOpen(true)
		}, 100)
	}

	const handleRefundConfirm = async (bookingId: string, reason?: string) => {
		try {
			// Show immediate feedback with spinner
			toast({
				title: 'Procesando reembolso...',
				description: 'Enviando solicitud de reembolso a Stripe.',
				variant: 'default',
				color: 'loading'
			})

			// Call our refund API endpoint
			const response = await fetch(`/api/bookings/${bookingId}/refund`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ reason })
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Failed to process refund')
			}

			const result = await response.json()

			// Update local state - mark payment as refunded
			setBookings((prev) =>
				prev.map((booking) =>
					booking.id === bookingId
						? {
								...booking,
								payment_status: 'refunded' as const
							}
						: booking
				)
			)

			// Close the modal
			setRefundingBookingId(null)

			toast({
				title: 'Reembolso procesado',
				description: 'El reembolso se ha procesado correctamente.',
				variant: 'default',
				color: 'success'
			})
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Failed to process refund. Please try again.',
				variant: 'destructive'
			})
		}
	}

	const loadMoreBookings = async () => {
		if (!user || loadingMore || !hasMore) return

		try {
			setLoadingMore(true)
			const result = await getBookingsWithBills(
				user.id,
				{ limit: 10, offset: offset },
				{
					customerSearch: filters.customerSearch || undefined,
					statusFilter: filters.statusFilter,
					startDate: filters.startDate || undefined,
					endDate: filters.endDate || undefined
				}
			)
			const transformedBookings = result.bookings.map(transformBooking)

			// Append new bookings to existing ones
			setBookings((prev) => [...prev, ...transformedBookings])
			setHasMore(result.hasMore)
			setOffset((prev) => prev + 10)
		} catch (error) {
			console.error('Error loading more bookings:', error)
			toast({
				title: 'Error',
				description: 'Failed to load more bookings.',
				variant: 'destructive'
			})
		} finally {
			setLoadingMore(false)
		}
	}

	// Reset pagination and refetch when filters change
	useEffect(() => {
		const refetchWithFilters = async () => {
			if (!user) return

			try {
				setLoadingBookings(true)
				const result = await getBookingsWithBills(
					user.id,
					{ limit: 10, offset: 0 },
					{
						customerSearch: filters.customerSearch || undefined,
						statusFilter: filters.statusFilter,
						startDate: filters.startDate || undefined,
						endDate: filters.endDate || undefined
					}
				)
				const transformedBookings =
					result.bookings.map(transformBooking)
				setBookings(transformedBookings)
				setHasMore(result.hasMore)
				setOffset(10)
			} catch (error) {
				console.error('Error loading bookings:', error)
				toast({
					title: 'Error',
					description: 'Failed to load bookings.',
					variant: 'destructive'
				})
			} finally {
				setLoadingBookings(false)
			}
		}

		// Only refetch if we have active filters (not on initial load)
		if (
			user &&
			(filters.customerSearch ||
				filters.statusFilter !== 'all' ||
				filters.startDate ||
				filters.endDate)
		) {
			refetchWithFilters()
		}
	}, [filters, user, toast])

	if (loading) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Spinner size="sm" color="dark" />
			</div>
		)
	}

	if (!user) {
		return null // Render nothing while the redirect occurs
	}

	return (
		<div className="flex min-h-screen w-full flex-col py-24">
			<header className="flex flex-col md:flex-row items-left md:items-center justify-between px-6 md:px-16 pb-6 gap-4 md:gap-0">
				<div className="flex flex-col">
					<h1 className="text-xl md:text-3xl font-bold">
						Hola {profile?.name},
					</h1>
					<h3 className="text-lg md:text-2xl">
						este es tu dashboard
					</h3>
				</div>
				<div className="flex gap-2">
					<Button
						variant="default"
						className="text-md px-4"
						onClick={() => {
							// Check Stripe onboarding status before opening booking form
							if (stripeOnboardingCompleted === false) {
								setShowStripeConfigModal(true)
							} else {
								setIsNewBookingOpen(true)
							}
						}}
					>
						<Plus className="h-5 w-5 mr-2" />
						Crear cita
					</Button>
				</div>
			</header>
			<main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:px-16">
				<div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
					{/* Revenue Card - Real Data */}
					<StatCard
						title={`Facturación Mensual`}
						value={dashboardStats.data?.revenue.formattedCurrent}
						change={dashboardStats.data?.revenue.percentageChange}
						changeLabel="respecto al mes anterior"
						icon={
							<DollarSign className="h-4 w-4 text-muted-foreground" />
						}
						tooltipContent={`Facturación total confirmada para el mes de ${getCurrentMonthNameCapitalized()}`}
						loading={dashboardStats.loading}
						error={dashboardStats.error}
						onRetry={retryDashboardStats}
					/>
					{/* Bookings Card - Real Data */}
					<StatCard
						title={`Total Confirmadas`}
						value={'+' + dashboardStats.data?.bookings.current}
						change={dashboardStats.data?.bookings.percentageChange}
						changeLabel="respecto al mes anterior"
						icon={
							<CalendarCheck className="h-4 w-4 text-muted-foreground" />
						}
						tooltipContent={`Total de citas confirmadas para el mes de ${getCurrentMonthNameCapitalized()}`}
						loading={dashboardStats.loading}
						error={dashboardStats.error}
						onRetry={retryDashboardStats}
					/>
					{/* Pending Bookings Card - Real Data */}
					<StatCard
						title={`Pendientes de confirmación`}
						value={
							'+' + dashboardStats.data?.pendingBookings.current
						}
						change={
							dashboardStats.data?.pendingBookings
								.percentageChange
						}
						changeLabel="respecto al mes anterior"
						icon={
							<TriangleAlert className="h-4 w-4 text-muted-foreground" />
						}
						tooltipContent={`Número de citas pendientes de confirmación para ${getCurrentMonthNameCapitalized()}`}
						loading={dashboardStats.loading}
						error={dashboardStats.error}
						onRetry={retryDashboardStats}
					/>

					{/* Active Clients Card - Real Data */}
					<StatCard
						title="Clientes Activos"
						value={'+' + dashboardStats.data?.activeClients.current}
						change={
							dashboardStats.data?.activeClients.percentageChange
						}
						changeLabel="respecto a los 30 días anteriores"
						icon={
							<Users className="h-4 w-4 text-muted-foreground" />
						}
						tooltipContent="Clientes únicos que han tenido al menos una cita en los últimos 30 días."
						loading={dashboardStats.loading}
						error={dashboardStats.error}
						onRetry={retryDashboardStats}
					/>
				</div>
				<div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
					<Card
						className="xl:col-span-2"
						x-chunk="dashboard-01-chunk-4"
					>
						<CardHeader className="flex flex-row items-center">
							<div className="grid gap-2">
								<CardTitle>Listado de citas</CardTitle>
								<CardDescription>
									Listado de todas tus citas agendadas, con su
									estado de facturación y pago.
								</CardDescription>
							</div>
							<Button
								size="sm"
								onClick={() => setIsFilterOpen(true)}
								className="ml-auto gap-1 bg-gray-100 text-gray-800 hover:bg-gray-200"
							>
								Filtrar
								<FilterX className="h-4 w-4 ml-2" />
							</Button>
						</CardHeader>
						<CardContent>
							<BookingsTable
								bookings={bookings}
								loading={loadingBookings}
								onCancelBooking={handleCancelBooking}
								onConfirmBooking={handleConfirmBooking}
								onMarkAsPaid={handleShowMarkAsPaidDialog}
								onRefundBooking={handleRefundBooking}
								onRescheduleBooking={handleRescheduleBooking}
							/>
							{/* Load More Button */}
							{hasMore && !loadingBookings && (
								<div className="flex justify-center pt-4">
									<Button
										variant="ghost"
										onClick={loadMoreBookings}
										disabled={loadingMore}
										className="w-40 hover:bg-gray-50 rounded-full"
									>
										{loadingMore ? (
											<>
												<Spinner
													size="sm"
													className="mr-2"
												/>
												Cargando...
											</>
										) : (
											'Cargar más'
										)}
									</Button>
								</div>
							)}
						</CardContent>
					</Card>
					<div x-chunk="dashboard-01-chunk-5">
						<ClientList
							clients={clients as Client[]}
							loading={loadingClients}
							onClientCreated={handleClientCreated}
						/>
					</div>
				</div>
			</main>

			{/* Filter Sidebar */}
			<SideSheet
				isOpen={isFilterOpen}
				onClose={() => setIsFilterOpen(false)}
				title="Filtros"
				description="Filtra tus consultas por paciente, estado de facturación y estado de pago."
			>
				<BookingFilters
					filters={filters}
					onFiltersChange={setFilters}
				/>
			</SideSheet>

			{/* New Booking Sidebar */}
			<SideSheet
				isOpen={isNewBookingOpen}
				onClose={() => setIsNewBookingOpen(false)}
				title="Nueva Cita"
				description="Crea una nueva cita para uno de tus pacientes."
			>
				<BookingForm
					clients={clients as any[]}
					onSuccess={async () => {
						setIsNewBookingOpen(false)
						// Refresh bookings list
						if (user) {
							try {
								const result = await getBookingsWithBills(
									user.id,
									{ limit: 10, offset: 0 }
								)
								const transformedBookings =
									result.bookings.map(transformBooking)
								setBookings(transformedBookings)
								setHasMore(result.hasMore)
								setOffset(10)
							} catch (error) {
								console.error(
									'Error refreshing bookings:',
									error
								)
							}
						}
					}}
					onCancel={() => setIsNewBookingOpen(false)}
				/>
			</SideSheet>

			{/* Reschedule Sidebar */}
			<SideSheet
				isOpen={isRescheduleOpen}
				onClose={() => {
					console.log('Closing reschedule slidesheet')
					setIsRescheduleOpen(false)
					setReschedulingBookingId(null)
				}}
				title="Reprogramar Cita"
				description="Selecciona una nueva fecha y hora para la cita"
			>
				{reschedulingBookingId && (
					<RescheduleForm
						bookingId={reschedulingBookingId}
						customerName={
							bookings.find((b) => b.id === reschedulingBookingId)
								?.customerName || 'Cliente'
						}
						onSuccess={() => {
							console.log('Reschedule successful')
							setIsRescheduleOpen(false)
							setReschedulingBookingId(null)
						}}
						onCancel={() => {
							console.log('Reschedule cancelled')
							setIsRescheduleOpen(false)
							setReschedulingBookingId(null)
						}}
					/>
				)}
			</SideSheet>

			{/* Refund Confirmation Modal */}
			{refundingBookingId &&
				(() => {
					const booking = bookings.find(
						(b) => b.id === refundingBookingId
					) || {
						id: refundingBookingId,
						customerName: 'Cliente',
						customerEmail: '',
						bookingDate: new Date(),
						status: 'scheduled' as const,
						billing_status: 'sent' as const,
						payment_status: 'paid' as const,
						amount: 0,
						currency: 'EUR'
					}

					return (
						<RefundConfirmationModal
							isOpen={!!refundingBookingId}
							onOpenChange={(open) =>
								!open && setRefundingBookingId(null)
							}
							onConfirm={(reason) =>
								handleRefundConfirm(refundingBookingId, reason)
							}
							bookingDetails={{
								id: booking.id,
								customerName: booking.customerName,
								customerEmail: booking.customerEmail,
								amount: booking.amount,
								currency: booking.currency || 'EUR',
								date: format(
									booking.bookingDate,
									'dd MMM yyyy',
									{ locale: es }
								)
							}}
						/>
					)
				})()}

			{/* Mark As Paid Confirmation Modal */}
			{markingAsPaidBookingId &&
				(() => {
					const booking = bookings.find(
						(b) => b.id === markingAsPaidBookingId
					) || {
						id: markingAsPaidBookingId,
						customerName: 'Cliente',
						customerEmail: '',
						bookingDate: new Date(),
						status: 'scheduled' as const,
						billing_status: 'sent' as const,
						payment_status: 'paid' as const,
						amount: 0,
						currency: 'EUR'
					}

					return (
						<MarkAsPaidConfirmationModal
							key={markingAsPaidBookingId}
							isOpen={!!markingAsPaidBookingId}
							onOpenChange={(open) =>
								!open && setMarkingAsPaidBookingId(null)
							}
							onConfirm={() => {
								handleMarkAsPaid(markingAsPaidBookingId)
							}}
							bookingDetails={{
								id: booking.id,
								customerName: booking.customerName,
								customerEmail: booking.customerEmail,
								amount: booking.amount,
								currency: booking.currency || 'EUR',
								date: format(
									booking.bookingDate,
									'dd MMM yyyy',
									{ locale: es }
								)
							}}
						/>
					)
				})()}

			{/* Stripe Configuration Modal */}
			<StripeConfigurationModal
				isOpen={showStripeConfigModal}
				onOpenChange={setShowStripeConfigModal}
				onConfirm={() => {
					router.push('/settings?tab=payments')
					setShowStripeConfigModal(false)
				}}
			/>
		</div>
	)
}
