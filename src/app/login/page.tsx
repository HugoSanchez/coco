'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Auth from '@/components/Auth'
import { supabase } from '@/lib/supabase'

export default function Login() {
	const router = useRouter()

	useEffect(() => {
		const { data: authListener } = supabase.auth.onAuthStateChange(
			(event, session) => {
				if (event === 'SIGNED_IN' && session) {
					router.push('/dashboard')
				}
			}
		)
		return () => {
			authListener.subscription.unsubscribe()
		}
	}, [router])

	return (
		<div className="w-full h-screen flex items-center justify-center">
			<div className="w-full max-w-md px-10 py-16">
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
				<Auth />
			</div>
		</div>
	)
}
