import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { FcGoogle } from 'react-icons/fc'

/**
 * SocialLogin Component
 *
 * Provides social authentication options using OAuth providers.
 * Currently supports Google authentication with extensible design
 * for additional providers like Apple, GitHub, etc.
 *
 * FEATURES:
 * - Google OAuth integration via Supabase
 * - Loading states during authentication
 * - Error handling with user feedback
 * - Responsive button design
 *
 * AUTHENTICATION FLOW:
 * 1. User clicks social login button
 * 2. Supabase redirects to OAuth provider
 * 3. User authenticates with provider
 * 4. Provider redirects back to app
 * 5. User is authenticated and redirected to dashboard
 *
 * @component
 * @example
 * ```tsx
 * <SocialLogin />
 * ```
 */
export function SocialLogin() {
	const [isLoading, setIsLoading] = useState(false)
	const toast = useToast()
	const supabase = createClient()

	/**
	 * Handles social authentication with OAuth providers
	 *
	 * Initiates the OAuth flow with the specified provider and
	 * handles any authentication errors that occur during the process.
	 *
	 * @param provider - The OAuth provider to use ('google' | 'apple')
	 * @returns Promise<void>
	 */
	const handleSocialLogin = async (provider: 'google' | 'apple') => {
		setIsLoading(true)

		const { error } = await supabase.auth.signInWithOAuth({
			provider: provider,
			options: {
				redirectTo: `${window.location.origin}/api/auth/callback`
			}
		})

		if (error) {
			toast.toast({
				color: 'error',
				title: 'Error',
				description: `Failed to sign in with ${provider}. Please try again.`
			})
		}
		setIsLoading(false)
	}

	return (
		<div className="space-y-4">
			{/* Google OAuth Button */}
			<Button
				onClick={() => handleSocialLogin('google')}
				disabled={isLoading}
				className="w-full h-12 flex items-center justify-center bg-white"
				variant="outline"
			>
				<FcGoogle className="mr-2 h-4 w-4" />
				Sign in con Google
			</Button>
		</div>
	)
}
