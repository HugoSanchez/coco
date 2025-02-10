'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface UserProfile {
    id: string
    name: string
    email: string
    description?: string
    profile_picture_url?: string
}

interface UserContextType {
    user: any | null
    profile: UserProfile | null
    loading: boolean
    refreshProfile: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<any | null>(null)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setUser(session?.user ?? null)
                if (!session?.user) {
                    setProfile(null)
                    router.push('/')
                }
            }
        )

        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [router])

    // Fetch profile whenever user changes
    useEffect(() => {
        if (user) {
            refreshProfile()
        }
    }, [user])

    const refreshProfile = async () => {
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
            setProfile(null)
        } finally {
            setLoading(false)
        }
    }

    return (
        <UserContext.Provider value={{ user, profile, loading, refreshProfile }}>
            {children}
        </UserContext.Provider>
    )
}

export function useUser() {
    const context = useContext(UserContext)
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider')
    }
    return context
}
