'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SocialLogin } from './SocialLogin'
import { useToast } from '@/components/ui/use-toast'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

/**
 * LoginForm Component
 *
 * Handles user authentication via email OTP (One-Time Password). This component
 * supports both new user signup and existing user login with a single email input.
 *
 * FEATURES:
 * - Email validation with real-time feedback
 * - OTP-based authentication via Supabase
 * - Loading states and error handling
 * - Success confirmation screen
 * - Social login integration
 *
 * AUTHENTICATION FLOW:
 * 1. User enters email and submits form
 * 2. Email validation occurs client-side
 * 3. Supabase sends OTP email to user
 * 4. User clicks link in email to complete authentication
 * 5. User is redirected based on onboarding status
 *
 * @component
 * @example
 * ```tsx
 * <LoginForm />
 * ```
 */
export default function LoginForm() {
	const supabase = createClient()
	const { toast } = useToast()

	// Form state management
	const [email, setEmail] = useState('')
	const [loading, setLoading] = useState(false)
	const [touched, setTouched] = useState(false)
	const [isSubmitted, setIsSubmitted] = useState(false)

	// Email validation regex - checks for basic email format
	const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

	/**
	 * Handles form submission for email authentication
	 *
	 * This function:
	 * 1. Prevents default form submission
	 * 2. Validates email format
	 * 3. Sends OTP email via Supabase
	 * 4. Handles success/error states
	 * 5. Shows appropriate user feedback
	 *
	 * @param e - Form submission event
	 * @returns Promise<void>
	 */
	const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setTouched(true)

		// Early return if email is invalid
		if (!isValidEmail) return

		setLoading(true)
		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: {
				emailRedirectTo: `${window.location.origin}/api/auth/callback`
			}
		})

		if (error) {
			toast({
				variant: 'destructive',
				title: 'Error',
				description: error.message
			})
		} else {
			setIsSubmitted(true)
		}
		setLoading(false)
	}

	/**
	 * Resets the form to its initial state
	 *
	 * Clears all form data and returns to the input screen
	 * from the success confirmation screen.
	 */
	const handleReset = () => {
		setEmail('')
		setTouched(false)
		setIsSubmitted(false)
	}

	// Determine if input should show error styling
	const isInvalid = touched && !isValidEmail

	return (
		<div>
			{isSubmitted ? (
				// Success confirmation screen
				<div className="text-center max-w-lg w-full">
					<h1 className="text-3xl font-black mb-3 text-center">
						¡Revisa tu correo!
					</h1>
					<p className="mt-3 text-lg text-gray-600 font-light">
						Te hemos enviado un enlace de confirmación a{' '}
						<span className="font-semibold text-primary">
							{email}
						</span>{' '}
						para que puedas acceder.
					</p>
					<Button
						variant="link"
						onClick={handleReset}
						className="mt-2 text-teal-500 hover:text-teal-600"
					>
						Volver a introducir mi email
					</Button>
				</div>
			) : (
				// Main login form
				<div className="w-full max-w-md p-10">
					<div className="text-center">
						<h1 className="text-4xl font-black mb-3 text-center">
							Sign In
						</h1>
						<p className="text-center mb-8 text-lg text-gray-600 font-light">
							Tanto si ya tienes cuenta como si no,{' '}
							<span className="font-medium text-gray-800">
								introduce tu email
							</span>{' '}
							para acceder a Coco.
						</p>
					</div>

					<form
						onSubmit={handleLogin}
						className="space-y-4"
						noValidate
					>
						<Input
							type="email"
							placeholder="Introduce tu email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							onBlur={() => setTouched(true)}
							className={cn(
								'h-14',
								isInvalid &&
									'border-destructive focus-visible:ring-destructive'
							)}
						/>
						<Button
							type="submit"
							disabled={loading}
							className={`w-full h-14 bg-teal-400 hover:bg-teal-500 hover:opacity-80 ${
								!isValidEmail ? 'cursor-not-allowed' : ''
							}`}
						>
							{loading ? <Spinner /> : 'Confirmar'}
						</Button>
					</form>

					{/* Social login section */}
					<div className="space-y-4 mt-6">
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<span className="w-full border-t" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-gray-50 px-2 text-muted-foreground">
									O continua con
								</span>
							</div>
						</div>

						<SocialLogin />
					</div>
				</div>
			)}
		</div>
	)
}
