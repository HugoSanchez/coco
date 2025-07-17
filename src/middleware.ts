import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/server'

export async function middleware(request: NextRequest) {
	// Get the pathname of the request
	const { pathname } = request.nextUrl
	// Create response object early so we can pass it to the Supabase client
	const response = NextResponse.next()
	// Create a Supabase client
	const supabase = createMiddlewareClient(request, response)
	// Define protected routes
	const protectedPages = ['/dashboard', '/settings', '/onboarding']
	// Check if the current path is a protected page
	const isProtectedPage = protectedPages.some((route) =>
		pathname.startsWith(route)
	)

	// If the current path is a protected page,
	// check if the user is authenticated
	if (isProtectedPage) {
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser()
			console.log('CALLBACK SESSION CHECK:', {
				hasUser: !!user,
				userId: user?.id,
				timestamp: new Date().toISOString()
			})
			// If the user is not authenticated, redirect to the login page
			if (!user) {
				// Save the original URL for post-login redirect
				const redirectUrl = new URL('/login', request.url)
				redirectUrl.searchParams.set('redirectTo', pathname)
				return NextResponse.redirect(redirectUrl)
			}
		} catch (error) {
			console.log('Error in middleware getSession:', error)
			throw error
		}
	}
	// Return the response object (which may have updated cookies)
	return response
}

export const config = {
	matcher: ['/dashboard/:path*', '/settings/:path*', '/onboarding/:path*']
}
