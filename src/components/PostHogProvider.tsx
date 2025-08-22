'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
		if (process.env.NODE_ENV !== 'production') {
			posthog.opt_out_capturing()
			return
		}
		posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
			api_host: 'https://eu.posthog.com',
			ui_host: 'https://eu.posthog.com',
			defaults: '2025-05-24',
			capture_exceptions: true,
			capture_pageview: true
		})
	}, [])

	return <PHProvider client={posthog}>{children}</PHProvider>
}
