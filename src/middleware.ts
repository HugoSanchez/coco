import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function middleware(request: NextRequest) {
	console.log('middleware!!!!!!!!!!!!!')
	const { pathname } = request.nextUrl
	const supabase = createClient()

	// Define protected routes
	const protectedPages = ['/dashboard', '/settings', '/onboarding']

	const isProtectedPage = protectedPages.some((route) =>
		pathname.startsWith(route)
	)

	console.log('Are we here? 1', isProtectedPage)
	if (isProtectedPage) {
		console.log('So we are here 2')
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession()

			if (!session) {
				// Save the original URL for post-login redirect
				const redirectUrl = new URL('/login', request.url)
				redirectUrl.searchParams.set('redirectTo', pathname)
				return NextResponse.redirect(redirectUrl)
			}
		} catch (error) {
			console.log('Error', error)
		}
	}

	return NextResponse.next()
}

export const config = {
	matcher: ['/dashboard/:path*', '/settings/:path*', '/onboarding/:path*']
}
