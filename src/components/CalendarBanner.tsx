'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'

export default function CalendarBanner() {
	const { user, calendarConnected, checkCalendarConnection } = useUser()

	// Local dismissal state (session-only)
	const [dismissed, setDismissed] = useState(false)

	// Persistent dismissal ("don't show again") stored per user
	const storageKey = useMemo(
		() => (user ? `coco_calendar_banner_dismissed_v1_${user.id}` : ''),
		[user]
	)
	const [persistDismissed, setPersistDismissed] = useState(false)

	useEffect(() => {
		if (!storageKey) return
		try {
			const saved = localStorage.getItem(storageKey)
			setPersistDismissed(saved === 'true')
		} catch {}
	}, [storageKey])

	// Ensure we have the latest status when component mounts
	useEffect(() => {
		if (user && calendarConnected == null) {
			checkCalendarConnection()
		}
	}, [user, calendarConnected, checkCalendarConnection])

	if (!user) return null
	if (persistDismissed || dismissed) return null
	if (calendarConnected !== false) return null

	return (
		<div className="fixed top-0 left-0 right-0 z-20">
			<div className="w-full bg-amber-50 border-b border-amber-100 text-amber-900">
				<div className="relative mx-auto px-6 md:px-16 py-2">
					<div className="flex items-center">
						<div className="flex-1 text-center">
							<span className="text-sm">
								Hemos detectado que tu calendario no está
								conectado. Por favor,{' '}
								<Link
									href="/settings?tab=calendar"
									className="text-sm underline underline-offset-2"
								>
									vuelve a conectarlo
								</Link>
								.
							</span>
						</div>
						<div className="flex items-center gap-4">
							<button
								type="button"
								className="p-1 text-amber-900/70 hover:text-amber-900"
								onClick={() => setDismissed(true)}
								aria-label="Cerrar aviso"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
