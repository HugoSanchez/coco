/**
 * CalendarBanner
 *
 * Purpose
 * - Shows a global, non-blocking banner when the user's Google Calendar is not connected
 *   or has become unusable (e.g., invalid_grant). This gives proactive visibility and
 *   a consistent place to guide users to reconnect.
 *
 * How it decides to render
 * - Relies on calendarConnected from UserContext, which is computed server-side by
 *   attempting to build an authenticated Google Calendar client. If that fails,
 *   calendarConnected becomes false.
 *
 * Dismissal behavior
 * - Session dismiss: Clicking the X hides the banner for the current session (page lifetime).
 * - Gentle "auto-don't-show": After the user dismisses the banner 3 times (tracked per user
 *   in localStorage), we automatically set a persistent "don't show again" flag for that user.
 * - Persistent dismiss: We also maintain a per-user persistent dismissed flag in localStorage
 *   so the banner remains hidden across reloads and sessions.
 *
 * Responsiveness & A11y
 * - The banner sits fixed at the top of the viewport, spans full width, and adapts paddings
 *   across breakpoints. Message text scales for small screens.
 * - The close button is keyboard-focusable and labeled for screen readers.
 *
 * Customization
 * - Colors use a subtle rose palette to indicate an attention-worthy state without being
 *   disruptive. Easy to adjust via Tailwind classes.
 */
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
	// Track number of times user has closed the banner (per user)
	const closeCountKey = useMemo(
		() => (user ? `coco_calendar_banner_close_count_v1_${user.id}` : ''),
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

	// Close handler: hide for the session; after 3 closes, persist "don't show again"
	const handleClose = () => {
		setDismissed(true)
		if (!closeCountKey) return
		try {
			const prev =
				parseInt(localStorage.getItem(closeCountKey) || '0', 10) || 0
			const next = prev + 1
			localStorage.setItem(closeCountKey, String(next))
			if (next >= 3 && storageKey) {
				localStorage.setItem(storageKey, 'true')
				setPersistDismissed(true)
			}
		} catch {}
	}

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
			<div className="w-full bg-rose-50 border-b border-rose-100 text-rose-900">
				<div className="relative mx-auto px-4 sm:px-6 md:px-16 py-2">
					<div className="flex items-center justify-between gap-2 sm:gap-4">
						<div className="flex-1 text-center px-6 sm:px-0">
							<span className="text-xs sm:text-sm md:leading-5 whitespace-normal">
								Hemos detectado que tu calendario no está
								conectado. Para mejorar tu experiencia te
								recomendamos que{' '}
								<Link
									href="/settings?tab=calendar"
									className="underline underline-offset-2"
								>
									vuelvas a conectarlo
								</Link>
								.
							</span>
						</div>
						<div className="flex items-center gap-2 sm:gap-3">
							<button
								type="button"
								className="p-2 text-rose-900/70 hover:text-rose-900"
								onClick={handleClose}
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
