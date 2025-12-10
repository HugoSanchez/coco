'use client'

import { useEffect, useRef, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/use-toast'
import { useRouter } from 'next/navigation'
import { ClientList } from '@/components/ClientList'
import { BookingsTable, Booking } from '@/components/BookingsTable'
import { SideSheetHeadless } from '@/components/SideSheetHeadless'
import { BookingFilters, BookingFiltersState } from '@/components/BookingFilters'
import { FilterX, DollarSign, Users, Plus, CalendarCheck, TriangleAlert } from 'lucide-react'
import ShareBookingLinkButton from '@/components/ShareBookingLinkButton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/StatCard'
import { Client, getClientFullName } from '@/lib/db/clients'
import { getBookingsWithBills, BookingWithBills } from '@/lib/db/bookings'
import { BookingForm } from '@/components/BookingForm'
import { Spinner } from '@/components/ui/spinner'
import { RefundConfirmationModal } from '@/components/RefundConfirmationModal'
import { MarkAsPaidConfirmationModal } from '@/components/MarkAsPaidConfirmationModal'
import { RescheduleForm } from '@/components/RescheduleForm'
import { StripeConfigurationModal } from '@/components/StripeConfigurationModal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getCurrentMonthNameCapitalized } from '@/lib/utils'
import { CancelConfirmationModal } from '@/components/CancelConfirmationModal'
import { X } from 'lucide-react'
import { useBookingActions } from '@/hooks/useBookingActions'
import { useClientManagement } from '@/hooks/useClientManagement'
import { useBookingModals } from '@/hooks/useBookingModals'
import { useBookingCreation } from '@/hooks/useBookingCreation'

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
	const validStatuses = ['pending', 'scheduled', 'completed', 'canceled'] as const
	const status = validStatuses.includes(dbBooking.status as any)
		? (dbBooking.status as 'pending' | 'scheduled' | 'completed' | 'canceled')
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
		currency: dbBooking.bill?.currency || 'EUR',
		series_id: (dbBooking as any).series_id || undefined // V2: Include series_id for recurring bookings
	}
}

export default function Dashboard() {
	const { user, profile, loading, stripeOnboardingCompleted, calendarConnected } = useUser()

	// Initialize client management hook
	const {
		clients,
		loading: loadingClients,
		refreshClients
	} = useClientManagement({
		// Auto-fetch is enabled by default, so clients will load on mount
	})

	const [bookings, setBookings] = useState<Booking[]>([])
	const [loadingBookings, setLoadingBookings] = useState(false)
	const [loadingMore, setLoadingMore] = useState(false)
	const [hasMore, setHasMore] = useState(false)
	const [offset, setOffset] = useState(0)
	const [isFilterOpen, setIsFilterOpen] = useState(false)
	const [showStripeConfigModal, setShowStripeConfigModal] = useState(false)

	// Initialize booking creation hook
	const {
		isFormOpen: isNewBookingOpen,
		openForm: openNewBookingForm,
		closeForm: closeNewBookingForm,
		handleBookingCreated
	} = useBookingCreation({
		onBookingCreated: async () => {
			// Refresh bookings list after successful creation
			if (user) {
				try {
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
					const transformedBookings = result.bookings.map(transformBooking)
					setBookings(transformedBookings)
					setHasMore(result.hasMore)
					setOffset(10)
				} catch (error) {
					console.error('Error refreshing bookings:', error)
				}
			}
		}
	})

	// Initialize booking modals hook
	const {
		refundingBookingId,
		markingAsPaidBookingId,
		cancelingBookingId,
		cancelingSeriesId,
		isRescheduleOpen,
		reschedulingBookingId,
		openRefundModal,
		closeRefundModal,
		openMarkAsPaidModal,
		closeMarkAsPaidModal,
		openCancelBookingModal,
		closeCancelBookingModal,
		openCancelSeriesModal,
		closeCancelSeriesModal,
		openRescheduleModal,
		closeRescheduleModal
	} = useBookingModals()
	const [filters, setFilters] = useState<BookingFiltersState>({
		customerSearch: '',
		statusFilter: 'all',
		startDate: '',
		endDate: ''
	})
	const activeFilterCount =
		(filters.customerSearch ? 1 : 0) +
		(filters.statusFilter !== 'all' ? 1 : 0) +
		(filters.startDate ? 1 : 0) +
		(filters.endDate ? 1 : 0)
	const hasActiveFilters = activeFilterCount > 0
	const [exporting, setExporting] = useState(false)
	const [dashboardStats, setDashboardStats] = useState<DashboardStatsState>({
		data: null,
		loading: false,
		error: null
	})

	const { toast } = useToast()
	// Guards to prevent duplicate stats requests
	const statsInitRef = useRef(false)
	const statsInFlightRef = useRef(false)

	const exportWithCurrentFilters = async () => {
		if (!user) return
		try {
			setExporting(true)
			const params = new URLSearchParams({
				statusFilter: filters.statusFilter,
				format: 'csv'
			})
			if (filters.customerSearch) params.set('customerSearch', filters.customerSearch)
			if (filters.startDate) params.set('startDate', filters.startDate)
			if (filters.endDate) params.set('endDate', filters.endDate)

			const res = await fetch(`/api/exports/bookings-bills?${params}`)
			if (!res.ok) {
				throw new Error((await res.text()) || 'Export failed')
			}
			const url = window.URL.createObjectURL(await res.blob())
			const a = Object.assign(document.createElement('a'), {
				href: url,
				download: 'citas-y-facturas.csv'
			})
			document.body.appendChild(a)
			a.click()
			a.remove()
			window.URL.revokeObjectURL(url)
			toast({
				title: 'Export descargado',
				description: 'Tu archivo CSV ha sido descargado.'
			})
		} catch (e) {
			toast({
				title: 'Error en exportación',
				description: e instanceof Error ? e.message : 'No se pudo exportar',
				variant: 'destructive'
			})
		} finally {
			setExporting(false)
		}
	}
	const router = useRouter()

	// Minimal guard: only redirect if we definitively know both are false
	useEffect(() => {
		if (!user) return
		if (stripeOnboardingCompleted === null || calendarConnected === null) return
		if (stripeOnboardingCompleted === false && calendarConnected === false) {
			router.replace('/onboarding')
		}
	}, [user, stripeOnboardingCompleted, calendarConnected, router])

	// Simple responsive switch for mobile tabs behavior
	const [isMobile, setIsMobile] = useState(false)
	const [mobileTab, setMobileTab] = useState<'bookings' | 'clients' | 'stats'>('bookings')

	useEffect(() => {
		const onResize = () => setIsMobile(window.innerWidth < 768)
		onResize()
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	}, [])

	/**
	 * Fetches dashboard statistics from the API
	 * Handles loading states and error management
	 */
	const fetchDashboardStats = async () => {
		if (!user) return
		if (statsInFlightRef.current) return

		try {
			statsInFlightRef.current = true
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
				throw new Error(errorData.error || 'Failed to fetch dashboard statistics')
			}

			const result = await response.json()

			if (!result.success) {
				throw new Error(result.error || 'Failed to fetch dashboard statistics')
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
				error: error instanceof Error ? error.message : 'Failed to load statistics'
			})
		} finally {
			statsInFlightRef.current = false
		}
	}

	/**
	 * Retry function for dashboard statistics
	 * Provides user-friendly retry mechanism
	 */
	const retryDashboardStats = () => {
		fetchDashboardStats()
	}

	// Fetch dashboard statistics once when user is available (guarded)
	useEffect(() => {
		if (!user) return
		if (statsInitRef.current) return
		statsInitRef.current = true
		fetchDashboardStats()
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
				const transformedBookings = result.bookings.map(transformBooking)
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

	// Client management is now handled by useClientManagement hook
	// No need for manual fetching or handleClientCreated - the hook handles it

	// Initialize booking actions hook with callbacks for state updates
	const { cancelBooking, confirmBooking, markAsPaid, processRefund, resendEmail, cancelSeries } = useBookingActions({
		// Callback to update a single booking in local state
		onBookingUpdated: (bookingId, updates) => {
			setBookings((prev) =>
				prev.map((booking) => (booking.id === bookingId ? { ...booking, ...updates } : booking))
			)
		},
		// Callback to remove bookings from local state (used for series cancellations)
		onBookingsRemoved: (predicate) => {
			setBookings((prev) => prev.filter(predicate))
		},
		// Callback to refresh dashboard statistics after major state changes
		onStatsRefresh: fetchDashboardStats
	})

	// Modal handlers are now provided by useBookingModals hook
	// We create wrapper functions that combine modal actions with booking actions
	const [shouldSendCancelEmail, setShouldSendCancelEmail] = useState(false)

	const handleRefundBooking = openRefundModal
	const handleShowMarkAsPaidDialog = openMarkAsPaidModal
	const handleShowCancelDialog = (bookingId: string) => {
		const booking = bookings.find((b) => b.id === bookingId)
		setShouldSendCancelEmail(booking?.payment_status === 'paid')
		openCancelBookingModal(bookingId)
	}
	const handleCancelSeries = openCancelSeriesModal
	const handleRescheduleBooking = (bookingId: string) => {
		console.log('Opening reschedule slidesheet for booking:', bookingId)
		openRescheduleModal(bookingId)
	}

	// Wrapper for cancel booking that handles the modal confirmation
	useEffect(() => {
		if (!cancelingBookingId) {
			setShouldSendCancelEmail(false)
		}
	}, [cancelingBookingId])

	const handleCancelBooking = async (bookingId: string, options?: { sendEmail: boolean }) => {
		await cancelBooking(bookingId, options)
	}

	// Wrapper for mark as paid that closes the modal after success
	const handleMarkAsPaid = async (bookingId: string) => {
		try {
			await markAsPaid(bookingId)
			// Close the modal after successful operation
			closeMarkAsPaidModal()
		} catch (error) {
			// Close the modal even on error
			closeMarkAsPaidModal()
		}
	}

	// Wrapper for refund confirmation that closes the modal after success
	const handleRefundConfirm = async (bookingId: string, reason?: string) => {
		try {
			await processRefund(bookingId, reason)
			// Close the modal after successful operation
			closeRefundModal()
		} catch (error) {
			// Modal stays open on error so user can retry
		}
	}

	// Wrapper for cancel series that refreshes bookings list after cancellation
	const handleConfirmCancelSeries = async () => {
		if (!cancelingSeriesId) return

		// Close dialog immediately since we show loading toast
		const seriesIdToCancel = cancelingSeriesId
		closeCancelSeriesModal()

		try {
			await cancelSeries(seriesIdToCancel)

			// Refresh bookings list after series cancellation
			if (user) {
				const bookingsResult = await getBookingsWithBills(
					user.id,
					{ limit: 10, offset: 0 },
					{
						customerSearch: filters.customerSearch || undefined,
						statusFilter: filters.statusFilter,
						startDate: filters.startDate || undefined,
						endDate: filters.endDate || undefined
					}
				)
				const transformedBookings = bookingsResult.bookings.map(transformBooking)
				setBookings(transformedBookings)
				setHasMore(bookingsResult.hasMore)
				setOffset(10)
			}
		} catch (error) {
			// Error handling is done in the hook
		}
	}

	const loadMoreBookings = async () => {
		// Don't load more if date range is active (all results are already loaded)
		if (!user || loadingMore || !hasMore || (filters.startDate && filters.endDate)) return

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
				const transformedBookings = result.bookings.map(transformBooking)
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
			(filters.customerSearch || filters.statusFilter !== 'all' || filters.startDate || filters.endDate)
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
					<h1 className="text-xl md:text-3xl font-bold">Hola {profile?.name},</h1>
					<h3 className="text-lg md:text-2xl">este es tu dashboard</h3>
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
								openNewBookingForm()
							}
						}}
					>
						<Plus className="h-5 w-5 mr-2" />
						Crear cita
					</Button>

					{/* Share booking link button component */}
					<ShareBookingLinkButton username={profile?.username} />
				</div>
			</header>
			<main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:px-16">
				{/* Desktop stats grid */}
				{!isMobile && (
					<div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
						{/* Revenue Card - Real Data */}
						<StatCard
							title={`Facturación Mensual`}
							value={dashboardStats.data?.revenue.formattedCurrent}
							change={dashboardStats.data?.revenue.percentageChange}
							changeLabel="respecto al mes anterior"
							icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
							tooltipContent={`Facturación total confirmada para los próximos 30 días. Comparado con los 30 días anteriores.`}
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
							icon={<CalendarCheck className="h-4 w-4 text-muted-foreground" />}
							tooltipContent={`Total de citas confirmadas para los próximos 30 días. Comparado con los 30 días anteriores.`}
							loading={dashboardStats.loading}
							error={dashboardStats.error}
							onRetry={retryDashboardStats}
						/>
						{/* Pending Bookings Card - Real Data */}
						<StatCard
							title={`Pendientes de confirmación`}
							value={'+' + dashboardStats.data?.pendingBookings.current}
							change={dashboardStats.data?.pendingBookings.percentageChange}
							changeLabel="respecto al mes anterior"
							icon={<TriangleAlert className="h-4 w-4 text-muted-foreground" />}
							tooltipContent={`Número de citas pendientes de confirmación para los próximos 30 días. Comparado con los 30 días anteriores.`}
							loading={dashboardStats.loading}
							error={dashboardStats.error}
							onRetry={retryDashboardStats}
						/>

						{/* Active Clients Card - Real Data */}
						<StatCard
							title="Clientes Activos"
							value={'+' + dashboardStats.data?.activeClients.current}
							change={dashboardStats.data?.activeClients.percentageChange}
							changeLabel="respecto al mes anterior"
							icon={<Users className="h-4 w-4 text-muted-foreground" />}
							tooltipContent="Clientes únicos con citas agendadas en los próximos 30 días. Comparado con los 30 días anteriores."
							loading={dashboardStats.loading}
							error={dashboardStats.error}
							onRetry={retryDashboardStats}
						/>
					</div>
				)}

				{/* Mobile tabs */}
				{isMobile && (
					<div className="md:hidden">
						<div className="flex bg-gray-100 rounded-full p-1 w-full max-w-md mx-auto mb-3">
							{[
								{ key: 'bookings', label: 'Citas' },
								{ key: 'clients', label: 'Clientes' },
								{ key: 'stats', label: 'Stats' }
							].map((t) => (
								<button
									key={t.key}
									className={`flex-1 py-2 text-sm rounded-full transition-colors ${
										mobileTab === (t.key as any)
											? 'bg-white shadow-sm text-gray-900'
											: 'text-gray-600'
									}`}
									onClick={() => setMobileTab(t.key as any)}
								>
									{t.label}
								</button>
							))}
						</div>

						{/* Mobile content by tab */}
						{mobileTab === 'stats' && (
							<div className="grid gap-4">
								<StatCard
									title={`Facturación Mensual`}
									value={dashboardStats.data?.revenue.formattedCurrent}
									change={dashboardStats.data?.revenue.percentageChange}
									changeLabel="respecto al mes anterior"
									icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
									tooltipContent={`Facturación total confirmada para el mes de ${getCurrentMonthNameCapitalized()}`}
									loading={dashboardStats.loading}
									error={dashboardStats.error}
									onRetry={retryDashboardStats}
								/>
								<StatCard
									title={`Total Confirmadas`}
									value={'+' + dashboardStats.data?.bookings.current}
									change={dashboardStats.data?.bookings.percentageChange}
									changeLabel="respecto al mes anterior"
									icon={<CalendarCheck className="h-4 w-4 text-muted-foreground" />}
									tooltipContent={`Total de citas confirmadas para el mes de ${getCurrentMonthNameCapitalized()}`}
									loading={dashboardStats.loading}
									error={dashboardStats.error}
									onRetry={retryDashboardStats}
								/>
								<StatCard
									title={`Pendientes de confirmación`}
									value={'+' + dashboardStats.data?.pendingBookings.current}
									change={dashboardStats.data?.pendingBookings.percentageChange}
									changeLabel="respecto al mes anterior"
									icon={<TriangleAlert className="h-4 w-4 text-muted-foreground" />}
									tooltipContent={`Número de citas pendientes de confirmación para ${getCurrentMonthNameCapitalized()}`}
									loading={dashboardStats.loading}
									error={dashboardStats.error}
									onRetry={retryDashboardStats}
								/>
								<StatCard
									title="Clientes Activos"
									value={'+' + dashboardStats.data?.activeClients.current}
									change={dashboardStats.data?.activeClients.percentageChange}
									changeLabel="respecto a los 30 días anteriores"
									icon={<Users className="h-4 w-4 text-muted-foreground" />}
									tooltipContent="Clientes únicos que han tenido al menos una cita en los últimos 30 días."
									loading={dashboardStats.loading}
									error={dashboardStats.error}
									onRetry={retryDashboardStats}
								/>
							</div>
						)}

						{mobileTab === 'bookings' && (
							<Card x-chunk="dashboard-01-chunk-4">
								<CardHeader className="flex flex-row items-center">
									<div className="grid gap-2">
										<CardTitle>Listado de citas</CardTitle>
										<CardDescription>
											Listado de todas tus citas agendadas, con su estado de facturación y pago.
										</CardDescription>
									</div>
									<div className="ml-auto flex items-center gap-2">
										<Button
											size="sm"
											onClick={() => setIsFilterOpen(true)}
											className="gap-1 bg-gray-100 text-gray-800 hover:bg-gray-200"
										>
											Filtrar
											<FilterX className="h-4 w-4 ml-2" />
											{hasActiveFilters && (
												<Badge className="ml-2 px-1.5 py-0 text-[10px] rounded-full bg-gray-800 text-white">
													{activeFilterCount}
												</Badge>
											)}
										</Button>
										{hasActiveFilters && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													setFilters({
														customerSearch: '',
														statusFilter: 'all',
														startDate: '',
														endDate: ''
													})
												}
												className="text-gray-600 hover:bg-transparent"
											>
												<X className="h-4 w-4 mr-1" />
											</Button>
										)}
									</div>
								</CardHeader>
								<CardContent>
									<BookingsTable
										bookings={bookings}
										loading={loadingBookings}
										onCancelBooking={handleShowCancelDialog}
										onConfirmBooking={confirmBooking}
										onMarkAsPaid={handleShowMarkAsPaidDialog}
										onRefundBooking={handleRefundBooking}
										onRescheduleBooking={handleRescheduleBooking}
										onResendEmail={resendEmail}
										onCancelSeries={handleCancelSeries}
									/>
									{hasMore && !loadingBookings && !(filters.startDate && filters.endDate) && (
										<div className="flex justify-center pt-4">
											<Button
												variant="ghost"
												onClick={loadMoreBookings}
												disabled={loadingMore}
												className="w-40 hover:bg-gray-50 rounded-full text-xs"
											>
												{loadingMore ? (
													<>
														<Spinner size="sm" className="mr-2" />
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
						)}

						{mobileTab === 'clients' && (
							<div>
								<ClientList
									clients={clients as Client[]}
									loading={loadingClients}
									onClientCreated={refreshClients}
								/>
							</div>
						)}
					</div>
				)}

				{/* Desktop bookings + client list layout */}
				{!isMobile && (
					<div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
						<Card className="xl:col-span-2" x-chunk="dashboard-01-chunk-4">
							<CardHeader className="flex flex-row items-center">
								<div className="grid gap-2">
									<CardTitle>Listado de citas</CardTitle>
									<CardDescription>
										Listado de todas tus citas agendadas, con su estado de facturación y pago.
									</CardDescription>
								</div>
								<div className="ml-auto flex items-center">
									<Button
										size="sm"
										onClick={() => setIsFilterOpen(true)}
										className="gap-1 bg-gray-100 text-gray-800 hover:bg-gray-200"
									>
										Filtrar
										<FilterX className="h-4 w-4 ml-" />
										{hasActiveFilters && (
											<Badge className="ml-2 px-1.5 py-0 pr-1 h-5 w-5 text-[10px] rounded-full bg-gray-800 text-white">
												{activeFilterCount}
											</Badge>
										)}
									</Button>
									{hasActiveFilters && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												setFilters({
													customerSearch: '',
													statusFilter: 'all',
													startDate: '',
													endDate: ''
												})
											}
											className="text-gray-600 hover:bg-transparent"
										>
											<X className="h-4 w-4 mr-1" />
										</Button>
									)}
								</div>
							</CardHeader>
							<CardContent>
								<BookingsTable
									bookings={bookings}
									loading={loadingBookings}
									onCancelBooking={handleShowCancelDialog}
									onConfirmBooking={confirmBooking}
									onMarkAsPaid={handleShowMarkAsPaidDialog}
									onRefundBooking={handleRefundBooking}
									onRescheduleBooking={handleRescheduleBooking}
									onResendEmail={resendEmail}
									onCancelSeries={handleCancelSeries}
								/>
								{hasMore && !loadingBookings && !(filters.startDate && filters.endDate) && (
									<div className="flex justify-center pt-4">
										<Button
											variant="ghost"
											onClick={loadMoreBookings}
											disabled={loadingMore}
											className="w-40 hover:bg-gray-50 rounded-full text-xs"
										>
											{loadingMore ? (
												<>
													<Spinner size="sm" className="mr-2" />
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
								onClientCreated={refreshClients}
							/>
						</div>
					</div>
				)}
			</main>

			{/* Filter Sidebar */}
			<SideSheetHeadless
				isOpen={isFilterOpen}
				onClose={() => setIsFilterOpen(false)}
				title="Filtros"
				description="Filtra tus consultas por paciente, estado de facturación y estado de pago."
			>
				<BookingFilters
					filters={filters}
					onFiltersChange={setFilters}
					onExport={exportWithCurrentFilters}
					exporting={exporting}
				/>
			</SideSheetHeadless>

			{/* New Booking Sidebar */}
			<SideSheetHeadless
				isOpen={isNewBookingOpen}
				onClose={closeNewBookingForm}
				title="Nueva Cita"
				description="Crea una nueva cita para uno de tus pacientes."
			>
				<BookingForm
					clients={clients as any[]}
					onSuccess={handleBookingCreated}
					onCancel={closeNewBookingForm}
				/>
			</SideSheetHeadless>

			{/* Reschedule Sidebar */}
			<SideSheetHeadless
				isOpen={isRescheduleOpen}
				onClose={() => {
					console.log('Closing reschedule slidesheet')
					closeRescheduleModal()
				}}
				title="Reprogramar Cita"
				description="Selecciona una nueva fecha y hora para la cita"
			>
				{reschedulingBookingId && (
					<RescheduleForm
						bookingId={reschedulingBookingId}
						customerName={bookings.find((b) => b.id === reschedulingBookingId)?.customerName || 'Cliente'}
						onSuccess={() => {
							console.log('Reschedule successful')
							closeRescheduleModal()
						}}
						onCancel={() => {
							console.log('Reschedule cancelled')
							closeRescheduleModal()
						}}
					/>
				)}
			</SideSheetHeadless>

			{/* Refund Confirmation Modal */}
			{refundingBookingId &&
				(() => {
					const booking = bookings.find((b) => b.id === refundingBookingId) || {
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
							onOpenChange={(open) => !open && closeRefundModal()}
							onConfirm={(reason) => handleRefundConfirm(refundingBookingId, reason)}
							bookingDetails={{
								id: booking.id,
								customerName: booking.customerName,
								customerEmail: booking.customerEmail,
								amount: booking.amount,
								currency: booking.currency || 'EUR',
								date: format(booking.bookingDate, 'dd MMM yyyy', { locale: es })
							}}
						/>
					)
				})()}

			{/* Mark As Paid Confirmation Modal */}
			{markingAsPaidBookingId &&
				(() => {
					const booking = bookings.find((b) => b.id === markingAsPaidBookingId) || {
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
							onOpenChange={(open) => !open && closeMarkAsPaidModal()}
							onConfirm={() => {
								handleMarkAsPaid(markingAsPaidBookingId)
							}}
							bookingDetails={{
								id: booking.id,
								customerName: booking.customerName,
								customerEmail: booking.customerEmail,
								amount: booking.amount,
								currency: booking.currency || 'EUR',
								date: format(booking.bookingDate, 'dd MMM yyyy', { locale: es })
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

			{/* Cancel Confirmation Modal */}
			{cancelingBookingId &&
				(() => {
					const booking = bookings.find((b) => b.id === cancelingBookingId)
					const isPaid = booking?.payment_status === 'paid'
					const sendEmailValue = isPaid ? true : shouldSendCancelEmail
					return (
						<CancelConfirmationModal
							isOpen={!!cancelingBookingId}
							onOpenChange={(open) => {
								if (!open) closeCancelBookingModal()
							}}
							onConfirm={async () => {
								const id = cancelingBookingId
								closeCancelBookingModal()
								if (id) {
									await handleCancelBooking(id, { sendEmail: sendEmailValue })
								}
							}}
							isPaid={!!isPaid}
							allowEmailChoice={!isPaid}
							sendEmailSelected={sendEmailValue}
							onSendEmailChange={(checked) => setShouldSendCancelEmail(!!checked)}
						/>
					)
				})()}

			{/* V2: Cancel Series Confirmation Modal */}
			{cancelingSeriesId && (
				<CancelConfirmationModal
					isOpen={!!cancelingSeriesId}
					onOpenChange={(open) => {
						if (!open) closeCancelSeriesModal()
					}}
					onConfirm={async () => {
						await handleConfirmCancelSeries()
					}}
					isPaid={false}
					title="Cancelar evento recurrente"
					description="Se cancelarán todas las citas futuras de esta serie recurrente. Esta acción no se puede deshacer."
				/>
			)}
		</div>
	)
}
