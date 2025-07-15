import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export function createClient() {
	const cookieStore = cookies()

	return createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(name: string) {
					return cookieStore.get(name)?.value
				},
				set(name: string, value: string, options: CookieOptions) {
					cookieStore.set({ name, value, ...options })
				},
				remove(name: string, options: CookieOptions) {
					cookieStore.set({ name, value: '', ...options })
				}
			}
		}
	)
}

/**
 * Creates a Supabase client specifically for middleware
 * Uses request/response objects directly instead of Next.js cookies() helper
 * This prevents cookie modification errors in the Edge Runtime
 */
export function createMiddlewareClient(
	request: NextRequest,
	response: NextResponse
) {
	return createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(name: string) {
					return request.cookies.get(name)?.value
				},
				set(name: string, value: string, options: CookieOptions) {
					response.cookies.set({ name, value, ...options })
				},
				remove(name: string, options: CookieOptions) {
					response.cookies.set({ name, value: '', ...options })
				}
			}
		}
	)
}
