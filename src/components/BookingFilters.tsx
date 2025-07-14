'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import {
	Popover,
	PopoverContent,
	PopoverTrigger
} from '@/components/ui/popover'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Search, RotateCcw, CalendarIcon } from 'lucide-react'

export interface BookingFiltersState {
	customerSearch: string
	statusFilter: 'all' | 'pending' | 'scheduled' | 'completed' | 'canceled'
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
	const [startDateOpen, setStartDateOpen] = useState(false)
	const [endDateOpen, setEndDateOpen] = useState(false)

	const updateFilter = (key: keyof BookingFiltersState, value: any) => {
		onFiltersChange({ ...filters, [key]: value })
	}

	const clearAllFilters = () => {
		onFiltersChange({
			customerSearch: '',
			statusFilter: 'all',
			startDate: '',
			endDate: ''
		})
	}

	const hasActiveFilters =
		filters.customerSearch !== '' ||
		filters.statusFilter !== 'all' ||
		filters.startDate !== '' ||
		filters.endDate !== ''

	// Convert string dates to Date objects for the calendar
	const startDate = filters.startDate
		? new Date(filters.startDate)
		: undefined
	const endDate = filters.endDate ? new Date(filters.endDate) : undefined

	const handleStartDateSelect = (date: Date | undefined) => {
		if (date) {
			const dateString = format(date, 'yyyy-MM-dd')
			updateFilter('startDate', dateString)
			setStartDateOpen(false) // Close popover after selection
		} else {
			updateFilter('startDate', '')
		}
	}

	const handleEndDateSelect = (date: Date | undefined) => {
		if (date) {
			const dateString = format(date, 'yyyy-MM-dd')
			updateFilter('endDate', dateString)
			setEndDateOpen(false) // Close popover after selection
		} else {
			updateFilter('endDate', '')
		}
	}

	return (
		<div className="space-y-6 pt-6">
			{/* Customer Search */}
			<div className="space-y-3">
				<Label>Paciente</Label>
				<div className="relative">
					<Input
						placeholder="Nombre o email..."
						value={filters.customerSearch}
						onChange={(e) =>
							updateFilter('customerSearch', e.target.value)
						}
						className=""
					/>
				</div>
			</div>

			{/* Date Range */}
			<div className="space-y-3">
				<Label>Rango de fechas</Label>
				<div className="space-y-3">
					<div>
						<label className="text-sm text-gray-600 block mb-2">
							Desde
						</label>
						<Popover
							open={startDateOpen}
							onOpenChange={setStartDateOpen}
						>
							<PopoverTrigger asChild>
								<Button
									variant={'outline'}
									className={cn(
										'w-full justify-start text-left font-normal bg-white',
										!startDate && 'text-muted-foreground'
									)}
								>
									<CalendarIcon className="mr-2 h-4 w-4" />
									{startDate
										? format(startDate, 'PPP', {
												locale: es
											})
										: 'Seleccionar fecha'}
								</Button>
							</PopoverTrigger>
							<PopoverContent
								className="w-auto p-0"
								align="start"
							>
								<Calendar
									mode="single"
									selected={startDate}
									onSelect={handleStartDateSelect}
									initialFocus
									locale={es}
								/>
							</PopoverContent>
						</Popover>
					</div>
					<div>
						<label className="text-sm text-gray-600 block mb-2">
							Hasta
						</label>
						<Popover
							open={endDateOpen}
							onOpenChange={setEndDateOpen}
						>
							<PopoverTrigger asChild>
								<Button
									variant={'outline'}
									className={cn(
										'w-full justify-start text-left font-normal bg-white',
										!endDate && 'text-muted-foreground'
									)}
								>
									<CalendarIcon className="mr-2 h-4 w-4" />
									{endDate
										? format(endDate, 'PPP', { locale: es })
										: 'Seleccionar fecha'}
								</Button>
							</PopoverTrigger>
							<PopoverContent
								className="w-auto p-0"
								align="start"
							>
								<Calendar
									mode="single"
									selected={endDate}
									onSelect={handleEndDateSelect}
									initialFocus
									locale={es}
									disabled={(date) =>
										startDate ? date < startDate : false
									}
								/>
							</PopoverContent>
						</Popover>
					</div>
				</div>
			</div>

			{/* Status */}
			<div className="space-y-3">
				<Label>Estado</Label>
				<Select
					value={filters.statusFilter}
					onValueChange={(value) =>
						updateFilter(
							'statusFilter',
							value as
								| 'all'
								| 'pending'
								| 'scheduled'
								| 'completed'
								| 'canceled'
						)
					}
				>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Todas</SelectItem>
						<SelectItem value="pending">
							Pendiente de pago
						</SelectItem>
						<SelectItem value="scheduled">Confirmada</SelectItem>
						<SelectItem value="completed">Completada</SelectItem>
						<SelectItem value="canceled">Cancelada</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Clear Filters Button */}
			{hasActiveFilters && (
				<div className="pt-4 border-t">
					<Button
						variant="ghost"
						onClick={clearAllFilters}
						className="w-full hover:bg-transparent"
					>
						Eliminar filtros
					</Button>
				</div>
			)}
		</div>
	)
}
