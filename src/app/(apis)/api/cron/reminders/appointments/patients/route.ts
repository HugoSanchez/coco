import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { getBookingsForDateRangeAllUsersPaged } from '@/lib/db/bookings'
import { getBillsForBooking } from '@/lib/db/bills'
import { createEmailCommunication } from '@/lib/db/email-communications'
import { sendAppointmentReminderEmail } from '@/lib/emails/email-service'
import { getProfilesByIds } from '@/lib/db/profiles'

// Force dynamic because this uses environment variables and server-side IO
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/send-appointment-reminders
 *
 * PURPOSE
 * -------
 * Daily cron job that sends appointment reminders to patients who have
 * a booking scheduled for TODAY in Europe/Madrid timezone.
 *
 * SECURITY
 * --------
 * Protected by a bearer token (CRON_SECRET) passed in Authorization header.
 *
 * STEPS OVERVIEW
 * 1) Authenticate request via CRON_SECRET
 * 2) Compute today's window [startOfDay, endOfDay] in Europe/Madrid (CET/CEST)
 * 3) Fetch bookings within the window (status pending/scheduled, not canceled)
 *    in paged batches with a time budget
 * 4) For each booking, ensure idempotency (skip if already reminded today)
 * 5) Determine unpaid status and payment link URL
 * 6) Send email with small concurrency to use time efficiently
 * 7) Log email in email_communications
 */
export async function GET(request: Request) {
	///////////////////////////////////////////////////////////////
	///// Step 0: Authenticate request
	///////////////////////////////////////////////////////////////
	const auth = process.env.CRON_SECRET
	const header = request.headers.get('authorization')
	if (
		!auth ||
		!header?.startsWith('Bearer ') ||
		header.split(' ')[1] !== auth
	) {
		return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
	}

	///////////////////////////////////////////////////////////////
	///// Step 1: Initialize clients and compute today's window
	///////////////////////////////////////////////////////////////
	const supabase = createServiceRoleClient()

	// Compute Europe/Madrid day window without relying on newer helpers
	// 1) Get today's date string in the target TZ
	// 2) Get the numeric offset for the TZ (e.g., +02:00 in summer)
	// 3) Construct offset-aware local strings and let Date parse to UTC
	// 4) Use toISOString() for DB filtering
	const now = new Date()
	const tz = 'Europe/Madrid'
	const todayStr = formatInTimeZone(now, tz, 'yyyy-MM-dd')
	const offset = formatInTimeZone(now, tz, 'xxx') // e.g., +01:00 or +02:00
	const nowLocal = formatInTimeZone(now, tz, "yyyy-MM-dd'T'HH:mm:ss")
	const startIso = new Date(`${nowLocal}${offset}`).toISOString()
	const endIso = new Date(`${todayStr}T23:59:59.999${offset}`).toISOString()

	///////////////////////////////////////////////////////////////
	///// Step 2 + 3: Paged processing with small concurrency
	///////////////////////////////////////////////////////////////
	const PAGE_SIZE = 100 // Max items per page
	const CONCURRENCY = 2 // Emails sent in parallel per chunk (respect provider rate limits)
	const CHUNK_DELAY_MS = 650 // Delay between chunks to stay under ~2 req/s
	const SOFT_DEADLINE_MS = 50_000 // Stop before platform timeout
	const startTs = Date.now()

	let cursorStartTime: string | null = null
	let cursorId: string | null = null
	let picked = 0
	let sent = 0
	let skipped = 0
	let failed = 0

	while (true) {
		const elapsed = Date.now() - startTs
		if (elapsed > SOFT_DEADLINE_MS) break

		const { items, nextCursor } =
			await getBookingsForDateRangeAllUsersPaged(
				startIso,
				endIso,
				PAGE_SIZE,
				cursorStartTime,
				cursorId,
				supabase
			)

		if (!items.length) break
		picked += items.length

		// Fetch practitioner profiles for this page in one go (avoid N+1)
		const userIds = Array.from(new Set(items.map((b) => b.user_id)))
		const profiles = await getProfilesByIds(userIds, supabase)
		const profileById = new Map(profiles.map((p: any) => [p.id, p]))

		for (let i = 0; i < items.length; i += CONCURRENCY) {
			const chunk = items.slice(i, i + CONCURRENCY)
			await Promise.allSettled(
				chunk.map(async (booking) => {
					try {
						const client = (booking as any).client

						// Guard: essential fields
						if (
							!client ||
							!client.email ||
							!client.name ||
							!booking.start_time
						) {
							skipped += 1
							return
						}

						// No need to check idempotency here; query already excludes

						// No per-booking DB checks beyond the page-level set

						// Payment link (only when unpaid)
						const bills = await getBillsForBooking(
							booking.id,
							supabase
						)
						const payableBill = bills.find(
							(b) => b.status === 'pending' || b.status === 'sent'
						)
						const paymentUrl = payableBill
							? `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/${booking.id}`
							: undefined

						// Localized time for Europe/Madrid (e.g., 09:30)
						const displayTime = formatInTimeZone(
							new Date(booking.start_time),
							tz,
							'HH:mm',
							{ locale: es }
						)

						// Send
						const emailResult = await sendAppointmentReminderEmail({
							to: client.email,
							patientName: client.name,
							practitionerName:
								profileById.get(booking.user_id)?.name ||
								'Tu profesional',
							displayTime,
							paymentUrl
						})

						// Log outcome
						await createEmailCommunication(
							{
								user_id: booking.user_id,
								client_id: client.id,
								email_type: 'appointment_reminder',
								recipient_email: client.email,
								recipient_name: client.name,
								subject: 'Recordatorio de consulta',
								booking_id: booking.id,
								status: emailResult.success ? 'sent' : 'failed',
								error_message: emailResult.success
									? null
									: emailResult.error || 'unknown'
							},
							supabase
						)

						if (emailResult.success) sent += 1
						else failed += 1
					} catch {
						failed += 1
					}
				})
			)

			// Throttle between chunks to respect email provider rate limits
			if (i + CONCURRENCY < items.length) {
				await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS))
			}

			// Respect time budget between chunks
			const loopElapsed = Date.now() - startTs
			if (loopElapsed > SOFT_DEADLINE_MS) break
		}

		if (!nextCursor) break
		cursorStartTime = nextCursor.startTime
		cursorId = nextCursor.id
	}

	///////////////////////////////////////////////////////////////
	///// Step 4: Return summary
	///////////////////////////////////////////////////////////////
	return NextResponse.json({
		window: { startIso, endIso },
		counts: { picked, sent, skipped, failed }
	})
}
