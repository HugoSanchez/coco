import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBookingById } from '@/lib/db/bookings'
import { getBillForBookingAndMarkAsPaid } from '@/lib/db/bills'
import { ensureInvoiceForBillOnPayment } from '@/lib/invoicing/invoice-orchestration'
import * as Sentry from '@sentry/nextjs'

/**
 * POST /api/bookings/[id]/mark-paid
 *
 * Manually marks a booking's bill as paid by:
 * 1. Finding the associated bill for the booking
 * 2. Updating bill status to 'paid'
 * 3. Setting paid_at timestamp
 *
 * This endpoint only handles payment status and does NOT affect:
 * - Booking status (pending/scheduled/completed)
 * - Calendar events or invitations
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
	try {
		const supabase = createClient()

		// Check authentication
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()

		if (authError || !user) {
			Sentry.captureMessage('bookings:mark-paid unauthorized', {
				level: 'warning',
				tags: { component: 'api:bookings' },
				extra: { bookingId: params.id }
			})
			return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
		}

		const bookingId = params.id

		// 1. Get the booking to verify ownership
		const booking = await getBookingById(bookingId, supabase)

		if (!booking) {
			Sentry.captureMessage('bookings:mark-paid not_found', {
				level: 'warning',
				tags: { component: 'api:bookings' },
				extra: { bookingId }
			})
			return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
		}

		// Verify user owns this booking
		if (booking.user_id !== user.id) {
			Sentry.captureMessage('bookings:mark-paid unauthorized_owner', {
				level: 'warning',
				tags: { component: 'api:bookings' },
				extra: { bookingId, userId: user.id }
			})
			return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
		}

		// 2. Mark associated bill as paid and retrieve it
		let paidBill: any = null
		try {
			paidBill = await getBillForBookingAndMarkAsPaid(bookingId, supabase)
		} catch (billError) {
			console.error(`Error marking bill as paid for booking ${bookingId}:`, billError)
			Sentry.captureException(billError, {
				tags: { component: 'api:bookings', method: 'mark-paid' },
				extra: { bookingId }
			})

			// Check if it's because no bill exists
			if (billError instanceof Error && billError.message.includes('not found')) {
				return NextResponse.json({ error: 'No bill found for this booking' }, { status: 404 })
			}

			// Check if bill is already paid
			if (billError instanceof Error && billError.message.includes('already paid')) {
				return NextResponse.json({ error: 'Bill is already marked as paid' }, { status: 400 })
			}

			// Other bill errors
			return NextResponse.json(
				{
					error: 'Failed to mark as paid',
					details: billError instanceof Error ? billError.message : 'Unknown error'
				},
				{ status: 500 }
			)
		}

		// 3. Ensure invoice exists/finalized for this paid bill (manual payments)
		try {
			if (paidBill && paidBill.id) {
				await ensureInvoiceForBillOnPayment(
					{
						billId: paidBill.id,
						userId: booking.user_id,
						snapshot: {
							clientId: paidBill.client_id ?? null,
							clientName: paidBill.client_name || 'Paciente',
							clientEmail: paidBill.client_email || '',
							amount: Number(paidBill.amount || 0),
							currency: paidBill.currency || 'EUR'
						},
						receiptUrl: null,
						stripeSessionId: null
					},
					supabase
				)
			}
		} catch (invErr) {
			Sentry.captureException(invErr, {
				tags: { component: 'api:bookings', method: 'mark-paid', stage: 'ensure_invoice' },
				extra: { bookingId, billId: paidBill?.id }
			})
		}

		return NextResponse.json({
			success: true,
			message: 'Payment marked as received successfully',
			booking: {
				id: bookingId
			}
		})
	} catch (error) {
		console.error('Mark as paid error:', error)
		Sentry.captureException(error, {
			tags: { component: 'api:bookings', method: 'mark-paid' },
			extra: { bookingId: params.id }
		})
		return NextResponse.json(
			{
				error: 'Failed to mark as paid',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
