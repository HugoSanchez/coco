import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { FcGoogle } from 'react-icons/fc'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import {
	checkCalendarPermissions,
	type CalendarPermissionStatus
} from '@/lib/db/calendar-tokens'

/**
 * Props for the ConnectCalendar component
 *
 * @interface ConnectCalendarProps
 * @property source - Source page context for proper redirect after OAuth (e.g., 'onboarding', 'settings')
 */
interface ConnectCalendarProps {
	source?: 'onboarding' | 'settings'
}

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
 * - Supports different redirect destinations based on source page
 *
 * CONNECTION FLOW:
 * 1. Component checks if user has existing calendar tokens
 * 2. Shows appropriate button state based on connection status
 * 3. User clicks to initiate Google OAuth flow
 * 4. Redirects to Google Calendar authorization with source context
 * 5. Returns with tokens stored and proper redirect based on source
 *
 * @component
 * @example
 * ```tsx
 * <ConnectCalendar source="settings" />
 * ```
 */
export function ConnectCalendar({
	source = 'onboarding'
}: ConnectCalendarProps) {
	const supabase = createSupabaseClient()
	const [isConnecting, setIsConnecting] = useState(false)
	const [isConnected, setIsConnected] = useState(false)
	const [isDisconnecting, setIsDisconnecting] = useState(false)
	const [permissionStatus, setPermissionStatus] =
		useState<CalendarPermissionStatus | null>(null)
	const [isCheckingPermissions, setIsCheckingPermissions] = useState(true)

	/**
	 * Effect to check calendar permissions on component mount
	 */
	useEffect(() => {
		const checkPermissions = async () => {
			setIsCheckingPermissions(true)
			try {
				const {
					data: { user },
					error: userError
				} = await supabase.auth.getUser()

				if (userError || !user) {
					setPermissionStatus(null)
					setIsConnected(false)
					return
				}

				// Check detailed permission status
				const permissions = await checkCalendarPermissions(
					user.id,
					supabase
				)
				setPermissionStatus(permissions)

				// Update connection status based on whether they have calendar access
				setIsConnected(permissions.hasCalendarAccess)
			} catch (error) {
				console.error('Error checking calendar permissions:', error)
				setPermissionStatus(null)
				setIsConnected(false)
			} finally {
				setIsCheckingPermissions(false)
			}
		}

		checkPermissions()
	}, [])

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
	 * The OAuth flow will handle token exchange and storage, and will
	 * redirect back to the appropriate page based on the source context.
	 */
	const handleConnect = async () => {
		setIsConnecting(true)
		try {
			// Redirect to Google Calendar OAuth endpoint with source context
			// This will handle the entire OAuth flow and token storage
			window.location.href = `/api/auth/google-calendar?source=${source}`
		} catch (error) {
			// Reset connecting state if redirect fails
			setIsConnecting(false)
		}
	}

	/**
	 * Handles disconnecting Google Calendar
	 *
	 * Calls the revocation API endpoint to:
	 * 1. Revoke tokens with Google's OAuth servers
	 * 2. Delete stored tokens from our database
	 * 3. Update the UI to reflect disconnected state
	 */
	const handleDisconnect = async () => {
		setIsDisconnecting(true)
		try {
			// Call the revocation API endpoint
			const response = await fetch('/api/calendar/revoke', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			})

			const result = await response.json()

			if (!response.ok || !result.success) {
				throw new Error(result.error || 'Failed to disconnect calendar')
			}

			// Successfully disconnected - update the UI state
			setIsConnected(false)
			setPermissionStatus(null)

			// Optional: Show success message
			console.log('Calendar disconnected successfully:', result.message)
		} catch (error) {
			console.error('Error disconnecting calendar:', error)
			// Optional: Show error toast here in the future
		} finally {
			setIsDisconnecting(false)
		}
	}

	/**
	 * Renders permission status information for the user
	 * Simple binary approach: either we have calendar access or we don't
	 */
	const renderPermissionStatus = () => {
		if (!permissionStatus || isCheckingPermissions) return null

		const { hasTokens, hasCalendarAccess } = permissionStatus

		if (!hasTokens) return null

		if (hasCalendarAccess) return null

		return (
			<div className="my-4 rounded-md bg-gray-200 px-5 py-3 flex items-center gap-5">
				<AlertTriangle className="w-5 h-5 text-gray-600 flex-shrink-0" />
				<div>
					<p className="text-sm text-gray-600">
						Con tu configuración actual, no podremos crear eventos
						de calendario para ti y tus pacientes automáticamente.{' '}
						<strong>
							Para aprovechar al máximo Coco, te recomendamos
							actualizar los permisos de calendario.
						</strong>
					</p>
					<p className="text-sm text-gray-600 mt-1"></p>
				</div>
			</div>
		)
	}

	/**
	 * Determines the appropriate button text based on connection and permission status
	 */
	const getButtonText = () => {
		if (isConnecting) return 'Connectando...'
		if (isDisconnecting) return 'Desconectando...'
		if (isCheckingPermissions) return 'Verificando permisos...'

		if (!permissionStatus?.hasTokens) {
			return 'Conecta Google Calendar'
		}

		if (permissionStatus.hasCalendarAccess) {
			return 'Desconectar Google Calendar'
		}

		// Has tokens but no calendar access
		return 'Actualizar permisos de calendario'
	}

	/**
	 * Determines if button should show as connected (outline style)
	 */
	const isButtonConnected = () => {
		return permissionStatus?.hasCalendarAccess && !isCheckingPermissions
	}

	return (
		<div>
			{renderPermissionStatus()}
			<Button
				onClick={isButtonConnected() ? handleDisconnect : handleConnect}
				disabled={
					isConnecting || isDisconnecting || isCheckingPermissions
				}
				variant={isButtonConnected() ? 'outline' : 'default'}
				className={`w-full flex items-center justify-center mt-6 h-14 gap-2 ${
					isButtonConnected()
						? 'text-gray-600 hover:bg-gray-50 bg-white'
						: 'bg-white shadow-sm text-black border border-gray-200 hover:bg-white'
				}`}
			>
				<FcGoogle className="w-5 h-5" />
				{getButtonText()}
			</Button>
		</div>
	)
}
