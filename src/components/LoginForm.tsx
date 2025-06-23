'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SocialLogin } from './SocialLogin'
import { useToast } from '@/components/ui/use-toast'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export default function LoginForm() {
	const supabase = createClient()
	const { toast } = useToast()
	const [email, setEmail] = useState('')
	const [loading, setLoading] = useState(false)
	const [touched, setTouched] = useState(false)
	const [isSubmitted, setIsSubmitted] = useState(false)

	// Regex to check for a valid email format.
	const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

	const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setTouched(true)

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

	const handleReset = () => {
		setEmail('')
		setTouched(false)
		setIsSubmitted(false)
	}

	const isInvalid = touched && !isValidEmail

	return (
		<div>
			{isSubmitted ? (
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
