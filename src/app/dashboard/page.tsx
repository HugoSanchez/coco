'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from 'next/navigation'

interface UserProfile {
  id: string
  name: string
  // Add other profile fields as needed
}

export default function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user === null) {
        router.push('/')
        throw new Error('No user')
      } else setUser(user)
    }
    loadUser()
  }, [router])

  useEffect(() => {
    const loadProfile = async () => {
      try {   
        setLoading(true)
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) throw error

        setProfile(data)
      } catch (error) {
        console.error('Error loading profile:', error)
        toast({
          title: "Error",
          description: "Failed to load user profile.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadProfile()
    }
  }, [user, toast])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="p-32">
      <h1 className="text-3xl font-light mb-4 border-black">
        {profile ? `Welcome, ${profile.name}, this is your dashboard!` : 'Welcome to your Dashboard'}
      </h1>
      {/* Rest of your dashboard content */}
    </div>
  )
}


/**
 * 
 */