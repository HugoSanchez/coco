'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'

import { WeeklyAvailability } from '@/components/WeeklyAvailability'
import { ConnectCalendar } from '@/components/ConnectCalendar'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const toast = useToast()
  const calendarConnected = searchParams.get('calendar_connected')


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

  
  useEffect(() => {
    if (calendarConnected === 'true') {
      toast.toast({
        color: 'success',
        title: 'Success',
        description: 'Calendar connected successfully!',
      })
    } else if (calendarConnected === 'false') {
      toast.toast({
        color: 'error',
        title: 'Error',
        description: 'Failed to connect calendar. Please try again.',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarConnected])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="w-full max-w-2xl px-4 mt-32 pb-24">
        <WeeklyAvailability />
        {
          
        }
        <ConnectCalendar />
    </div>
  )
}