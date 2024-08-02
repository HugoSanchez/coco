"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }
    }

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }

    window.addEventListener('scroll', handleScroll)
    getUser()

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className={`fixed top-0 left-0 right-0 bg-background z-10 transition-shadow duration-300 h-16 ${
      isScrolled ? 'shadow-md' : ''
    }`}>
      <div className="container mx-auto px-4 h-full flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-primary ">
          coco
        </Link>
        <nav>
          <ul className="flex space-x-4 items-center">
            <li><Link href="/" className="text-primary">Home</Link></li>
            <li><Link href="/about" className="text-primary">About</Link></li>
            {user && (
              <li>
                <Button onClick={handleSignOut} variant="outline" size="sm">
                  Sign Out
                </Button>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  )
}