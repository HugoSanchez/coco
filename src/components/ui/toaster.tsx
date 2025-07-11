'use client'

import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport
} from '@/components/ui/toast'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { Check, X, Loader } from 'lucide-react'

export function Toaster() {
	const { toasts } = useToast()

	return (
		<ToastProvider>
			{toasts.map(function ({
				id,
				title,
				description,
				color,
				action,
				...props
			}) {
				return (
					<Toast key={id} {...props} className="">
						<div className="flex items-center gap-4">
							<div
								className={cn(
									'h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0',
									color === 'success' && 'bg-accent',
									color === 'error' && 'bg-red-100',
									color === 'loading' && 'bg-gray-100',
									color === 'default' && 'bg-gray-200'
								)}
							>
								{(color === 'success' && (
									<Check className="h-4 w-4" color="white" />
								)) ||
									(color === 'error' && (
										<X className="h-4 w-4" color="red" />
									)) ||
									(color === 'loading' && (
										<Loader className="h-4 w-4 text-gray-600 animate-spin" />
									)) ||
									(color === 'default' && props.icon)}
							</div>
							<div className="flex-1 min-w-0">
								{title && <ToastTitle>{title}</ToastTitle>}
								{description && (
									<ToastDescription>
										{description}
									</ToastDescription>
								)}
							</div>
						</div>
						{action}
						<ToastClose />
					</Toast>
				)
			})}
			<ToastViewport />
		</ToastProvider>
	)
}
