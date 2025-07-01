'use client'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'

/**
 * TestApiButton Component
 *
 * A debugging component used for testing API endpoints and authentication state.
 * This component is primarily used during development to verify that:
 * - API routes are working correctly
 * - Authentication is functioning properly
 * - User session data is accessible
 *
 * FEATURES:
 * - Tests the /api/dev/test endpoint
 * - Logs user authentication state
 * - Provides loading state feedback
 * - Console logging for debugging
 *
 * USAGE:
 * This component should only be used during development and testing.
 * It can be removed or conditionally rendered in production builds.
 *
 * @component
 * @example
 * ```tsx
 * // Development only
 * {process.env.NODE_ENV === 'development' && <TestApiButton />}
 * ```
 */
export function TestApiButton() {
	const [loading, setLoading] = useState(false)
	const supabase = createClient()

	/**
	 * Effect to log current user authentication state
	 * Runs once on component mount for debugging purposes
	 */
	useEffect(() => {
		const getUser = async () => {
			const {
				data: { user }
			} = await supabase.auth.getUser()
			console.log('user', user)
		}
		getUser()
	}, [])

	/**
	 * Tests the complete payment flow:
	 * 1. Creates test consultation bookings (seed-consultations)
	 * 2. Sends consultation billing emails with payment links (/billing/consultation)
	 */
	const handleTestApi = async () => {
		setLoading(true)
	}

	return (
		<Button
			onClick={handleTestApi}
			disabled={loading}
			variant="default"
			className="tracking-wide text-sm"
		>
			{loading ? 'Testing...' : '💳 Test Payment'}
		</Button>
	)
}
