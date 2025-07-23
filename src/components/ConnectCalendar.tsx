import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { FcGoogle } from 'react-icons/fc'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

/**
 * ConnectCalendar Component
 *
 * Handles Google Calendar integration for users. This component manages the
 * connection state between the user's account and their Google Calendar,
 * allowing them to sync their availability and bookings.
 *
 * FEATURES:
 * - Checks existing calendar connection status
 * - Initiates Google OAuth flow for calendar access
 * - Shows different states (connecting, connected, not connected)
 * - Handles connection errors gracefully
 *
 * CONNECTION FLOW:
 * 1. Component checks if user has existing calendar tokens
 * 2. Shows appropriate button state based on connection status
 * 3. User clicks to initiate Google OAuth flow
 * 4. Redirects to Google Calendar authorization
 * 5. Returns with tokens stored in database
 *
 * @component
 * @example
 * ```tsx
 * <ConnectCalendar />
 * ```
 */
export function ConnectCalendar() {
	const supabase = createSupabaseClient()
	const [isConnecting, setIsConnecting] = useState(false)
	const [isConnected, setIsConnected] = useState(false)

	/**
	 * Effect to check calendar connection status on component mount
	 * Queries the database for existing calendar tokens for the current user
	 */
	useEffect(() => {
		checkCalendarConnection()
	}, [])

	/**
	 * Checks if the current user has an active Google Calendar connection
	 *
	 * This function:
	 * 1. Gets the current authenticated user
	 * 2. Queries the calendar_tokens table for existing tokens
	 * 3. Updates the connection state based on token existence
	 * 4. Handles the case where no tokens exist (PGRST116 error)
	 *
	 * @returns Promise<void>
	 */
	const checkCalendarConnection = async () => {
		try {
			// Get current authenticated user
			const {
				data: { user }
			} = await supabase.auth.getUser()
			if (!user) throw new Error('No user found')

			// Query for existing calendar tokens for this user
			const { data, error } = await supabase
				.from('calendar_tokens')
				.select('*')
				.eq('user_id', user.id)
				.single()

			if (error) {
				if (error.code === 'PGRST116') {
					// PGRST116 = No rows returned (no tokens found)
					// This means the calendar is not connected
					setIsConnected(false)
				} else {
					// Other database error occurred
					throw error
				}
			} else {
				// Tokens found, calendar is connected
				setIsConnected(true)
			}
		} catch (error) {
			console.error('Error checking calendar connection:', error)
		}
	}

	/**
	 * Initiates the Google Calendar connection process
	 *
	 * Redirects the user to the Google OAuth flow for calendar access.
	 * The OAuth flow will handle token exchange and storage.
	 */
	const handleConnect = async () => {
		setIsConnecting(true)
		try {
			// Redirect to Google Calendar OAuth endpoint
			// This will handle the entire OAuth flow and token storage
			window.location.href = '/api/auth/google-calendar'
		} catch (error) {
			// Reset connecting state if redirect fails
			setIsConnecting(false)
		}
	}

	return (
		<Button
			onClick={handleConnect}
			disabled={isConnecting || isConnected}
			className="w-full flex items-center justify-center h-14 gap-2 bg-white shadow-sm text-black border border-gray-200 hover:bg-white"
		>
			<FcGoogle className="w-5 h-5" />
			{/* Dynamic button text based on connection state */}
			{isConnecting
				? 'Connectando...'
				: isConnected
					? 'El calendario ya está conectado'
					: 'Conecta Google Calendar'}
		</Button>
	)
}
