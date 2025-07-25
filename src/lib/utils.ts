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
