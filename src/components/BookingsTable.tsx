'use client'

import { useState, useMemo } from 'react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MoreHorizontal,
  Calendar,
  X,
  Filter,
  Search
} from "lucide-react"
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { SideSheet } from './SideSheet'
import { BookingFilters, BookingFiltersState } from './BookingFilters'

export interface Booking {
  id: string
  customerName: string
  customerEmail: string
  bookingDate: Date
  billingStatus: 'pending' | 'billed'
  paymentStatus: 'pending' | 'paid'
  amount: number
}

interface BookingsTableProps {
  bookings: Booking[]
  loading?: boolean
  onStatusChange: (bookingId: string, type: 'billing' | 'payment', status: string) => void
  onCancelBooking: (bookingId: string) => void
}

export function BookingsTable({
  bookings,
  loading = false,
  onStatusChange,
  onCancelBooking
}: BookingsTableProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filters, setFilters] = useState<BookingFiltersState>({
    customerSearch: '',
    billingFilter: 'all',
    paymentFilter: 'all',
    startDate: '',
    endDate: ''
  })

  // Filtered bookings logic
  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      // Customer search filter
      const matchesCustomer = filters.customerSearch === '' ||
        booking.customerName.toLowerCase().includes(filters.customerSearch.toLowerCase()) ||
        booking.customerEmail.toLowerCase().includes(filters.customerSearch.toLowerCase())

      // Billing status filter
      const matchesBilling = filters.billingFilter === 'all' || booking.billingStatus === filters.billingFilter

      // Payment status filter
      const matchesPayment = filters.paymentFilter === 'all' || booking.paymentStatus === filters.paymentFilter

      // Date range filter
      let matchesDate = true
      if (filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate)
        const end = new Date(filters.endDate)
        matchesDate = booking.bookingDate >= start && booking.bookingDate <= end
      } else if (filters.startDate) {
        const start = new Date(filters.startDate)
        matchesDate = booking.bookingDate >= start
      } else if (filters.endDate) {
        const end = new Date(filters.endDate)
        matchesDate = booking.bookingDate <= end
      }

      return matchesCustomer && matchesBilling && matchesPayment && matchesDate
    })
  }, [bookings, filters])

  const hasActiveFilters =
    filters.customerSearch !== '' ||
    filters.billingFilter !== 'all' ||
    filters.paymentFilter !== 'all' ||
    filters.startDate !== '' ||
    filters.endDate !== ''

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 relative">
      {/* Overlay when sidebar is open */}
      {isFilterOpen && (
        <div className="fixed inset-0 bg-black/20 z-40" />
      )}

      {/* Header with Filter Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Latest Bookings</h2>
          <div className="text-sm text-gray-500">
            {hasActiveFilters ? (
              <>
                Showing <span className="font-medium text-gray-900">{filteredBookings.length}</span> of{' '}
                <span className="font-medium text-gray-900">{bookings.length}</span> bookings
              </>
            ) : (
              `${bookings.length} total bookings`
            )}
          </div>
        </div>

        <Button
          variant={hasActiveFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setIsFilterOpen(true)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
              {[
                filters.customerSearch && 1,
                filters.billingFilter !== 'all' && 1,
                filters.paymentFilter !== 'all' && 1,
                filters.startDate && 1,
                filters.endDate && 1
              ].filter(Boolean).length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="font-semibold">Customer</TableHead>
              <TableHead className="hidden md:table-cell font-semibold">Date</TableHead>
              <TableHead className="hidden sm:table-cell font-semibold">Billing</TableHead>
              <TableHead className="hidden sm:table-cell font-semibold">Payment</TableHead>
              <TableHead className="text-right font-semibold">Amount</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="text-gray-400">
                    {bookings.length === 0 ? (
                      <div>
                        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No bookings found</p>
                      </div>
                    ) : (
                      <div>
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No bookings match your filters</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsFilterOpen(true)}
                          className="mt-2 text-blue-600 hover:text-blue-800"
                        >
                          Adjust filters
                        </Button>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredBookings.map((booking) => (
                <TableRow key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                  <TableCell>
                    <div className="font-medium">{booking.customerName}</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">
                      {booking.customerEmail}
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{format(booking.bookingDate, 'dd MMM yyyy', { locale: es })}</span>
                    </div>
                  </TableCell>

                  <TableCell className="hidden sm:table-cell">
                    <Badge
                      variant="outline"
                      className={`cursor-pointer transition-all duration-200 px-3 py-1 ${
                        booking.billingStatus === 'billed'
                          ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
                          : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                      }`}
                      onClick={() => {
                        const newStatus = booking.billingStatus === 'pending' ? 'billed' : 'pending'
                        onStatusChange(booking.id, 'billing', newStatus)
                      }}
                    >
                      {booking.billingStatus === 'billed' ? 'Enviada' : 'Pendiente'}
                    </Badge>
                  </TableCell>

                  <TableCell className="hidden sm:table-cell">
                    <Badge
                      variant="outline"
                      className={`cursor-pointer transition-all duration-200 px-3 py-1 ${
                        booking.paymentStatus === 'paid'
                          ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
                          : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                      }`}
                      onClick={() => {
                        const newStatus = booking.paymentStatus === 'pending' ? 'paid' : 'pending'
                        onStatusChange(booking.id, 'payment', newStatus)
                      }}
                    >
                      {booking.paymentStatus === 'paid' ? 'Realizado' : 'Pendiente'}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right font-medium">
                    €{booking.amount.toFixed(2)}
                  </TableCell>

                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onCancelBooking(booking.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel Appointment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Filter Sidebar */}
      <SideSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filter Bookings"
        description="Refine your booking results"
      >
        <BookingFilters
          filters={filters}
          onFiltersChange={setFilters}
        />
      </SideSheet>
    </div>
  )
}
