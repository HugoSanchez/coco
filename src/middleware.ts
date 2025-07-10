import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl
	const supabase = createClient()

	// Define protected routes
	const protectedPages = ['/dashboard', '/settings', '/onboarding']

	const isProtectedPage = protectedPages.some((route) =>
		pathname.startsWith(route)
	)

	if (isProtectedPage) {
		const {
			data: { session }
		} = await supabase.auth.getSession()

		if (!session) {
			// Save the original URL for post-login redirect
			const redirectUrl = new URL('/login', request.url)
			redirectUrl.searchParams.set('redirectTo', pathname)
			return NextResponse.redirect(redirectUrl)
		}
	}

	return NextResponse.next()
}

export const config = {
	matcher: ['/dashboard/:path*', '/settings/:path*', '/onboarding/:path*']
}
