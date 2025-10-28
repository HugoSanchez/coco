import type { Metadata } from 'next'
import BookingPageClient from './BookingPageClient'

export const dynamic = 'force-dynamic'

async function fetchPublicProfile(username: string) {
	try {
		const base = process.env.NEXT_PUBLIC_BASE_URL || ''
		const res = await fetch(`${base}/api/public/profile?username=${encodeURIComponent(username)}`, {
			cache: 'no-store'
		})
		if (!res.ok) return null
		return await res.json()
	} catch (_) {
		return null
	}
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
	const profile = await fetchPublicProfile(params.username)
	const practitionerName = profile?.full_name || profile?.name || params.username
	const description = `Utiliza este enlace para reservar tu cita con ${practitionerName} en Coco.`
	const title = `${practitionerName} · Reserva tu cita`
	const ogImage = profile?.profile_picture_url || '/coco-logo-small.png'

	return {
		title,
		description,
		openGraph: {
			title,
			description,
			url: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/${params.username}`,
			siteName: 'Coco App',
			locale: 'es_ES',
			type: 'website',
			images: [{ url: ogImage }]
		}
	}
}

export default function Page({ params }: { params: { username: string } }) {
	return <BookingPageClient username={params.username} />
}
