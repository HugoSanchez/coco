"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { useRouter, usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CircleUser } from 'lucide-react'
import { LogOut } from 'lucide-react'


export default function Header() {
	const pathname = usePathname()
	const [isScrolled, setIsScrolled] = useState(false)
	const [user, setUser] = useState<any>(null)
	const router = useRouter()

	const isBookingPage = /^\/[^\/]+$/.test(pathname)
	const isDashboard = pathname === '/dashboard'

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

	const renderSearchBar = () => {
		if (!isDashboard || !user) return null;

		return (
			<form className="ml-auto flex-1 sm:flex-initial mx-4">
				<div className="relative">
					<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						type="search"
						placeholder="Search client..."
						className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
					/>
				</div>
			</form>
		);
	};

	const renderUserMenu = () => {
		if (!user) return null;

		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="secondary" size="icon" className="rounded-full">
						<CircleUser className="h-5 w-5" />
						<span className="sr-only">Toggle user menu</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-44">
					<DropdownMenuLabel>My Account</DropdownMenuLabel>
					<DropdownMenuSeparator />
						<DropdownMenuItem
							className='cursor-pointer'
							onClick={() => router.push('/dashboard')}>
								Dashboard
						</DropdownMenuItem>
						<DropdownMenuItem
							className='cursor-pointer'
							onClick={() => router.push('/onboarding')}>
								Settings
						</DropdownMenuItem>
						<DropdownMenuItem
							className='cursor-pointer'>
								Support
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem className="cursor-pointer" onClick={handleSignOut}>
							<LogOut className="mr-2 h-4 w-4" />
							<span>Logout</span>
						</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	};

	return (
		<header className={`fixed top-0 left-0 right-0 bg-gray-50 z-10 transition-shadow duration-300 h-16 ${
			isScrolled ? 'shadow-md' : ''}`}>
			<div className="mx-auto px-6 md:px-16 h-full flex justify-between items-center">
				<Link href="/" className="text-xl font-bold text-primary ">
					coco
				</Link>

				<>
				{isDashboard && renderSearchBar()}
				{user && renderUserMenu()}

				</>
			</div>
		</header>
	)
}
