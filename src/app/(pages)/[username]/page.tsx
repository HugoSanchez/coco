import type { Metadata } from 'next'
import { headers } from 'next/headers'
import BookingPageClient from './BookingPageClient'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getProfileByUsername } from '@/lib/db/profiles'

export const dynamic = 'force-dynamic'

async function loadPublicProfile(username: string) {
	try {
		const service = createServiceRoleClient()
		const profile = await getProfileByUsername(username, service as any)
		return profile
	} catch (_) {
		return null
	}
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
	const profile = await loadPublicProfile(params.username)
	const practitionerName = (profile as any)?.full_name || (profile as any)?.name || params.username
	const description = `Utiliza este enlace para reservar tu cita con ${practitionerName} en Coco.`
	const title = `${practitionerName} · Reserva tu cita`
	const ogImage = (profile as any)?.profile_picture_url || '/coco-logo-small.png'

	// Build absolute URL for OG tags
	const hdrs = headers()
	const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || 'itscoco.app'
	const proto = hdrs.get('x-forwarded-proto') || 'https'
	const absoluteUrl = `${proto}://${host}/${params.username}`

	return {
		title,
		description,
		openGraph: {
			title,
			description,
			url: absoluteUrl,
			siteName: 'Coco App',
			locale: 'es_ES',
			type: 'website',
			images: [{ url: ogImage }]
		},
		twitter: {
			card: 'summary_large_image',
			title,
			description,
			images: [ogImage]
		}
	}
}

export default function Page({ params }: { params: { username: string } }) {
	return <BookingPageClient username={params.username} />
}
