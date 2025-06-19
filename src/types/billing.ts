// Core billing types
export type BillingType = 'recurring' | 'consultation_based' | 'project_based'
export type BillingFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type BillingTrigger = 'after_consultation' | 'before_consultation'
export type BillingStatus = 'pending' | 'sent' | 'paid' | 'cancelled'

// Unified billing configuration (replaces scattered billing config)
export interface BillingConfiguration {
	id: string
	user_id: string
	client_id?: string // NULL for user defaults
	booking_id?: string // NULL for user/client configurations

	// Billing configuration
	billing_amount: number
	billing_type: BillingType
	billing_frequency?: BillingFrequency
	billing_trigger?: BillingTrigger
	billing_advance_days: number

	// Configuration metadata
	is_active: boolean
	notes?: string

	created_at: string
	updated_at: string
}

// Enhanced booking with billing configuration
export interface BookingWithBilling {
	id: string
	client_id: string
	user_id: string

	// Booking details
	booker_name: string | null
	booker_email: string | null
	start_time: string
	end_time: string | null
	status: string | null
	notes?: string

	// Client info (for display)
	client?: {
		id: string
		name: string
		email: string
	}

	// Billing configuration for this booking (guaranteed to exist)
	billing_configuration: BillingConfiguration

	// Billing record (if bill was sent)
	billing_record?: BillingRecord

	created_at: string
}

// Billing execution record
export interface BillingRecord {
	id: string
	booking_id: string
	billing_configuration_id: string
	user_id: string

	// What was billed (snapshot at time of billing)
	amount: number
	status: BillingStatus

	// Timeline
	due_date?: string
	sent_date?: string
	paid_date?: string

	// Automation
	email_sent: boolean
	invoice_number?: string
	notes?: string

	created_at: string
	updated_at: string
}

// Helper types for creating billing configurations
export interface CreateBillingConfigurationInput {
	user_id: string
	client_id?: string
	booking_id?: string
	billing_amount: number
	billing_type: BillingType
	billing_frequency?: BillingFrequency
	billing_trigger?: BillingTrigger
	billing_advance_days?: number
	notes?: string
}

// Helper types for billing operations
export interface CreateBillingRecordInput {
	booking_id: string
	billing_configuration_id: string
	amount: number
	due_date?: string
	notes?: string
}

export interface UpdateBillingRecordInput {
	status?: BillingStatus
	sent_date?: string
	paid_date?: string
	invoice_number?: string
	notes?: string
}

// Query helpers for the unified structure
export interface BillingConfigurationQuery {
	// Get configuration for a specific booking (with fallbacks)
	getConfigurationForBooking: (
		bookingId: string
	) => Promise<BillingConfiguration>
	// Get or create configuration for a client
	getClientConfiguration: (clientId: string) => Promise<BillingConfiguration>
	// Get user default configuration
	getUserDefaultConfiguration: (
		userId: string
	) => Promise<BillingConfiguration>
}
