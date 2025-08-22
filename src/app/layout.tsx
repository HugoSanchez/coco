import type { Metadata } from 'next'
import Header from '@/components/Header'
import CalendarBanner from '@/components/CalendarBanner'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'
import { UserProvider } from '@/contexts/UserContext'
import * as Sentry from '@sentry/nextjs'
import { PostHogProvider } from '@/components/PostHogProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
	title: 'Coco App',
	description:
		'Coco es la plataforma de gestión de agenda y cobro de honorarios que tu consulta online necesita',
	icons: {
		icon: '/favicon.ico'
	},
	openGraph: {
		title: 'Coco App',
		description:
			'Coco es la plataforma de gestión de agenda que tu consulta online necesita',
		url: 'https://itscoco.app',
		siteName: 'Coco App',
		locale: 'es_ES',
		type: 'website'
	},
	other: {
		...Sentry.getTraceData()
	}
}

export default function RootLayout({
	children
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="en">
			<body
				className={`${inter.className} flex flex-col h-full bg-gray-50`}
			>
				<PostHogProvider>
					<UserProvider>
						<Header />
						<CalendarBanner />
						<main className="min-h-screen flex-grow">
							{children}
							<Toaster />
						</main>
					</UserProvider>
				</PostHogProvider>
			</body>
		</html>
	)
}
