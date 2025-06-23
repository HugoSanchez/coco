'use client'
import { useEffect } from 'react'
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
		<div className="w-full h-screen flex items-center justify-center px-10 py-16">
			<Auth />
		</div>
	)
}
