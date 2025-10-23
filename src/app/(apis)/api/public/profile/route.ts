import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getProfileByUsername } from '@/lib/db/profiles'
import { getMeetingDuration } from '@/lib/db/schedules'
import { getUserDefaultBillingSettings } from '@/lib/db/billing-settings'

export const dynamic = 'force-dynamic'

/**
 * Public Profile Endpoint
 * ------------------------------------------------------------
 * PURPOSE
 * - Return the public info required by the booking page: practitioner
 *   profile data, schedule duration and default pricing.
 *
 * AUTHZ
 * - Public endpoint.
 *
 * USAGE
 * - GET /api/public/profile?username=:username
 */

export async function GET(request: NextRequest) {
	try {
		// ------------------------------------------------------------
		// 1) Parse & validate input
		// ------------------------------------------------------------
		const { searchParams } = new URL(request.url)
		const username = searchParams.get('username')
		if (!username) return NextResponse.json({ error: 'missing_username' }, { status: 400 })

		const service = createServiceRoleClient()

		// ------------------------------------------------------------
		// 2) Resolve profile by username (public fields only)
		// ------------------------------------------------------------
		const profile = await getProfileByUsername(username, service as any)
		if (!profile) return NextResponse.json({ error: 'not_found' }, { status: 404 })

		// ------------------------------------------------------------
		// 3) Load schedule duration (minutes)
		// ------------------------------------------------------------
		const meetingDuration = await getMeetingDuration(profile.id, service as any)

		// ------------------------------------------------------------
		// 4) Load default pricing settings (amounts + per-type durations)
		// ------------------------------------------------------------
		const billingDefaults = await getUserDefaultBillingSettings(profile.id, service as any)

		// ------------------------------------------------------------
		// 5) Shape response payload
		// ------------------------------------------------------------
		const response = {
			id: profile.id,
			name: profile.name,
			last_name: (profile as any)?.last_name ?? null,
			full_name: (profile as any)?.full_name ?? (profile.name || null),
			description: profile.description,
			profile_picture_url: profile.profile_picture_url,
			schedules: {
				meeting_duration: meetingDuration ?? 60
			},
			pricing: {
				amount: billingDefaults?.billing_amount ?? 0,
				currency: billingDefaults?.currency ?? 'EUR',
				first_consultation_amount: billingDefaults?.first_consultation_amount ?? null,
				meeting_duration_min: billingDefaults?.meeting_duration_min ?? 60,
				first_meeting_duration_min: billingDefaults?.first_meeting_duration_min ?? null
			}
		}

		return NextResponse.json(response)
	} catch (e) {
		console.error('public profile error', e)
		return NextResponse.json({ error: 'server_error' }, { status: 500 })
	}
}
