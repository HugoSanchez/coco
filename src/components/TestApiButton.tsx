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
 * - Tests the /api/test endpoint
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
	 * Handles the API test request
	 *
	 * Makes a GET request to the /api/test endpoint and logs the response
	 * for debugging purposes. Includes error handling and loading state management.
	 */
	const handleTestApi = async () => {
		setLoading(true)
		try {
			// Test GET request to protected API endpoint
			const getResponse = await fetch('/api/test')
			const getData = await getResponse.json()
			console.log('GET Response:', getData)
		} catch (error) {
			console.error('API Test Error:', error)
		} finally {
			setLoading(false)
		}
	}

	return (
		<Button
			onClick={handleTestApi}
			disabled={loading}
			variant="outline"
			className="tracking-wide text-sm"
		>
			{loading ? 'Testing...' : 'Test API'}
		</Button>
	)
}
