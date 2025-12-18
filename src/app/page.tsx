'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
	ArrowRight,
	Calendar,
	Users,
	Shield,
	TrendingUp,
	Target,
	CheckCircle,
	ChevronDown,
	ChevronUp,
	Play,
	Pause,
	Maximize,
	Minimize
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect, useRef } from 'react'
import { captureClientEvent } from '@/lib/posthog/client'

// Temporary flag to disable video playback (only show poster). Flip to false to re-enable.
const VIDEO_DISABLED = false

export default function LandingPage() {
	const router = useRouter()
	const [isMobile, setIsMobile] = useState<boolean | null>(false)
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const [expandedStep, setExpandedStep] = useState<number | null>(null)
	const [isVideoPlaying, setIsVideoPlaying] = useState(false)
	const [isVideoPaused, setIsVideoPaused] = useState(false)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [showPauseButton, setShowPauseButton] = useState(false)
	const videoRef = useRef<HTMLVideoElement>(null)
	const videoContainerRef = useRef<HTMLDivElement>(null)
	const pauseButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	useEffect(() => {
		// Set initial value
		setIsMobile(window.innerWidth < 768)

		const handleResize = () => {
			setIsMobile(window.innerWidth < 768)
		}

		window.addEventListener('resize', handleResize)
		return () => {
			window.removeEventListener('resize', handleResize)
		}
	}, []) // Empty dependency array

	// Chart data for reporting card
	const chartData = [
		{ month: 'Ene', value: 65, amount: '€1,950' },
		{ month: 'Feb', value: 78, amount: '€2,340' },
		{ month: 'Mar', value: 85, amount: '€2,550' },
		{ month: 'Apr', value: 72, amount: '€2,160' },
		{ month: 'May', value: 45, amount: '€1,350' },
		{ month: 'Jun', value: 68, amount: '€2,040' },
		{ month: 'Jul', value: 82, amount: '€2,460' },
		{ month: 'Ago', value: 95, amount: '€2,850' }
	]

	const maxValue = Math.max(...chartData.map((d) => d.value))

	const steps = [
		{
			title: 'Agenda una nueva cita',
			description:
				'Desde la propia aplicación, crea una nueva cita para uno de tus pacientes. Verás que agendar una cita es un proceso rápido e intuitivo en el que tendrás visibilidad sobre todo tu calendario para que nunca haya conflictos.'
		},
		{
			title: 'Tu paciente recibe un email con instrucciones de pago',
			description:
				'Tu paciente recibirá un email con los detalles para realizar el pago de la consulta por anticipado. En solo dos clicks y tanto desde el móvil como desde el ordenador, podrá abonar la consulta.'
		},
		{
			title: 'Listo, cita pagada y agendada!',
			description:
				'Una vez realizado el pago, y de forma automática, la cita quedará agendada en vuestros calendarios con todos los detalles para poder acceder a la videoconferencia. No tendrás que hacer nada más.'
		}
	]

	const handleLoginRedirect = () => {
		router.push('/login')
	}

	const toggleStep = (index: number) => {
		setExpandedStep(expandedStep === index ? null : index)
	}

	const handlePlayVideo = () => {
		if (videoRef.current) {
			videoRef.current.play()
			setIsVideoPlaying(true)
			setIsVideoPaused(false)
			// Track PostHog event
			captureClientEvent('landing_page_video_play', {
				source: 'play_button'
			})
		}
	}

	const handlePauseVideo = () => {
		if (videoRef.current) {
			videoRef.current.pause()
			setIsVideoPaused(true)
		}
	}

	const handleTogglePlayPause = () => {
		if (videoRef.current) {
			if (videoRef.current.paused) {
				videoRef.current.play()
				setIsVideoPlaying(true)
				setIsVideoPaused(false)
			} else {
				videoRef.current.pause()
				setIsVideoPaused(true)
			}
		}
	}

	const handleVideoEnded = () => {
		if (videoRef.current) {
			videoRef.current.currentTime = 0
			videoRef.current.load() // Reload video to show poster
		}
		setIsVideoPlaying(false)
		setIsVideoPaused(false)
		setShowPauseButton(false)
		if (pauseButtonTimeoutRef.current) {
			clearTimeout(pauseButtonTimeoutRef.current)
		}
		// Track PostHog event
		captureClientEvent('landing_page_video_completed', {
			video_duration: videoRef.current?.duration || 0
		})
	}

	const handleVideoPlay = () => {
		setIsVideoPlaying(true)
		setIsVideoPaused(false)
		setShowPauseButton(true)
		// Hide pause button after 2 seconds
		if (pauseButtonTimeoutRef.current) {
			clearTimeout(pauseButtonTimeoutRef.current)
		}
		pauseButtonTimeoutRef.current = setTimeout(() => {
			setShowPauseButton(false)
		}, 2000)
	}

	const handleVideoPause = () => {
		setIsVideoPaused(true)
		setShowPauseButton(false)
		if (pauseButtonTimeoutRef.current) {
			clearTimeout(pauseButtonTimeoutRef.current)
		}
	}

	const handleMouseMove = () => {
		// Only show pause button if video is playing
		if (isVideoPlaying && !isVideoPaused) {
			setShowPauseButton(true)
			// Clear existing timeout and set new one
			if (pauseButtonTimeoutRef.current) {
				clearTimeout(pauseButtonTimeoutRef.current)
			}
			pauseButtonTimeoutRef.current = setTimeout(() => {
				setShowPauseButton(false)
			}, 2000)
		}
	}

	const handleToggleFullscreen = async () => {
		if (!videoContainerRef.current) return

		try {
			if (!document.fullscreenElement) {
				// Enter fullscreen
				await videoContainerRef.current.requestFullscreen()
				setIsFullscreen(true)
			} else {
				// Exit fullscreen
				await document.exitFullscreen()
				setIsFullscreen(false)
			}
		} catch (error) {
			console.error('Error toggling fullscreen:', error)
		}
	}

	// Listen for fullscreen changes
	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement)
		}

		document.addEventListener('fullscreenchange', handleFullscreenChange)
		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange)
		}
	}, [])

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (pauseButtonTimeoutRef.current) {
				clearTimeout(pauseButtonTimeoutRef.current)
			}
		}
	}, [])

	return (
		<div className="min-h-screen bg-white">
			{/* Navigation */}
			<motion.nav
				initial={{ y: -20, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ duration: 0.6 }}
				className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-sm"
			>
				<div className="max-w-7xl mx-auto px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						<div className="flex items-center">
							<span className="text-lg font-bold text-gray-900">coco.</span>
						</div>
						<Button
							size="sm"
							onClick={handleLoginRedirect}
							className="bg-gray-100 hover:bg-gray-200/90 text-gray-800 px-6 py-2 rounded-full font-normal"
						>
							Log in
						</Button>
					</div>
				</div>
			</motion.nav>

			{/* Hero Section */}
			<section className="pt-32 pb-20">
				<div className="max-w-7xl mx-auto px-6 lg:px-8">
					<motion.div
						initial={{ y: 30, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.8, delay: 0.1 }}
					>
						<p className="text-base text-gray-900 mb-16 font-normal">Sencillo. Seguro. Efectivo.</p>

						<h1
							style={{ lineHeight: 1.1 }}
							className="text-3xl md:text-5xl lg:text-6xl font-normal text-gray-900 mb-8 md:mb-16 max-w-5xl"
						>
							{isMobile ? 'Bienvenido a coco,' : 'Facilita el cobro de tus consultas.'}{' '}
							<span className="text-gray-400 font-light">
								{isMobile
									? 'la plataforma de reservas y cobro de honorarios que tu consulta online necesita.'
									: 'Coco es la plataforma de gestión de agenda y cobro de honorarios que tu consulta online necesita.'}
							</span>
						</h1>

						<Button
							onClick={handleLoginRedirect}
							className="mb-4 bg-teal-400 hover:bg-teal-400/90 text-white px-8 py-3 rounded-full text-base font-normal"
						>
							Pruébalo gratis
							<ArrowRight className="ml-2 w-4 h-4" />
						</Button>
						<br></br>
						<a
							className="text-gray-400 inline-block font-light ml-2 hover:underline"
							href="https://www.itscoco.app/hugo"
							target="_blank"
							rel="noopener noreferrer"
						>
							O agenda una demo con nosotros <ArrowRight className="ml-2 w-4 h-4 inline-block" />
						</a>
					</motion.div>
				</div>
			</section>

			{/* Dashboard Preview */}
			<section className="md:pb-20 px-4">
				<div className="w-full lg:px-20 mx-auto">
					<motion.div
						initial={{ y: 50, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.8, delay: 0.3 }}
						className="relative"
					>
						<div className="bg-gradient-to-br from-teal-50 to-teal-50 rounded-2xl p-2 md:p-0">
							<div
								ref={videoContainerRef}
								className={`${
									isFullscreen
										? 'bg-black h-screen w-screen rounded-none flex flex-col'
										: 'bg-white rounded-md md:rounded-xl shadow-2xl'
								} overflow-hidden`}
							>
								{VIDEO_DISABLED ? (
									<div className="relative">
										<img
											src="/dashboard.png"
											alt="Dashboard de Coco - Gestión de citas y pagos"
											className={isFullscreen ? 'w-full h-full object-contain' : 'w-full h-auto'}
										/>
									</div>
								) : (
									<>
										{!(isVideoPlaying || isVideoPaused) && !isFullscreen && (
											<div className="bg-gray-50 px-3 md:px-6 py-1 md:py-4 border-b border-gray-100">
												<div className="flex items-center space-x-1 md:space-x-2">
													<div className="w-1 h-1 md:w-3 md:h-3 bg-red-400 rounded-full"></div>
													<div className="w-1 h-1 md:w-3 md:h-3 bg-yellow-400 rounded-full"></div>
													<div className="w-1 h-1 md:w-3 md:h-3 bg-green-400 rounded-full"></div>
												</div>
											</div>
										)}
										<div
											className={`relative ${isFullscreen ? 'flex-1 flex items-center justify-center' : ''}`}
											onMouseMove={handleMouseMove}
										>
											<video
												ref={videoRef}
												poster="/dashboard.png"
												className={
													isFullscreen ? 'w-full h-full object-contain' : 'w-full h-auto'
												}
												onEnded={handleVideoEnded}
												onPlay={handleVideoPlay}
												onPause={handleVideoPause}
											>
												<source src="/dashboard-video-720p.mp4" type="video/mp4" />
												{/* Fallback for browsers that don't support video */}
												<img
													src="/dashboard.png"
													alt="Dashboard de Coco - Gestión de citas y pagos"
													className="w-full h-auto"
												/>
											</video>
											{/* Play Button Overlay - Shows when video hasn't started */}
											{!isVideoPlaying && !isVideoPaused && (
												<button
													onClick={handlePlayVideo}
													className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/5 transition-colors duration-200 group"
													aria-label="Reproducir video"
												>
													<div className="bg-gray-800 hover:bg-gray-700 rounded-full px-6 py-3 flex items-center space-x-3 shadow-lg transition-colors duration-200">
														<Play className="w-5 h-5 text-white fill-white" />
														<span className="text-white font-medium text-sm">Ver demo</span>
													</div>
												</button>
											)}
											{/* Pause Button Overlay - Shows when video is playing */}
											{isVideoPlaying && !isVideoPaused && showPauseButton && (
												<button
													onClick={handlePauseVideo}
													className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/5 transition-colors duration-200 group"
													aria-label="Pausar video"
												>
													<div className="bg-gray-800 hover:bg-gray-700 rounded-lg px-6 py-3 flex items-center space-x-3 shadow-lg transition-colors duration-200">
														<Pause className="w-5 h-5 text-white fill-white" />
														<span className="text-white font-medium text-sm">Pausar</span>
													</div>
												</button>
											)}
											{/* Play Button Overlay - Shows when video is paused */}
											{isVideoPaused && (
												<button
													onClick={handlePlayVideo}
													className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/5 transition-colors duration-200 group"
													aria-label="Reproducir video"
												>
													<div className="bg-gray-800 hover:bg-gray-700 rounded-lg px-6 py-3 flex items-center space-x-3 shadow-lg transition-colors duration-200">
														<Play className="w-5 h-5 text-white fill-white" />
														<span className="text-white font-medium text-sm">
															Reproducir
														</span>
													</div>
												</button>
											)}
											{/* Fullscreen Button - Bottom Right */}
											<button
												onClick={handleToggleFullscreen}
												className="absolute bottom-4 right-4 bg-gray-800/80 hover:bg-gray-700/90 text-white p-2.5 rounded-lg shadow-lg transition-colors duration-200 z-10"
												aria-label={
													isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'
												}
											>
												{isFullscreen ? (
													<Minimize className="w-5 h-5" />
												) : (
													<Maximize className="w-5 h-5" />
												)}
											</button>
										</div>
									</>
								)}
							</div>
						</div>
					</motion.div>
				</div>
			</section>

			{/* Benefits Section */}
			<section className="pt-24 pb-0 md:py-32 px-6 bg-white">
				<div className="max-w-6xl mx-auto">
					<motion.div
						initial={{ y: 30, opacity: 0 }}
						whileInView={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.6 }}
						viewport={{ once: true }}
						className="text-center mb-20"
					>
						<div className="flex justify-center mb-8">
							<Badge className="text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 px-4 py-2 rounded-full text-sm font-normal">
								Diseñado para profesionales de la salud
							</Badge>
						</div>
						<h2
							style={{ lineHeight: 1.2 }}
							className="text-3xl md:text-4xl lg:text-5xl font-normal text-gray-900 mb-8 max-w-3xl mx-auto"
						>
							Digitaliza tu consulta
						</h2>
						<p className="text-base lg:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed font-light">
							Coco automatiza tanto la gestión de tu agenda como el cobro de tus honorarios, haciendo que
							puedas dedicar tu tiempo a lo que realmente importa.
						</p>
					</motion.div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:mt-20 rounded-lg overflow-hidden">
						{[
							{
								icon: Target,
								title: 'Evita malentendidos',
								description: 'Con coco tus pacientes y tú estaréis siempre en la misma página.'
							},
							{
								icon: Users,
								title: 'Olvídate de impagos',
								description:
									'Crea una cita en tres sencillos pasos y olvídate del resto, coco lo tiene todo controlado.'
							},
							{
								icon: Shield,
								title: 'Tus cuentas, cuadradas',
								description: 'Deja de dedicarle horas a cuadrar tus cuentas, coco te lo pone muy fácil.'
							}
						].map((benefit, index) => (
							<motion.div
								key={index}
								initial={{ y: 30, opacity: 0 }}
								whileInView={{ y: 0, opacity: 1 }}
								transition={{
									duration: 0.6,
									delay: index * 0.1
								}}
								viewport={{ once: true }}
								className={`text-left font-light p-8 lg:p-12 bg-white ${
									index == 1 ? 'sm:border-y lg:border-y-0 lg:border-x border-gray-200' : ''
								}`}
							>
								<div className="mb-6 flex flex-row items-center space-x-2">
									<CheckCircle className="w-5 h-5 text-gray-800 mr-2" />
									<h3 className="text-xl font-semibold text-gray-900 leading-tight">
										{benefit.title}
									</h3>
								</div>

								<p className="text-gray-600 leading-relaxed text-base">{benefit.description}</p>
							</motion.div>
						))}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="pt-20 md:py-20 px-2 md:px-6 bg-white">
				<div className="max-w-7xl mx-auto px-6 lg:px-8">
					<motion.div
						initial={{ y: 30, opacity: 0 }}
						whileInView={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.6 }}
						viewport={{ once: true }}
						className="flex flex-col lg:flex-row lg:items-start lg:justify-between"
					>
						<div className="mb-8 lg:mb-0 flex-1">
							<h2
								className="text-3xl md:text-4xl lg:text-5xl font-normal text-gray-900 max-w-4xl"
								style={{ lineHeight: '1.2' }}
							>
								<span className="text-gray-400 font-light">En menos de 10 minutos tendrás</span> tu
								propia agenda virtual con pasarela de pago integrada.
								<span className="text-gray-400 font-light"> Así de fácil.</span>
							</h2>
						</div>
						<div className="flex-shrink-0 lg:ml-8 lg:mt-2">
							<Button
								onClick={handleLoginRedirect}
								className="bg-teal-400 hover:bg-teal-400/90 text-white px-8 py-3 rounded-full text-base font-normal"
							>
								Pruébalo
								<ArrowRight className="ml-2 w-4 h-4" />
							</Button>
						</div>
					</motion.div>
				</div>
			</section>

			{/* New Features Grid Section */}
			<section className="py-32 lg:px-32 px-6 bg-white">
				<div className="max-w-6xl mx-auto">
					<motion.div
						initial={{ y: 30, opacity: 0 }}
						whileInView={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.6 }}
						viewport={{ once: true }}
						className="text-center mb-20"
					>
						<div className="flex justify-center mb-8">
							<Badge className="text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 px-4 py-2 rounded-full text-sm font-normal tracking-wide">
								Nuestras funcionalidades
							</Badge>
						</div>
						<h2
							style={{ lineHeight: 1.2 }}
							className="text-3xl md:text-4xl lg:text-5xl font-normal text-gray-900 mb-8 max-w-4xl mx-auto leading-tight"
						>
							Funcionalidades pensadas para hacerte la vida más fácil
						</h2>
					</motion.div>

					{/* Top Row - 2 Large Cards */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
						{/* Google Calendar Integration */}
						<motion.div
							initial={{ y: 30, opacity: 0 }}
							whileInView={{ y: 0, opacity: 1 }}
							transition={{ duration: 0.6, delay: 0.1 }}
							viewport={{ once: true }}
							className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
						>
							<div className="bg-gray-50 p-12 flex items-center justify-center min-h-[280px]">
								<div className="text-center">
									<div className="flex items-center justify-center space-x-4 mb-6">
										{/* Coco Logo */}
										<div className="w-16 h-16 bg-teal-400 rounded-2xl flex items-center justify-center shadow-lg">
											<Calendar className="w-8 h-8 text-white" />
										</div>
										<div className="text-4xl text-gray-400">↔</div>
										{/* Google Calendar Logo */}
										<div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-gray-200">
											<svg width="32" height="32" viewBox="0 0 24 24" fill="none">
												<path
													d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"
													fill="#4285F4"
												/>
											</svg>
										</div>
									</div>
									<div className="space-y-3">
										<div className="h-3 bg-blue-200 rounded-full w-48 mx-auto"></div>
										<div className="h-3 bg-gray-200 rounded-full w-32 mx-auto"></div>
										<div className="h-3 bg-green-200 rounded-full w-40 mx-auto"></div>
									</div>
								</div>
							</div>
							<div className="p-8">
								<h3 className="text-xl font-semibold text-gray-900 mb-3">
									Integrado con Google Calendar
								</h3>
								<p className="text-gray-700 font-light leading-relaxed">
									Coco está integrado con Google Calendar haciendo que gestionar tu agenda sea fácil e
									intuitvo.
								</p>
							</div>
						</motion.div>

						{/* Google & Apple Pay */}
						<motion.div
							initial={{ y: 30, opacity: 0 }}
							whileInView={{ y: 0, opacity: 1 }}
							transition={{ duration: 0.6, delay: 0.2 }}
							viewport={{ once: true }}
							className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
						>
							<div className="bg-gray-50 p-12 flex items-center justify-center min-h-[280px]">
								<div className="text-center">
									<div className="flex items-center justify-center space-x-4 mb-6">
										{/* Google Pay Logo */}
										<div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg border border-gray-200">
											<svg width="28" height="28" viewBox="0 0 24 24" fill="none">
												<path
													d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"
													fill="#4285F4"
												/>
											</svg>
										</div>
										{/* Apple Pay Logo */}
										<div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center shadow-lg">
											<svg width="28" height="28" viewBox="0 0 24 24" fill="white">
												<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
											</svg>
										</div>
									</div>
									<div className="bg-white rounded-xl px-10 py-6 shadow-sm border border-gray-200 max-w-xs mx-auto">
										<div className="text-2xl font-bold text-gray-900 mb-2">€75.00</div>
										<div className="text-sm text-gray-500 mb-4">Consulta con Laura García</div>
										<div className="w-full h-10 px-4 bg-gray-800 rounded-lg flex items-center justify-center">
											<span className="text-white font-regular">
												Confirmar {isMobile ? 'cita' : 'consulta'}
											</span>
										</div>
									</div>
								</div>
							</div>
							<div className="p-8">
								<h3 className="text-xl font-semibold text-gray-900 mb-3">
									Integrado con Google y Apple Pay
								</h3>
								<p className="text-gray-700 font-light leading-relaxed">
									Olvídate de transferencias bancarias o bizums, con coco tus pacientes pagan de forma
									rápida y segura.
								</p>
							</div>
						</motion.div>
					</div>

					{/* Bottom Row - 3 Smaller Cards */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						{/* Reporting */}
						<motion.div
							initial={{ y: 30, opacity: 0 }}
							whileInView={{ y: 0, opacity: 1 }}
							transition={{ duration: 0.6, delay: 0.3 }}
							viewport={{ once: true }}
							className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
						>
							<div className="bg-gray-50 p-6 flex items-center justify-center min-h-[200px]">
								<div className="rounded-xl p-6 w-full max-w-sm border border-gray-200">
									{/* Chart Header */}
									<div className="flex items-center justify-between mb-4">
										<div className="flex items-center space-x-1 text-gray-800">
											<TrendingUp className="w-3 h-3" />
											<span className="text-xs font-medium">25%</span>
										</div>
									</div>

									{/* Chart */}
									<div className="flex items-end justify-between space-x-1 h-20 mb-2">
										{chartData.map((data, index) => (
											<div key={index} className="flex flex-col items-center space-y-1">
												<div
													className="bg-gray-700 rounded-t-sm transition-all duration-500 ease-out"
													style={{
														height: `${(data.value / maxValue) * 60}px`,
														width: '12px'
													}}
												></div>
											</div>
										))}
									</div>

									{/* Month Labels */}
									<div className="flex items-center justify-between font-light sm:text-gray-50 text-xs lg:text-gray-500">
										{chartData.map((data, index) => (
											<span key={index} className="text-center" style={{ width: '12px' }}>
												{data.month}
											</span>
										))}
									</div>
								</div>
							</div>
							<div className="p-6">
								<h3 className="text-lg font-semibold text-gray-900 mb-2">Reporting integrado</h3>
								<p className="text-gray-700 font-light text-sm leading-relaxed">
									La información que necesitas cuando la necesitas. Fácil y sin complicaciones.
								</p>
							</div>
						</motion.div>

						{/* Smart Reminders */}
						<motion.div
							initial={{ y: 30, opacity: 0 }}
							whileInView={{ y: 0, opacity: 1 }}
							transition={{ duration: 0.6, delay: 0.4 }}
							viewport={{ once: true }}
							className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
						>
							<div className="bg-gray-50 py-8 px-4 flex items-center justify-center min-h-[200px]">
								<div className="w-full max-w-sm space-y-2">
									{/* Reminder Card 1 - Payment Pending */}

									{/* Reminder Card 2 - Payment Received */}
									<div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 opacity-75">
										<div className="flex items-center justify-between">
											<div className="flex items-center space-x-2">
												<div className="text-xs font-medium text-gray-900 lg:mr-4">10:30</div>
												<div>
													<p className="text-xs font-medium text-gray-900">Carlos R.</p>
													<p className="text-xs text-gray-500">Pago recibido</p>
												</div>
											</div>
											<span className="text-xs px-2 lg:px-4 py-1 rounded-full bg-teal-100 text-teal-700">
												Pagado
											</span>
										</div>
									</div>

									{/* Reminder Card 3 - Upcoming Reminder */}
									<div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 opacity-50">
										<div className="flex items-center justify-between">
											<div className="flex items-center space-x-2">
												<div className="text-xs font-medium text-gray-900 lg:mr-4">12:00</div>
												<div>
													<p className="text-xs font-medium text-gray-900">Ana L.</p>
													<p className="text-xs text-gray-500">Próximo recordatorio</p>
												</div>
											</div>
											<span className="text-xs px-2 lg:px-4 py-1 rounded-full bg-gray-200 text-gray-700">
												2 días
											</span>
										</div>
									</div>
								</div>
							</div>
							<div className="p-6">
								<h3 className="text-lg font-semibold text-gray-900 mb-2">
									Generación automática de facturas
								</h3>
								<p className="text-gray-600 text-sm font-light leading-relaxed">
									Para cada cita que creas, Coco se encarga de generar las correspondientes facturas
									de forma automática.
								</p>
							</div>
						</motion.div>

						{/* Responsive Design */}
						<motion.div
							initial={{ y: 30, opacity: 0 }}
							whileInView={{ y: 0, opacity: 1 }}
							transition={{ duration: 0.6, delay: 0.5 }}
							viewport={{ once: true }}
							className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
						>
							<div className="bg-gray-50 py-16 px-4 flex items-center justify-center min-h-[200px]">
								<div className="relative">
									{/* Desktop/Tablet Device */}
									<div className="relative bg-white rounded-xl shadow-lg border border-gray-200 w-32 h-20 p-2">
										{/* Blue dot indicator */}
										<div className="absolute top-2 left-2 w-1.5 h-1.5 bg-teal-500 rounded-full"></div>

										{/* Content bars */}
										<div className="mt-3 space-y-1">
											<div className="h-1.5 bg-gray-200 rounded-full w-20"></div>
											<div className="h-1.5 bg-gray-200 rounded-full w-16"></div>
											<div className="h-1.5 bg-gray-200 rounded-full w-12"></div>
											<div className="h-2 bg-teal-500 rounded-full w-10 mt-2"></div>
										</div>
									</div>

									{/* Mobile Device - Overlapping */}
									<div className="absolute -bottom-2 -right-4 bg-white rounded-lg shadow-lg border border-gray-200 w-16 h-24 p-1.5">
										{/* teal dot indicator */}
										<div className="absolute top-1.5 left-1.5 w-1 h-1 bg-teal-500 rounded-full"></div>

										{/* Content bars */}
										<div className="mt-2 space-y-1">
											<div className="h-1 bg-gray-200 rounded-full w-10"></div>
											<div className="h-1 bg-gray-200 rounded-full w-8"></div>
											<div className="h-1 bg-gray-200 rounded-full w-6"></div>
											<div className="h-1.5 bg-teal-500 rounded-full w-7 mt-1.5"></div>
										</div>
									</div>
								</div>
							</div>
							<div className="p-6">
								<h3 className="text-lg font-semibold text-gray-900 mb-2">
									Diseño moderno y responsive
								</h3>
								<p className="text-gray-700 font-light text-sm leading-relaxed">
									Coco se adapta tanto a ti como tus pacientes, facilitándote la gestión estés donde
									estés.
								</p>
							</div>
						</motion.div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="md:pt-20 pb-44 px-1 md:px-6 bg-white">
				<div className="max-w-7xl mx-auto px-6 lg:px-8">
					<motion.div
						initial={{ y: 30, opacity: 0 }}
						whileInView={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.6 }}
						viewport={{ once: true }}
						className="flex flex-col lg:flex-row lg:items-start lg:justify-between"
					>
						<div className="mb-8 lg:mb-0 flex-1">
							<h2
								className="text-3xl md:text-4xl lg:text-5xl font-normal text-gray-900 max-w-4xl"
								style={{ lineHeight: '1.2' }}
							>
								Tu trabajo es mejorar la vida de tus pacientes,{' '}
								<span className="text-gray-400 font-light">
									nosotros te facilitamos el cobro de honorarios. Empieza hoy.
								</span>
							</h2>
						</div>
						<div className="flex-shrink-0 lg:ml-8 lg:mt-2">
							<Button
								onClick={handleLoginRedirect}
								className="bg-teal-400 hover:bg-teal-400/90 text-white px-8 py-3 rounded-full text-base font-normal"
							>
								Pruébalo
								<ArrowRight className="ml-2 w-4 h-4" />
							</Button>
						</div>
					</motion.div>
				</div>
			</section>

			{/* Cómo funciona Section */}
			<section className="md:py-10 px-6 bg-white">
				<div className="max-w-6xl mx-auto">
					<motion.div
						initial={{ y: 30, opacity: 0 }}
						whileInView={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.6 }}
						viewport={{ once: true }}
						className="mb-16"
					>
						<h2 className="text-lg font-light text-gray-900 mb-6">Cómo funciona</h2>

						<div className="space-y-0">
							{steps.map((step, index) => (
								<motion.div
									key={index}
									initial={{ y: 20, opacity: 0 }}
									whileInView={{ y: 0, opacity: 1 }}
									transition={{
										duration: 0.6,
										delay: index * 0.1
									}}
									viewport={{ once: true }}
									className="border-b border-gray-200 last:border-b-0 px-4 hover:bg-gray-50"
								>
									<button
										onClick={() => toggleStep(index)}
										className="w-full py-8 flex items-center justify-between text-left  transition-colors duration-200"
									>
										<h3 className="text-xl md:text-3xl font-normal text-gray-900">
											{index + 1}. {step.title}
										</h3>
										<div className="flex-shrink-0 ml-4">
											{expandedStep === index ? (
												<ChevronUp className="w-6 h-6 text-gray-400" />
											) : (
												<ChevronDown className="w-6 h-6 text-gray-400" />
											)}
										</div>
									</button>

									<AnimatePresence>
										{expandedStep === index && (
											<motion.div
												initial={{
													height: 0,
													opacity: 0
												}}
												animate={{
													height: 'auto',
													opacity: 1
												}}
												exit={{ height: 0, opacity: 0 }}
												transition={{
													duration: 0.3,
													ease: 'easeInOut'
												}}
												className="overflow-hidden"
											>
												<div className="pb-8 pr-10">
													<p className="text-base lg:text-lg text-gray-700 font-light leading-relaxed">
														{step.description}
													</p>
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</motion.div>
							))}
						</div>
					</motion.div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="pt-20 pb-44 px-2 md:px-6 bg-white">
				<div className="max-w-7xl mx-auto px-6 lg:px-8">
					<motion.div
						initial={{ y: 30, opacity: 0 }}
						whileInView={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.6 }}
						viewport={{ once: true }}
						className="flex flex-col lg:flex-row lg:items-start lg:justify-between"
					>
						<div className="mb-8 lg:mb-0 flex-1">
							<h2
								className="text-3xl md:text-4xl lg:text-5xl font-normal text-gray-900 max-w-4xl"
								style={{ lineHeight: '1.2' }}
							>
								¿Todavía te quedan dudas?{' '}
								<span className="text-gray-400 font-light">
									Escríbenos y te responderemos lo antes posible.
								</span>
							</h2>
						</div>
						<div className="flex-shrink-0 lg:ml-8 lg:mt-2">
							<Button
								onClick={() => window.open('mailto:hugo@itscoco.app')}
								className="bg-gray-200 hover:bg-gray-200/90 text-gray-900 px-8 py-3 rounded-full text-base font-normal"
							>
								Escríbenos
								<ArrowRight className="ml-2 w-4 h-4" />
							</Button>
						</div>
					</motion.div>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-8 px-32 bg-gray-50">
				<div className="mx-auto flex flex-col md:flex-row justify-between items-center">
					<div className="flex space-x-6 text-sm text-gray-500">
						<Link href="/privacy-policy" className="hover:text-gray-900 transition-colors">
							Privacidad
						</Link>
						<a href="#" className="hover:text-gray-900 transition-colors">
							Términos
						</a>
						<p
							onClick={() => window.open('mailto:hugo@itscoco.app')}
							className="hover:text-gray-900 transition-colors"
						>
							Contacto
						</p>
					</div>
				</div>
			</footer>
		</div>
	)
}
