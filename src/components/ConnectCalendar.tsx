import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { FcGoogle } from 'react-icons/fc'
import { supabase } from "@/lib/supabase"

export function ConnectCalendar() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    checkCalendarConnection()
  }, [])

  const checkCalendarConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { data, error } = await supabase
        .from('calendar_tokens')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No tokens found, calendar is not connected
          setIsConnected(false)
        } else {
          throw error
        }
      } else {
        // Tokens found, calendar is connected
        setIsConnected(true)
      }
    } catch (error) {
      console.error('Error checking calendar connection:', error)
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      window.location.href = '/api/auth/google-calendar'
    } catch (error) {
      setIsConnecting(false)
    }
  }

  return (
    <Button 
      onClick={handleConnect} 
      disabled={isConnecting || isConnected}
      className="w-full flex items-center justify-center gap-2 bg-white text-black shadow-sm hover:bg-white">
      <FcGoogle />
      {isConnecting ? 'Connecting...' : isConnected ? 'Calendar is connected' : 'Connect Google Calendar'}
    </Button>
  )
}