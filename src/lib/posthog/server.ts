import { PostHog } from 'posthog-node'

// Create a client instance for server-side usage
export default function PostHogClient() {
	const posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
		host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
		flushAt: 1,
		flushInterval: 0
	})
	return posthogClient
}

// Small helpers to keep logic readable and reusable
export function isServerCaptureEnabled(): boolean {
	return (
		!!process.env.NEXT_PUBLIC_POSTHOG_KEY &&
		(process.env.NODE_ENV === 'production' ||
			process.env.NEXT_PUBLIC_POSTHOG_CAPTURE_DEV === 'true')
	)
}

async function withPosthog(fn: (ph: PostHog) => Promise<void>): Promise<void> {
	const ph = PostHogClient()
	try {
		await fn(ph)
	} finally {
		await ph.shutdown()
	}
}

// Minimal reusable helper for server-side one-off events.
export async function captureEvent({
	userId,
	event,
	properties,
	userEmail
}: {
	userId: string
	event: string
	properties?: Record<string, unknown>
	userEmail?: string | null
}): Promise<void> {
	if (!isServerCaptureEnabled()) return
	try {
		await withPosthog(async (ph) => {
			await ph.capture({
				distinctId: userId,
				event,
				properties: {
					...(properties || {}),
					...(userEmail ? { $set: { email: userEmail } } : {})
				}
			})
		})
	} catch (error) {
		console.warn('PostHog capture failed:', error)
	}
}

// Optional convenience wrappers for common events (use if helpful)
// Use captureEvent directly for all events to avoid duplicating wrappers.
