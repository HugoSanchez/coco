import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/server'

export async function middleware(request: NextRequest) {
	// Get the pathname of the request
	const { pathname } = request.nextUrl
	// Create response object early so we can pass it to the Supabase client
	const response = NextResponse.next()
	// Set global Content-Language header to help browsers avoid translating Spanish content
	response.headers.set('Content-Language', 'es')
	// Persist UTM params into short-lived cookies for later attribution
	try {
		const params = request.nextUrl.searchParams
		const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
		utmKeys.forEach((key) => {
			const val = params.get(key)
			if (val) {
				response.cookies.set(key, val, {
					path: '/',
					httpOnly: false,
					sameSite: 'lax',
					secure: true,
					maxAge: 60 * 60 * 24 * 90 // 90 days
				})
			}
		})
	} catch (_) {}

	// Create a Supabase client
	const supabase = createMiddlewareClient(request, response)
	// Define protected routes
	const protectedPages = ['/dashboard', '/settings', '/onboarding']
	// Check if the current path is a protected page
	const isProtectedPage = protectedPages.some((route) => pathname.startsWith(route))

	// If the current path is a protected page,
	// check if the user is authenticated
	if (isProtectedPage) {
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser()
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
