/**
 * User Context and Authentication Provider
 *
 * This module provides a React Context for managing user authentication state
 * and profile data throughout the application. It handles:
 *
 * AUTHENTICATION FLOW:
 * 1. Listen for Supabase auth state changes (login/logout)
 * 2. Automatically fetch user profile data when authenticated
 * 3. Redirect to home page when user logs out
 * 4. Provide authentication state to all child components
 *
 * STATE MANAGEMENT:
 * - user: Supabase User object (contains auth info like id, email, etc.)
 * - profile: Extended user profile data from the profiles table
 * - loading: Indicates when profile data is being fetched
 *
 * USAGE:
 * - Wrap your app with <UserProvider>
 * - Use the useUser() hook in any component to access auth state
 */

'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

/**
 * Interface for user profile data from the profiles table
 * This extends the basic Supabase User with additional profile information
 *
 * @interface UserProfile
 * @property id - UUID matching the auth.users.id
 * @property name - Display name of the user
 * @property username - Unique username for public booking URLs
 * @property email - User's email address
 * @property description - User's bio/description (optional)
 * @property profile_picture_url - URL to user's profile picture (optional)
 */
interface UserProfile {
	id: string
	name: string
	username: string
	email: string
	description?: string
	profile_picture_url?: string
}

/**
 * Interface for the User Context value
 * Defines what data and functions are available to consuming components
 *
 * @interface UserContextType
 * @property user - Supabase User object or null if not authenticated
 * @property profile - Extended profile data or null if not loaded/authenticated
 * @property loading - Boolean indicating if profile data is being fetched
 * @property refreshProfile - Function to manually refresh profile data
 */
interface UserContextType {
	user: any | null
	profile: UserProfile | null
	loading: boolean
	refreshProfile: () => Promise<void>
}

// Create the React Context with undefined as default
// This forces consumers to use the context within a Provider
const UserContext = createContext<UserContextType | undefined>(undefined)

/**
 * User Provider Component
 *
 * This provider component wraps the application and manages authentication state.
 * It should be placed high in the component tree (typically in layout.tsx or _app.tsx)
 * so that all child components can access the authentication context.
 *
 * RESPONSIBILITIES:
 * 1. Listen for authentication state changes
 * 2. Fetch and cache user profile data
 * 3. Handle automatic redirects on logout
 * 4. Provide authentication state to child components
 *
 * @param children - React children components that need access to auth state
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
	// Authentication state from Supabase (contains id, email, etc.)
	const [user, setUser] = useState<any | null>(null)

	// Extended profile data from our profiles table
	const [profile, setProfile] = useState<UserProfile | null>(null)

	// Loading state for profile data fetching
	const [loading, setLoading] = useState(true)

	// Next.js router for navigation (used for logout redirect)
	const router = useRouter()

	// Supabase client
	const supabase = createClient()

	// Effect: Set up authentication state listener
	useEffect(() => {
		/**
		 * Listen for authentication state changes
		 * This fires whenever the user logs in, logs out, or their session changes
		 */
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			// Update user state with the current session user (or null if logged out)
			setUser(session?.user ?? null)

			// Only redirect to login on actual logout events, not on initial load
			if (event === 'SIGNED_OUT') {
				setProfile(null)
				router.push('/login') // Redirect to login page on logout
			}
		})

		/**
		 * Get initial session state
		 * This handles the case where the user is already logged in when the app starts
		 * (e.g., refreshing the page, returning to the app)
		 */
		supabase.auth
			.getUser()
			.then(({ data: { user }, error }) => {
				setUser(user ?? null)
			})
			.catch((err) => {
				console.error('Error getting initial session:', err)
			})

		// Cleanup: Unsubscribe from auth state changes when component unmounts
		return () => {
			subscription.unsubscribe()
		}
	}, [router]) // Dependency: router (though it shouldn't change)

	// Effect: Fetch profile data whenever user changes
	useEffect(() => {
		// Only fetch profile if user is authenticated
		if (user) {
			refreshProfile()
		} else {
			setLoading(false)
		}
	}, [user]) // Dependency: user state

	/**
	 * Fetches the user's profile data from the profiles table
	 *
	 * This function:
	 * 1. Sets loading state to true
	 * 2. Queries the profiles table for the current user's data
	 * 3. Updates the profile state with the fetched data
	 * 4. Handles errors gracefully by setting profile to null
	 * 5. Always sets loading to false when complete
	 *
	 * Can be called manually to refresh profile data (e.g., after profile updates)
	 */
	const refreshProfile = async () => {
		try {
			setLoading(true)

			// Query profiles table for current user's profile data
			const { data, error } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', user.id) // Filter by current user's ID
				.single() // Expect exactly one result

			if (error) {
				throw error
			}

			// Update profile state with fetched data
			setProfile(data)
		} catch (error) {
			// Log error and clear profile state if fetch fails
			console.error('Error loading profile:', error)
			setProfile(null)
		} finally {
			// Always clear loading state, regardless of success/failure
			setLoading(false)
		}
	}

	// Provide the context value to all child components
	return (
		<UserContext.Provider
			value={{ user, profile, loading, refreshProfile }}
		>
			{children}
		</UserContext.Provider>
	)
}

/**
 * Custom hook for accessing user authentication state
 *
 * This hook provides a convenient way for components to access the user context.
 * It includes built-in error handling to ensure the hook is only used within
 * a UserProvider.
 *
 * USAGE EXAMPLES:
 * ```tsx
 * const { user, profile, loading } = useUser()
 *
 * if (loading) return <div>Loading...</div>
 * if (!user) return <div>Please log in</div>
 *
 * return <div>Welcome, {profile?.name}!</div>
 * ```
 *
 * @returns UserContextType - Object containing user, profile, loading, and refreshProfile
 * @throws Error if used outside of a UserProvider
 */
export function useUser() {
	const context = useContext(UserContext)

	// Ensure hook is used within a UserProvider
	if (context === undefined) {
		throw new Error('useUser must be used within a UserProvider')
	}

	return context
}
