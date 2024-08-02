'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { WeeklyAvailability } from '@/components/WeeklyAvailability'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) {
        router.push('/')
      }
    }
    getUser()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="w-full max-w-2xl px-4 mt-32">
        <WeeklyAvailability />
    </div>
  )
}