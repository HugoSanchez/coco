import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
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

/**
 * Creates a Supabase client with service role privileges
 * This client bypasses Row Level Security (RLS) and should only be used for:
 * - Server-side operations (API routes, webhooks)
 * - System operations that need to access data regardless of user context
 * - Background jobs and automated processes
 *
 * ⚠️ SECURITY WARNING: This client has admin privileges - use carefully!
 * Never expose this client to client-side code or user-facing operations.
 *
 * @returns Supabase client with service role permissions
 */
export function createServiceRoleClient() {
	return createSupabaseClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!
	)
}
