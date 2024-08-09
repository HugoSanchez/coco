"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Auth from '@/components/Auth'
import { supabase } from '@/lib/supabase'


export default function Home() {

  const router = useRouter()

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/dashboard')
      }
    })
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  return (
    <div className="w-full h-screen flex items-center justify-center">
      <div className="w-full max-w-md px-10 py-16">
          <h1 className="text-4xl font-black mb-2 text-center">Sign up</h1>
          <p className="text-center mb-8 text-primary text-lg">Type your email to get started</p>
          <Auth />
      </div>
    </div>
  )
}