// Spanish date/time formatting helpers

import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Formats a Date into Spanish long date, capitalizing weekday and month.
 * Example: "Jueves, 16 de Octubre de 2025"
 */
export function formatSpanishLongDate(date: Date): string {
	const label = format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
	return label.replace(/^./, (c) => c.toUpperCase()).replace(/ de ([a-z])/, (match, p1) => ` de ${p1.toUpperCase()}`)
}

/**
 * Formats a Date time in 24h Spanish format.
 * Example: "14:05"
 */
export function formatSpanishTime24h(date: Date): string {
	return format(date, 'HH:mm', { locale: es })
}

/**
 * Formats a Date into "long date a las HH:mm" in Spanish.
 * Example: "Jueves, 16 de Octubre de 2025 a las 14:05"
 */
export function formatSpanishDateWithTime(date: Date): string {
	return `${formatSpanishLongDate(date)} a las ${formatSpanishTime24h(date)}`
}
