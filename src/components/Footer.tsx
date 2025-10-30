'use client'

import Link from 'next/link'

/**
 * Footer Component
 *
 * A simple footer that appears on all pages with links to legal pages
 * and contact information.
 *
 * FEATURES:
 * - Privacy policy link
 * - Terms of service link (placeholder)
 * - Contact information
 * - Responsive design
 *
 * @component
 * @example
 * ```tsx
 * <Footer />
 * ```
 */
export default function Footer() {
	return (
		<footer className="py-6 px-4 bg-gray-50 border-t border-gray-200">
			<div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
				<div className="flex space-x-6 text-sm text-gray-500 mb-4 md:mb-0">
					<Link href="/privacy-policy" className="hover:text-gray-900 transition-colors">
						Privacidad
					</Link>
					<a href="#" className="hover:text-gray-900 transition-colors">
						Términos
					</a>
					<button
						onClick={() => window.open('mailto:hugo@itscoco.app')}
						className="hover:text-gray-900 transition-colors"
					>
						Contacto
					</button>
				</div>
				<div className="text-sm text-gray-400">© 2025 Itsverso Inc. Todos los derechos reservados.</div>
			</div>
		</footer>
	)
}
