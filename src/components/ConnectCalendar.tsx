import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

export function ConnectCalendar() {
  const [isConnecting, setIsConnecting] = useState(false)
  const toast = useToast()

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      window.location.href = '/api/auth/google-calendar'
    } catch (error) {
      toast.toast({
        color: 'error',
        title: 'Error',
        description: 'Failed to connect calendar. Please try again.',
      })
      setIsConnecting(false)
    }
  }

  return (
    <Button onClick={handleConnect} disabled={isConnecting}>
      {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
    </Button>
  )
}