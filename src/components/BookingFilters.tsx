'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  RotateCcw
} from "lucide-react"

export interface BookingFiltersState {
  customerSearch: string
  billingFilter: 'all' | 'pending' | 'billed'
  paymentFilter: 'all' | 'pending' | 'paid'
  startDate: string
  endDate: string
}

interface BookingFiltersProps {
  filters: BookingFiltersState
  onFiltersChange: (filters: BookingFiltersState) => void
}

export function BookingFilters({
  filters,
  onFiltersChange
}: BookingFiltersProps) {

  const updateFilter = (key: keyof BookingFiltersState, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearAllFilters = () => {
    onFiltersChange({
      customerSearch: '',
      billingFilter: 'all',
      paymentFilter: 'all',
      startDate: '',
      endDate: ''
    })
  }

  const hasActiveFilters =
    filters.customerSearch !== '' ||
    filters.billingFilter !== 'all' ||
    filters.paymentFilter !== 'all' ||
    filters.startDate !== '' ||
    filters.endDate !== ''

  return (
    <div className="space-y-6 pt-6">
      {/* Customer Search */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Search Customer</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Name or email..."
            value={filters.customerSearch}
            onChange={(e) => updateFilter('customerSearch', e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Date Range</h3>
        <div className="space-y-2">
          <div>
            <label className="text-sm text-gray-600 block mb-1">From</label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => updateFilter('startDate', e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">To</label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => updateFilter('endDate', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Billing Status */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Billing Status</h3>
        <Select
          value={filters.billingFilter}
          onValueChange={(value) => updateFilter('billingFilter', value as 'all' | 'pending' | 'billed')}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All billing</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="billed">Billed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payment Status */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Payment Status</h3>
        <Select
          value={filters.paymentFilter}
          onValueChange={(value) => updateFilter('paymentFilter', value as 'all' | 'pending' | 'paid')}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payment</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={clearAllFilters}
            className="w-full"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  )
}
