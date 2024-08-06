import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { FcGoogle } from 'react-icons/fc'
import { FaApple } from 'react-icons/fa'

export function SocialLogin() {
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setIsLoading(true)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) {
      toast.toast({
        color: 'error',
        title: 'Error',
        description: `Failed to sign in with ${provider}. Please try again.`,
      })
    }
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <Button 
        onClick={() => handleSocialLogin('google')} 
        disabled={isLoading}
        className="w-full h-12 flex items-center justify-center"
        variant="outline"
      >
        <FcGoogle className="mr-2 h-4 w-4" />
        Sign in with Google
      </Button>
    </div>
  )
}

/**
 *  <Button 
        onClick={() => handleSocialLogin('apple')} 
        disabled={isLoading}
        className="w-full h-12 flex items-center justify-center"
        variant="outline"
      >
        <FaApple className="mr-2 h-4 w-4" />
        Sign in with Apple
      </Button>
 */