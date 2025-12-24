'use client'

import { Fragment, useEffect, useRef } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'

interface SideSheetHeadlessProps {
	isOpen: boolean
	onClose: () => void
	title: React.ReactNode
	description?: React.ReactNode
	children: React.ReactNode
	width?: string
	onScrollableRef?: (ref: HTMLDivElement | null) => void
}

export function SideSheetHeadless({
	isOpen,
	onClose,
	title,
	description,
	children,
	width,
	onScrollableRef
}: SideSheetHeadlessProps) {
	const scrollableRef = useRef<HTMLDivElement>(null)

	// Expose scrollable ref to parent
	useEffect(() => {
		if (onScrollableRef) {
			onScrollableRef(scrollableRef.current)
		}
	}, [onScrollableRef, isOpen])

	// Lock body scroll while the sheet is open to prevent background scroll
	useEffect(() => {
		if (isOpen) {
			const original = document.body.style.overflow
			document.body.style.overflow = 'hidden'
			return () => {
				document.body.style.overflow = original
			}
		}
	}, [isOpen])

	return (
		<Transition.Root show={isOpen} as={Fragment}>
			<Dialog as="div" className="relative z-[60]" onClose={onClose}>
				{/* Overlay */}
				<Transition.Child
					as={Fragment}
					enter="ease-out duration-200"
					enterFrom="opacity-0"
					enterTo="opacity-100"
					leave="ease-in duration-150"
					leaveFrom="opacity-100"
					leaveTo="opacity-0"
				>
					<div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
				</Transition.Child>

				<div className="fixed inset-0 overflow-hidden">
					<div className="absolute inset-0 overflow-hidden">
						<div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full">
							<Transition.Child
								as={Fragment}
								enter="transform transition ease-out duration-300"
								enterFrom="translate-x-full"
								enterTo="translate-x-0"
								leave="transform transition ease-in duration-200"
								leaveFrom="translate-x-0"
								leaveTo="translate-x-full"
							>
								<Dialog.Panel className="pointer-events-auto w-screen md:max-w-md lg:max-w-lg bg-gray-50 shadow-xl coco-sidesheet">
									<div className="h-full flex flex-col p-6">
										<div className="mb-4">
											<button
												onClick={onClose}
												className="p-2 -mt-1 -ml-2 mb-3 rounded-full hover:bg-gray-200 active:bg-gray-300 transition-colors touch-manipulation"
												aria-label="Cerrar"
											>
												<X className="h-5 w-5 text-gray-700" />
											</button>
											<Dialog.Title className="text-xl md:text-2xl font-bold">
												{title}
											</Dialog.Title>
											{description && (
												<p className="mt-1 text-sm text-gray-600">
													{description}
												</p>
											)}
										</div>
										<div ref={scrollableRef} className="flex-1 overflow-y-auto scrollbar-hide">
											{children}
										</div>
									</div>
								</Dialog.Panel>
							</Transition.Child>
						</div>
					</div>
				</div>
			</Dialog>
		</Transition.Root>
	)
}
