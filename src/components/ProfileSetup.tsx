'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import { useUser } from '@/contexts/UserContext'
import {
	validateUsername,
	updateProfile,
	uploadProfilePicture
} from '@/lib/db/profiles'
import { useToast } from '@/components/ui/use-toast'
import { captureOnboardingStep } from '@/lib/posthog/client'
import { usePathname } from 'next/navigation'

interface ProfileSetupProps {
	onComplete: () => void
	title?: string
	subtitle?: string
	buttonText?: string
	loadingText?: string
	showSuccessToast?: boolean
	skipOnComplete?: boolean
}

export function ProfileSetup({
	onComplete,
	title,
	subtitle,
	buttonText,
	loadingText,
	showSuccessToast,
	skipOnComplete
}: ProfileSetupProps) {
	const { user, profile, refreshProfile } = useUser()
	const { toast } = useToast()
	const pathname = usePathname()
	const [name, setName] = useState('')
	const [username, setUsername] = useState('')
	const [description, setDescription] = useState('')
	const [profilePicture, setProfilePicture] = useState<File | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)
	const [usernameError, setUsernameError] = useState('')

	useEffect(() => {
		if (profile) {
			setName(profile.name || '')
			setUsername(profile.username || '')
			setDescription(profile.description || '')
			setPreviewUrl(profile.profile_picture_url || null)
		}
	}, [profile])

	// Settings-only: default in-person location
	const showDefaultLocation = pathname === '/settings'
	const [defaultLocation, setDefaultLocation] = useState('')
	useEffect(() => {
		if (profile?.default_in_person_location_text) {
			setDefaultLocation(profile.default_in_person_location_text)
		}
	}, [profile?.default_in_person_location_text])

	const handleUsernameChange = async (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const newUsername = e.target.value
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, '-')
		setUsername(newUsername)

		if (newUsername.length < 3) {
			setUsernameError('Username must be at least 3 characters')
			return
		}

		const isAvailable = await validateUsername(
			newUsername,
			profile?.username
		)
		if (!isAvailable) {
			setUsernameError('This username is already taken')
		} else {
			setUsernameError('')
		}
	}

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (usernameError) return

		setIsLoading(true)

		try {
			let profile_picture_url = previewUrl
			if (profilePicture) {
				profile_picture_url = await uploadProfilePicture(
					user.id,
					profilePicture
				)
			}

			await updateProfile(user.id, {
				name: name.trim(),
				username: username.toLowerCase().trim().replace(/\s+/g, '-'),
				description,
				email: user.email,
				profile_picture_url,
				...(showDefaultLocation && defaultLocation.trim()
					? {
							default_in_person_location_text:
								defaultLocation.trim()
						}
					: {})
			})

			await refreshProfile() // Refresh the global profile state

			// Track onboarding step completion (client-side)
			captureOnboardingStep('account_profile_saved')

			// Show success toast only if enabled
			if (showSuccessToast) {
				toast({
					title: 'Perfil actualizado correctamente',
					color: 'success'
				})
			}

			if (!skipOnComplete) {
				onComplete()
			}
		} catch (error) {
			console.error('Error:', error)
			// Show error toast if there was an error and toasts are enabled
			if (showSuccessToast) {
				toast({
					title: 'Error',
					description:
						'Hubo un problema al guardar los cambios. Inténtalo de nuevo.',
					color: 'error'
				})
			}
		} finally {
			setIsLoading(false)
		}
	}

	const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (file) {
			if (previewUrl && previewUrl.startsWith('blob:')) {
				URL.revokeObjectURL(previewUrl)
			}

			setProfilePicture(file)
			setPreviewUrl(URL.createObjectURL(file))
		}
	}

	const handleRemoveImage = () => {
		if (previewUrl && previewUrl.startsWith('blob:')) {
			URL.revokeObjectURL(previewUrl)
		}
		setProfilePicture(null)
		setPreviewUrl(null)
	}

	return (
		<div>
			<form onSubmit={handleSubmit} className="space-y-8">
				<div>
					<h2 className="text-2xl font-bold">
						{title || 'Crea tu perfil'}
					</h2>
					<p className="text-md text-gray-500 my-2">
						{subtitle ||
							'Añade la información necesaria para que tus pacientes te conozcan.'}
					</p>
				</div>
				<div>
					<label
						htmlFor="name"
						className="block text-md font-medium text-gray-700"
					>
						Foto de perfil
					</label>
					<div className="mt-2 flex flex-col space-y-3">
						<div className="relative w-20 h-20">
							<label
								htmlFor="profile-picture"
								className="cursor-pointer block"
							>
								{previewUrl ? (
									<>
										<div className="relative w-20 h-20 rounded-full overflow-hidden hover:opacity-90 transition-opacity">
											<img
												src={previewUrl}
												alt="Profile preview"
												style={{
													objectFit: 'cover',
													width: '100%',
													height: '100%'
												}}
												onError={(e) => {
													console.error(
														'Error loading image:',
														e
													)
													console.log(
														'Failed URL:',
														previewUrl
													)
												}}
											/>
										</div>
										<button
											type="button"
											onClick={(e) => {
												e.preventDefault()
												handleRemoveImage()
											}}
											className="absolute -top-1 -right-1 bg-black text-white rounded-full p-0.5 hover:bg-gray-800"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												className="h-3.5 w-3.5"
												viewBox="0 0 20 20"
												fill="currentColor"
											>
												<path
													fillRule="evenodd"
													d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
													clipRule="evenodd"
												/>
											</svg>
										</button>
									</>
								) : (
									<div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-7 w-7 text-gray-400"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M12 6v6m0 0v6m0-6h6m-6 0H6"
											/>
										</svg>
									</div>
								)}
							</label>
							<input
								id="profile-picture"
								type="file"
								accept="image/*"
								onChange={handleImageChange}
								className="hidden"
							/>
						</div>
						<div>
							<span
								className="text-sm text-teal-600 hover:text-teal-500 cursor-pointer"
								onClick={() =>
									document
										.getElementById('profile-picture')
										?.click()
								}
							>
								{previewUrl ? 'Cambiar imagen' : 'Subir imagen'}
							</span>
							<p className="text-xs text-gray-500 mt-1">
								JPG, PNG or GIF (max. 2MB)
							</p>
						</div>
					</div>
				</div>

				<div>
					<label
						htmlFor="name"
						className="block text-md font-medium text-gray-700"
					>
						Nombre
					</label>
					<p className="text-sm text-gray-500 mb-2">
						Tu nombre real, para que tus pacientes te reconozcan
					</p>
					<Input
						id="name"
						type="text"
						value={name}
						required
						onChange={(e) => setName(e.target.value)}
						onInvalid={(e) => e.preventDefault()}
						className="autofill:bg-white transition-none text-gray-700"
					/>
				</div>

				<div>
					<label
						htmlFor="username"
						className="block text-md font-medium text-gray-700"
					>
						Nombre de usuario
					</label>
					<p className="text-sm text-gray-500 mb-2">
						Debe de ser único, ten en cuenta que puede ser público.
					</p>
					<Input
						id="username"
						type="text"
						value={username}
						required
						onChange={handleUsernameChange}
						className={`autofill:bg-white transition-none text-gray-700 ${
							usernameError ? 'border-red-500' : ''
						}`}
					/>
					{usernameError && (
						<p className="text-red-500 text-sm mt-1">
							{usernameError}
						</p>
					)}
					<p className="text-xs text-gray-500 my-2">
						itscoco.app/book/{username}
					</p>
				</div>

				<div hidden>
					<label
						htmlFor="description"
						className="block text-md font-medium text-gray-700"
					>
						Calendar Description
					</label>
					<p className="text-sm text-gray-500 mb-2">
						Help your clients understand what they are booking.
					</p>
					<Textarea
						id="description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className="autofill:bg-white transition-none text-gray-700"
						rows={3}
					/>
				</div>
				{showDefaultLocation && (
					<div>
						<label
							htmlFor="default_location"
							className="block text-md font-medium text-gray-700"
						>
							Dirección
						</label>
						<p className="text-sm text-gray-500 mb-2">
							Se usará como dirección por defecto para citas
							presenciales.
						</p>
						<Input
							id="default_location"
							type="text"
							value={defaultLocation}
							onChange={(e) => setDefaultLocation(e.target.value)}
							className="autofill:bg-white transition-none text-gray-700"
						/>
					</div>
				)}
				<div className="">
					<Button
						type="submit"
						variant="default"
						disabled={isLoading || !name}
						className="h-12 w-full shadow-sm text-md"
					>
						{isLoading
							? loadingText || 'Guardando...'
							: buttonText || 'Continuar'}
					</Button>
				</div>
			</form>
		</div>
	)
}

/**
 *
 */
