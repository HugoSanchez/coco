import React from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Link as LinkIcon } from 'lucide-react'

interface ShareBookingLinkButtonProps {
	username?: string | null
	className?: string
}

export default function ShareBookingLinkButton({ username, className }: ShareBookingLinkButtonProps) {
	const { toast } = useToast()

	if (!username) return null

	return (
		<Button
			variant="ghost"
			className={`h-12 w-12 p-0 rounded-md border border-gray-200 hover:bg-gray-50 ${className || ''}`}
			onClick={async () => {
				try {
					const url = `${window.location.origin}/${username}`
					await navigator.clipboard.writeText(url)
					toast({
						title: 'Enlace copiado',
						description: 'Tu enlace público ha sido copiado.',
						color: 'success'
					})
				} catch (e) {
					toast({
						title: 'No se pudo copiar',
						description: 'Copia el enlace manualmente.',
						variant: 'destructive'
					})
				}
			}}
		>
			<LinkIcon className="h-4 w-4" />
		</Button>
	)
}
