'use client'

import posthog from 'posthog-js'

function isClientCaptureEnabled(): boolean {
	return (
		typeof window !== 'undefined' &&
		!!process.env.NEXT_PUBLIC_POSTHOG_KEY &&
		(process.env.NODE_ENV === 'production' ||
			process.env.NEXT_PUBLIC_POSTHOG_CAPTURE_DEV === 'true')
	)
}

export function captureClientEvent(
	event: string,
	properties?: Record<string, unknown>
): void {
	try {
		if (!isClientCaptureEnabled()) return
		posthog.capture(event, properties)
	} catch {
		// best-effort; ignore client telemetry errors
	}
}

export function captureOnboardingStep(
	step: string,
	extra?: Record<string, unknown>
): void {
	captureClientEvent('onboarding_step_completed', {
		step,
		...(extra || {})
	})
}
