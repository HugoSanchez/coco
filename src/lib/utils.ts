import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

/**
 * Date and time utility functions
 * Provides consistent date formatting across the application
 */

/**
 * Gets the current month name in Spanish
 * @returns {string} Current month name (e.g., "julio", "agosto")
 *
 * @example
 * getCurrentMonthName() // "julio" (if current month is July)
 */
export function getCurrentMonthName(): string {
	return format(new Date(), 'MMMM', { locale: es })
}

/**
 * Gets the month name for any given date in Spanish
 * @param {Date} date - The date to get the month name from
 * @returns {string} Month name (e.g., "julio", "agosto")
 *
 * @example
 * getMonthName(new Date('2024-07-15')) // "julio"
 */
export function getMonthName(date: Date): string {
	return format(date, 'MMMM', { locale: es })
}

/**
 * Gets the current month name in Spanish with capitalized first letter
 * @returns {string} Capitalized current month name (e.g., "Julio", "Agosto")
 *
 * @example
 * getCurrentMonthNameCapitalized() // "Julio" (if current month is July)
 */
export function getCurrentMonthNameCapitalized(): string {
	const monthName = getCurrentMonthName()
	return monthName.charAt(0).toUpperCase() + monthName.slice(1)
}

/**
 * Gets the month name for any given date in Spanish with capitalized first letter
 * @param {Date} date - The date to get the month name from
 * @returns {string} Capitalized month name (e.g., "Julio", "Agosto")
 *
 * @example
 * getMonthNameCapitalized(new Date('2024-07-15')) // "Julio"
 */
export function getMonthNameCapitalized(date: Date): string {
	const monthName = getMonthName(date)
	return monthName.charAt(0).toUpperCase() + monthName.slice(1)
}

/**
 * URL utility functions
 * Provides consistent URL construction across the application
 */

/**
 * Gets the base URL for the application
 * Uses NEXT_PUBLIC_BASE_URL environment variable or falls back to localhost
 * @returns {string} The base URL (e.g., "https://yourdomain.com" or "http://localhost:3000")
 *
 * @example
 * getBaseUrl() // "https://yourdomain.com" in production, "http://localhost:3000" in development
 */
export function getBaseUrl(): string {
	return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}

/**
 * Constructs a full URL for a given path
 * @param {string} path - The path to append to the base URL (should start with '/')
 * @returns {string} The full URL
 *
 * @example
 * getUrl('/api/auth/callback') // "https://yourdomain.com/api/auth/callback"
 */
export function getUrl(path: string): string {
	const baseUrl = getBaseUrl()
	return `${baseUrl}${path}`
}

/**
 * Converts an array of objects into an RFC4180-compliant CSV string.
 * - Ensures proper quoting for commas, quotes, and newlines
 * - Preserves header order as provided
 */
export function toCsv(headers: string[], rows: Array<Record<string, any>>): string {
	const escape = (value: any): string => {
		if (value === null || typeof value === 'undefined') return ''
		const str = String(value)
		// Quote if contains comma, quote, or newline
		if (/[",\n\r]/.test(str)) {
			return '"' + str.replace(/"/g, '""') + '"'
		}
		return str
	}

	const headerLine = headers.map(escape).join(',')
	const lines = rows.map((row) => headers.map((h) => escape(row[h])).join(','))
	return [headerLine, ...lines].join('\r\n') + '\r\n'
}

/**
 * Computes when a payment email should be sent based on a lead-time policy.
 * - leadHours: null or 0 => immediate (now)
 * - leadHours: -1 => after consultation (endIso)
 * - leadHours: >0 => that many hours before startIso
 * Returns an ISO string, or null if no schedule should be set.
 */
export function computeEmailScheduledAt(
	leadHours: number | null | undefined,
	startIso: string,
	endIso: string,
	now: Date = new Date()
): string | null {
	if (leadHours == null || leadHours === 0) return now.toISOString()
	if (leadHours === -1) return endIso
	if (leadHours > 0) {
		const start = new Date(startIso)
		const when = new Date(start.getTime() - leadHours * 60 * 60 * 1000)
		return when.toISOString()
	}
	return null
}

/**
 * Lightweight localStorage helpers for booking visit tracking
 */
export function hasVisitedBooking(username: string): boolean {
	if (typeof window === 'undefined') return false
	try {
		return !!localStorage.getItem(`booking:visited:${username}`)
	} catch {
		return false
	}
}

export function markVisitedBooking(username: string): void {
	if (typeof window === 'undefined') return
	try {
		localStorage.setItem(`booking:visited:${username}`, '1')
	} catch {}
}
