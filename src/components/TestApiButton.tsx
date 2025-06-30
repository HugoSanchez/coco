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
		try {
			console.log('🧪 Starting complete payment flow test...')

			// Step 1: Create test consultation data
			console.log('📝 Creating test consultation bookings...')
			const seedResponse = await fetch('/api/dev/seed-consultations')
			const seedData = await seedResponse.json()

			if (!seedResponse.ok) {
				console.error('❌ Error creating test data:', seedData)
				alert(`Error creating test data: ${seedData.error}`)
				return
			}

			console.log('✅ Test bookings created:', seedData)
			alert(`✅ Created ${seedData.count} test consultation bookings`)

			// Step 2: Send consultation billing emails with payment links
			console.log(
				'📧 Sending consultation billing emails with payment links...'
			)
			const billingResponse = await fetch('/api/billing/consultation', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({}) // Send all pending bills
			})

			const billingData = await billingResponse.json()
			console.log('📧 Billing response:', billingData)

			if (!billingResponse.ok) {
				console.error('❌ Error sending bills:', billingData)
				alert(`Error sending bills: ${billingData.error}`)
				return
			}

			// Success!
			console.log('🎉 Payment flow test completed successfully!')
			alert(
				`🎉 Success!\n\n📧 Emails sent: ${billingData.emails_sent}\n❌ Failed: ${billingData.emails_failed}\n\nCheck your email service logs and Stripe dashboard.`
			)
		} catch (error) {
			console.error('❌ Payment flow test error:', error)
			alert(`❌ Test failed: ${error}`)
		} finally {
			setLoading(false)
		}
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
