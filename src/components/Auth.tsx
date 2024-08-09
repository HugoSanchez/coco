"use client"

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SocialLogin } from './SocialLogin'
import { useToast } from '@/components/ui/use-toast'

export default function Auth() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      toast.toast({
        color: 'error',
        title: 'Error',
        description: error.message,
      })
    } else {
      toast.toast({
        color: 'success',
        title: 'Success',
        description: 'Check your email for the login link!',
      })
    }
  }

  return (
    <div>
      <form onSubmit={handleLogin} className="space-y-4">
        <Input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-14"
        />
        <Button type="submit" disabled={loading} className="w-full h-14">
          {loading ? 'Loading...' : 'Send magic link'}
        </Button>
      </form>

      <div className="space-y-4 mt-6">
        <div className="relative" >
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-gray-50 px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <SocialLogin />
      </div>
  </div>
  )
}