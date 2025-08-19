import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'
import { UserProvider } from '@/contexts/UserContext'
import * as Sentry from '@sentry/nextjs'

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
				<UserProvider>
					<Header />
					<main className="min-h-screen flex-grow">
						{children}
						<Toaster />
					</main>
				</UserProvider>
			</body>
		</html>
	)
}
