'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import DropDownUserMenu from '@/components/DropDownUserMenu'
import { useUser } from '@/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'

/**
 * Header Component
 *
 * The main navigation header that appears on all pages. Provides navigation,
 * user authentication status, search functionality, and user account management.
 *
 * FEATURES:
 * - Responsive navigation with logo
 * - User authentication status display
 * - Search bar (dashboard only)
 * - User profile dropdown menu
 * - Scroll-based shadow effects
 * - Sign out functionality
 *
 * RESPONSIVE BEHAVIOR:
 * - Search bar adapts to screen size
 * - User menu is hidden when not authenticated
 * - Header shadow appears on scroll
 *
 * @component
 * @example
 * ```tsx
 * <Header />
 * ```
 */
export default function Header() {
	const pathname = usePathname()
	const supabase = createClient()
	const { user, profile } = useUser()

	// Track scroll position for shadow effect
	const [isScrolled, setIsScrolled] = useState(false)

	const isLandingPage = pathname === '/'

	/**
	 * Effect to handle scroll-based header styling
	 * Adds shadow to header when user scrolls down
	 */
	useEffect(() => {
		const handleScroll = () => {
			// Add shadow when scrolled, remove when at top
			if (window.scrollY > 0) {
				setIsScrolled(true)
			} else {
				setIsScrolled(false)
			}
		}

		// Add scroll event listener
		window.addEventListener('scroll', handleScroll)

		// Cleanup: remove event listener on unmount
		return () => {
			window.removeEventListener('scroll', handleScroll)
		}
	}, [])

	/**
	 * Handles user sign out
	 *
	 * Signs out the current user from Supabase authentication
	 * and redirects to login page (handled by UserContext)
	 */
	const handleSignOut = async () => {
		await supabase.auth.signOut()
	}

	if (isLandingPage) {
		return null
	}

	return (
		<header
			className={`fixed top-0 left-0 right-0 bg-gray-50 z-10 transition-shadow duration-300 h-16 ${
				isScrolled ? 'shadow-md' : ''
			}`}
		>
			<div className="mx-auto px-6 md:px-16 h-full flex justify-between items-center">
				{/* Logo/brand link */}
				<Link
					href={user ? '/dashboard' : '/'}
					className="text-xl font-bold text-primary tracking-wide"
				>
					coco.
				</Link>
				{user && (
					<DropDownUserMenu
						user={user}
						profile={profile}
						handleSignOut={handleSignOut}
					/>
				)}
			</div>
		</header>
	)
}
