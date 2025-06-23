'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter, usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { CircleUser } from 'lucide-react'
import { LogOut } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

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
	const router = useRouter()
	const { user, profile } = useUser()

	// Track scroll position for shadow effect
	const [isScrolled, setIsScrolled] = useState(false)

	// Determine current page context for conditional rendering
	const isBookingPage = /^\/[^\/]+$/.test(pathname) // Matches single-level routes like /username
	const isDashboard = pathname === '/dashboard'

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

	/**
	 * Renders the search bar component
	 *
	 * Only shows on dashboard page when user is authenticated.
	 * Provides client search functionality for the dashboard.
	 *
	 * @returns JSX.Element | null - Search bar component or null
	 */
	const renderSearchBar = () => {
		// Only show search on dashboard for authenticated users
		if (!isDashboard || !user) return null

		return (
			<form className="ml-auto flex-1 sm:flex-initial mx-4">
				<div className="relative">
					{/* Search icon */}
					<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />

					{/* Search input with responsive width */}
					<Input
						type="search"
						placeholder="Search client..."
						className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
					/>
				</div>
			</form>
		)
	}

	/**
	 * Renders the user profile dropdown menu
	 *
	 * Shows user avatar/icon and dropdown with navigation options.
	 * Only visible when user is authenticated.
	 *
	 * @returns JSX.Element | null - User menu component or null
	 */
	const renderUserMenu = () => {
		// Don't render menu if user is not authenticated
		if (!user) return null

		return (
			<DropdownMenu>
				{/* User avatar trigger button */}
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="rounded-full h-8 w-8 p-0 hover:bg-transparent"
					>
						{/* Show profile picture if available, otherwise show default icon */}
						{profile?.profile_picture_url ? (
							<Image
								src={profile.profile_picture_url}
								alt={profile.name || 'Profile picture'}
								width={52}
								height={52}
								className="h-8 w-8 rounded-full object-cover"
							/>
						) : (
							<CircleUser className="h-6 w-6" />
						)}
						<span className="sr-only">Toggle user menu</span>
					</Button>
				</DropdownMenuTrigger>

				{/* Dropdown menu content */}
				<DropdownMenuContent align="end" className="w-56">
					{/* User info section */}
					<DropdownMenuLabel>
						{profile?.name || 'My Account'}
						{profile?.email && (
							<p className="text-xs text-gray-500 font-normal mt-1">
								{profile.email}
							</p>
						)}
					</DropdownMenuLabel>
					<DropdownMenuSeparator />

					{/* Navigation menu items */}
					<DropdownMenuItem
						className="cursor-pointer"
						onClick={() => router.push('/dashboard')}
					>
						Dashboard
					</DropdownMenuItem>
					<DropdownMenuItem
						className="cursor-pointer"
						onClick={() => router.push('/settings')}
					>
						Settings
					</DropdownMenuItem>
					<DropdownMenuItem className="cursor-pointer">
						Support
					</DropdownMenuItem>
					<DropdownMenuSeparator />

					{/* Sign out option */}
					<DropdownMenuItem
						className="cursor-pointer"
						onClick={handleSignOut}
					>
						<LogOut className="mr-2 h-4 w-4" />
						<span>Logout</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		)
	}

	return (
		<header
			className={`fixed top-0 left-0 right-0 bg-gray-50 z-10 transition-shadow duration-300 h-16 ${
				isScrolled ? 'shadow-md' : ''
			}`}
		>
			<div className="mx-auto px-6 md:px-16 h-full flex justify-between items-center">
				{/* Logo/brand link */}
				<Link href="/" className="text-xl font-bold text-primary">
					coco
				</Link>

				{/* Right side content: search bar and user menu */}
				<>
					{isDashboard && renderSearchBar()}
					{user && renderUserMenu()}
				</>
			</div>
		</header>
	)
}
