# Booking Creation Flow Documentation

## Overview

This document describes the complete booking creation flow in the Coco Scheduling application. The flow handles different billing types, payment processing, and email notifications while maintaining data consistency across multiple systems.

## Architecture

The booking creation uses a **server-side API approach** for security and proper environment variable access:

- **Frontend**: `BookingForm` component → API call
- **Backend**: `/api/bookings/create` → Booking Orchestration Service → Database + Stripe + Email

## Flow Diagram

```
Frontend (BookingForm)
    ↓ POST /api/bookings/create
Server API Route
    ↓ createBookingSimple()
Booking Orchestration Service
    ↓
├── Billing Settings Resolution
├── Booking Creation
├── Bill Creation
├── Payment Processing (if required)
└── Email Sending (if required)
```

## Detailed Flow

### 1. Frontend - BookingForm Component

**Location**: `src/components/BookingForm.tsx`

**3-Step Process**:

1. **Date Selection**: User picks date from calendar
2. **Time Selection**: User selects available time slot
3. **Client & Details**: User selects client and adds notes

**Final Submission**:

- Calls `POST /api/bookings/create` with booking data
- Shows success toast with payment information if applicable
- Closes form and refreshes parent component

### 2. API Route - Server-Side Entry Point

**Location**: `src/app/(apis)/api/bookings/create/route.ts`

**Responsibilities**:

- Authenticates user via server-side Supabase client
- Validates required parameters (clientId, startTime, endTime)
- Calls booking orchestration service with server-side context
- Returns comprehensive booking result

**Input**:

```json
{
	"clientId": "uuid",
	"startTime": "2024-01-15T10:00:00Z",
	"endTime": "2024-01-15T11:00:00Z",
	"notes": "Optional notes",
	"status": "optional status override"
}
```

**Output**:

```json
{
  "success": true,
  "booking": {...},
  "bill": {...},
  "requiresPayment": true,
  "paymentUrl": "https://checkout.stripe.com/..."
}
```

### 3. Booking Orchestration Service

**Location**: `src/lib/bookings/booking-orchestration-service.ts`

**Main Function**: `createBookingSimple(request, supabaseClient)`

#### 3.1 Billing Settings Resolution

**Hierarchy** (in order of precedence):

1. **Client-specific billing settings** (if configured)
2. **User default billing settings** (fallback)
3. **Error** if no billing settings exist

**Database Functions**:

- `getClientBillingSettings(userId, clientId, supabaseClient)`
- `getUserDefaultBillingSettings(userId, supabaseClient)`

#### 3.2 Booking Creation by Type

Based on resolved billing type, calls appropriate function:

##### In-Advance Booking (`billing.type === 'in-advance'`)

**Flow**:

1. Create booking with `status: 'pending'`
2. Create bill with `status: 'pending'`
3. **If amount > 0**:
    - Create Stripe checkout session via Payment Orchestration Service
    - Send consultation bill email with payment link
    - Update bill status to `'sent'` on successful email delivery
4. **If amount = 0**: No payment required, booking confirmed immediately

**Payment Integration**:

- Uses `paymentOrchestrationService.orechestrateConsultationCheckout()`
- Validates practitioner's Stripe account setup
- Creates tracked payment session in database
- Returns checkout URL for client payment

**Email Integration**:

- Uses `sendConsultationBillEmail()` from email service
- Template includes payment link and consultation details
- Only updates bill to 'sent' status if email successfully delivers

##### Right-After Booking (`billing.type === 'right-after'`)

**Flow**:

1. Create booking with `status: 'scheduled'` (confirmed immediately)
2. Create bill with `status: 'pending'`
3. No immediate payment or email sending

##### Monthly Booking (`billing.type === 'monthly'`)

**Flow**:

1. Create booking with `status: 'scheduled'` (confirmed immediately)
2. Create bill with `status: 'pending'`
3. No immediate payment or email sending

### 4. Database Operations

All database functions accept optional `SupabaseClient` parameter for server-side compatibility:

#### Bookings Table

- `createBooking(payload, supabaseClient)` → Creates booking record
- Stores: user_id, client_id, start_time, end_time, status

#### Bills Table

- `createBill(payload, supabaseClient)` → Creates bill record
- `updateBillStatus(billId, status, supabaseClient)` → Updates bill status
- Stores: booking_id, client info, amount, currency, billing_type

#### Supporting Tables

- `getClientById()` → Client information for bill creation
- `getProfileById()` → Practitioner information for emails/payments

### 5. Payment Processing

**Service**: `PaymentOrchestrationService`
**Location**: `src/lib/payments/payment-orchestration-service.ts`

**Method**: `orechestrateConsultationCheckout()`

**Steps**:

1. **Validate Stripe Account**: Checks practitioner has onboarded Stripe Connect account
2. **Create Checkout Session**: Uses Stripe API to generate payment link
3. **Track Payment**: Records payment session in database for monitoring
4. **Return URL**: Provides checkout URL for client redirection

**Database Integration**:

- `getStripeAccountForPayments()` → Validates practitioner setup
- `createPaymentSession()` → Tracks payment attempt

### 6. Email Service

**Service**: Email Service
**Location**: `src/lib/emails/email-service.ts`

**Method**: `sendConsultationBillEmail()`

**Template**: Uses existing consultation bill template with `billingTrigger: 'before_consultation'`

**Email Content**:

- Client name and consultation details
- Practitioner information and photo
- Payment amount and currency
- Payment link (Stripe checkout URL)
- Professional email styling

## Error Handling

### Graceful Degradation

- **Payment errors**: Booking still created, payment can be retried
- **Email errors**: Booking and bill created, email can be resent manually
- **Database errors**: Complete rollback, user informed of failure

### Error Logging

- All errors logged with context for debugging
- Payment and email failures logged but don't break booking creation
- Database errors bubble up to prevent partial state

## Key Design Decisions

### 1. Server-Side Architecture

- **Why**: Secure environment variable access, proper authentication context
- **Benefit**: Stripe operations and email sending work reliably

### 2. Database Function Flexibility

- **Pattern**: Optional `SupabaseClient` parameter with fallback
- **Benefit**: Backward compatibility + server-side support
- **Usage**: `const client = supabaseClient || defaultClient`

### 3. Billing Settings Hierarchy

- **Why**: Allows per-client customization while having sensible defaults
- **Benefit**: Flexible billing without complex configuration requirements

### 4. Bill-First Approach

- **Order**: Create booking → Create bill → Process payment → Send email
- **Benefit**: Better audit trail and data consistency

## Integration Points

### Stripe Webhook Handler

**Location**: `src/app/(apis)/api/webhooks/stripe/route.ts`

**On Successful Payment**:

- Updates booking status: `'pending'` → `'scheduled'`
- Updates bill status: `'sent'` → `'paid'`
- Finds bills by booking_id from payment session

### Frontend Components

- **BookingForm**: Main booking creation interface
- **BookingsTable**: Displays booking and payment status
- **Dashboard**: Shows booking metrics and management

## Future Enhancements

### Email Tracking Table

- Track all email sends with status and timestamps
- Enable email resending and delivery monitoring
- Integrate with booking flow for better visibility

### Success Flow Improvements

- Enhanced post-payment confirmation flow
- Automatic calendar invitations
- Client confirmation emails

### Error Recovery

- Retry mechanisms for failed payments/emails
- Manual intervention tools for administrators
- Better error reporting and monitoring
