'use client'

import { useEffect, useState, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/use-toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClientList } from '@/components/ClientList'
import { BookingsTable, Booking } from '@/components/BookingsTable'
import { SideSheet } from '@/components/SideSheet'
import {
	BookingFilters,
	BookingFiltersState
} from '@/components/BookingFilters'
import {
	Activity,
	FilterIcon,
	FilterX,
	CircleUser,
	CreditCard,
	DollarSign,
	Search,
	Users,
	Plus,
	ArrowUpRight
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { getClientsForUser, Client } from '@/lib/db/clients'
import {
	getBookingsForUser,
	updateBookingBillingStatus,
	updateBookingPaymentStatus,
	updateBookingStatus,
	BookingWithClient
} from '@/lib/db/bookings'
import { BookingForm } from '@/components/BookingForm'
import { Spinner } from '@/components/ui/spinner'
import { TestApiButton } from '@/components/TestApiButton'

// Transform database booking to component booking format
const transformBooking = (dbBooking: any): Booking => ({
	id: dbBooking.id,
	customerName: dbBooking.client.name,
	customerEmail: dbBooking.client.email,
	bookingDate: new Date(dbBooking.start_time),
	billingStatus: dbBooking.billing_status === 'billed' ? 'billed' : 'pending',
	paymentStatus: dbBooking.payment_status === 'paid' ? 'paid' : 'pending',
	amount: 150.0 // TODO: Add amount field to database or calculate from billing settings
})

export default function Dashboard() {
	const { user, profile, loading } = useUser()
	const [clients, setClients] = useState<Client[]>([])
	const [loadingClients, setLoadingClients] = useState(true)
	const [bookings, setBookings] = useState<Booking[]>([])
	const [loadingBookings, setLoadingBookings] = useState(false)
	const [isFilterOpen, setIsFilterOpen] = useState(false)
	const [isNewBookingOpen, setIsNewBookingOpen] = useState(false)
	const [filters, setFilters] = useState<BookingFiltersState>({
		customerSearch: '',
		billingFilter: 'all',
		paymentFilter: 'all',
		startDate: '',
		endDate: ''
	})
	const { toast } = useToast()
	const router = useRouter()

	// Filtered bookings logic
	const filteredBookings = useMemo(() => {
		return bookings.filter((booking) => {
			// Customer search filter
			const matchesCustomer =
				filters.customerSearch === '' ||
				booking.customerName
					.toLowerCase()
					.includes(filters.customerSearch.toLowerCase()) ||
				booking.customerEmail
					.toLowerCase()
					.includes(filters.customerSearch.toLowerCase())

			// Billing status filter
			const matchesBilling =
				filters.billingFilter === 'all' ||
				booking.billingStatus === filters.billingFilter

			// Payment status filter
			const matchesPayment =
				filters.paymentFilter === 'all' ||
				booking.paymentStatus === filters.paymentFilter

			// Date range filter
			let matchesDate = true
			if (filters.startDate && filters.endDate) {
				const start = new Date(filters.startDate)
				const end = new Date(filters.endDate)
				matchesDate =
					booking.bookingDate >= start && booking.bookingDate <= end
			} else if (filters.startDate) {
				const start = new Date(filters.startDate)
				matchesDate = booking.bookingDate >= start
			} else if (filters.endDate) {
				const end = new Date(filters.endDate)
				matchesDate = booking.bookingDate <= end
			}

			return (
				matchesCustomer &&
				matchesBilling &&
				matchesPayment &&
				matchesDate
			)
		})
	}, [bookings, filters])

	useEffect(() => {
		console.log('I rendered')
		const fetchBookings = async () => {
			if (!user) return

			try {
				setLoadingBookings(true)
				const dbBookings = await getBookingsForUser(user.id)
				const transformedBookings = dbBookings.map(transformBooking)
				setBookings(transformedBookings)
			} catch (error) {
				console.error('Error loading bookings:', error)
				toast({
					title: 'Error',
					description: 'Failed to load bookings.',
					color: 'error'
				})
			} finally {
				setLoadingBookings(false)
			}
		}

		if (user) {
			fetchBookings()
		}
	}, [user, toast])

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

	const handleStatusChange = async (
		bookingId: string,
		type: 'billing' | 'payment',
		status: string
	) => {
		try {
			// Update local state immediately for better UX
			setBookings((prev) =>
				prev.map((booking) =>
					booking.id === bookingId
						? {
								...booking,
								[type === 'billing'
									? 'billingStatus'
									: 'paymentStatus']: status
						  }
						: booking
				)
			)

			// Update status in database
			if (type === 'billing') {
				await updateBookingBillingStatus(
					bookingId,
					status as 'pending' | 'billed' | 'cancelled' | 'failed'
				)
			} else {
				await updateBookingPaymentStatus(
					bookingId,
					status as 'pending' | 'paid' | 'overdue' | 'cancelled'
				)
			}

			toast({
				title: 'Status updated',
				description: `${
					type === 'billing' ? 'Billing' : 'Payment'
				} status updated to ${status}`,
				variant: 'default'
			})
		} catch (error) {
			// Revert local state on error
			setBookings((prev) =>
				prev.map((booking) =>
					booking.id === bookingId
						? {
								...booking,
								[type === 'billing'
									? 'billingStatus'
									: 'paymentStatus']:
									type === 'billing'
										? booking.billingStatus
										: booking.paymentStatus
						  }
						: booking
				)
			)

			toast({
				title: 'Error',
				description: 'Failed to update status. Please try again.',
				variant: 'destructive'
			})
		}
	}

	const handleCancelBooking = async (bookingId: string) => {
		try {
			// Update booking status to cancelled
			await updateBookingStatus(bookingId, 'cancelled')

			// Remove from local state (or update status to show as cancelled)
			setBookings((prev) =>
				prev.filter((booking) => booking.id !== bookingId)
			)

			toast({
				title: 'Booking cancelled',
				description: 'The appointment has been cancelled successfully.',
				variant: 'default'
			})
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Failed to cancel booking. Please try again.',
				variant: 'destructive'
			})
		}
	}

	useEffect(() => {
		if (!loading && !user) {
			router.push('/login')
		}
	}, [loading, user, router])

	if (loading) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Spinner size="lg" />
			</div>
		)
	}

	if (!user) {
		return null // Render nothing while the redirect occurs
	}

	return (
		<div className="flex min-h-screen w-full flex-col py-24">
			<header className="flex items-center justify-between px-4 md:px-16 pb-6">
				<div className="flex flex-col">
					<h1 className="text-3xl font-bold">
						Hola {profile?.name},
					</h1>
					<h3 className="text-2xl">este es tu dashboard</h3>
				</div>
				<div className="flex gap-2">
					<TestApiButton />
					<Button
						className="tracking-wide text-sm bg-teal-400 hover:bg-teal-400 hover:opacity-80"
						onClick={() => setIsNewBookingOpen(true)}
					>
						<Plus className="h-5 w-5 mr-2" />
						Nueva Cita
					</Button>
				</div>
			</header>
			<main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:px-16">
				<div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
					<Card x-chunk="dashboard-01-chunk-0">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Revenue
							</CardTitle>
							<DollarSign className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">$5,231.89</div>
							<p className="text-xs text-muted-foreground">
								+20.1% from last month
							</p>
						</CardContent>
					</Card>
					<Card x-chunk="dashboard-01-chunk-1">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Booking rate
							</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">87,22%</div>
							<p className="text-xs text-muted-foreground">
								+180.1% from last month
							</p>
						</CardContent>
					</Card>
					<Card x-chunk="dashboard-01-chunk-2">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Available slots
							</CardTitle>
							<CreditCard className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">+12</div>
							<p className="text-xs text-muted-foreground">
								+19% from last month
							</p>
						</CardContent>
					</Card>
					<Card x-chunk="dashboard-01-chunk-3">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Active Clients
							</CardTitle>
							<Activity className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">+57</div>
							<p className="text-xs text-muted-foreground">
								+201 since last hour
							</p>
						</CardContent>
					</Card>
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
								bookings={filteredBookings}
								loading={loadingBookings}
								onStatusChange={handleStatusChange}
								onCancelBooking={handleCancelBooking}
							/>
						</CardContent>
					</Card>
					<div x-chunk="dashboard-01-chunk-5">
						<ClientList
							clients={clients as Client[]}
							loading={loadingClients}
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
								const dbBookings = await getBookingsForUser(
									user.id
								)
								const transformedBookings =
									dbBookings.map(transformBooking)
								setBookings(transformedBookings)
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
		</div>
	)
}
