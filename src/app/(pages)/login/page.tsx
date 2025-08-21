'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import LoginForm from '@/components/LoginForm'

export default function Login() {
	const { user } = useUser()
	const router = useRouter()

	useEffect(() => {
		if (user) {
			router.replace('/dashboard')
		}
	}, [user, router])

	if (user) return null

	return (
		<div className="w-full h-screen flex items-center justify-center">
			<LoginForm />
		</div>
	)
}
