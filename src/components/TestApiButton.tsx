'use client'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'

export function TestApiButton() {
	const [loading, setLoading] = useState(false)
	const supabase = createClient()

	useEffect(() => {
		const getUser = async () => {
			const {
				data: { user }
			} = await supabase.auth.getUser()
			console.log('user', user)
		}
		getUser()
	}, [])

	const handleTestApi = async () => {
		setLoading(true)
		try {
			// Test GET request
			const getResponse = await fetch('/api/test')
			const getData = await getResponse.json()
			console.log('GET Response:', getData)
		} catch (error) {
			console.error('API Test Error:', error)
		} finally {
			setLoading(false)
		}
	}

	return (
		<Button
			onClick={handleTestApi}
			disabled={loading}
			variant="outline"
			className="tracking-wide text-sm"
		>
			{loading ? 'Testing...' : 'Test API'}
		</Button>
	)
}
