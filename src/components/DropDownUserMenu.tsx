import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { CircleUser, LogOut } from 'lucide-react'

import { useRouter } from 'next/navigation'

export default function DropDownUserMenu(props: any) {
	let { user, profile, handleSignOut } = props
	const router = useRouter()
	// Don't render menu if user is not authenticated
	if (!user) return null

	return (
		<DropdownMenu>
			{/* User avatar trigger button */}
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="rounded-full h-8 w-8 p-0 hover:bg-transparent">
					{/* Show profile picture if available, otherwise show default icon */}
					{profile?.profile_picture_url ? (
						<img
							src={profile.profile_picture_url}
							alt={profile.name || 'Profile picture'}
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
					{profile?.email && <p className="text-xs text-gray-500 font-normal mt-1">{profile.email}</p>}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />

				{/* Navigation menu items */}
				<DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/dashboard')}>
					Dashboard
				</DropdownMenuItem>
				<DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/calendar')}>
					Agenda Semanal
				</DropdownMenuItem>
				<DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/settings')}>
					Ajustes
				</DropdownMenuItem>
				<DropdownMenuSeparator />

				{/* Sign out option */}
				<DropdownMenuItem className="cursor-pointer" onClick={handleSignOut}>
					<LogOut className="mr-2 h-4 w-4" />
					<span>Logout</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
