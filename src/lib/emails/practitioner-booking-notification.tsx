import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'

interface PractitionerBookingNotificationEmailProps {
	practitionerName?: string
	consultationType: 'first' | 'followup'
	patientFullName: string
	patientEmail: string
	startTimeIso: string
	googleMeetUrl?: string | null
	dashboardBookingUrl: string
}

/**
 * Practitioner Booking Notification (Spanish)
 * ------------------------------------------------------------
 * Notifies the practitioner when a patient books via the public link.
 *
 * Sections:
 *  - Tipo de servicio
 *  - Paciente (nombre + email)
 *  - Fecha (e.g. "30 de Junio de 2025 a las 11:30h")
 *  - Lugar (Google Meet link or "Online")
 *  - CTA: Ver cita en Coco (deep-link to dashboard panel)
 */
export default function PractitionerBookingNotificationEmail({
	practitionerName = 'Tu profesional',
	consultationType,
	patientFullName,
	patientEmail,
	startTimeIso,
	googleMeetUrl,
	dashboardBookingUrl
}: PractitionerBookingNotificationEmailProps) {
	const typeLabel = consultationType === 'first' ? 'Primera consulta' : 'Consulta de seguimiento'

	// Example: "30 de Junio de 2025 a las 11:30h" (Madrid time)
	const displayDate = (() => {
		try {
			return (
				formatInTimeZone(new Date(startTimeIso), 'Europe/Madrid', "d 'de' MMMM 'de' yyyy 'a las' HH:mm", {
					locale: es
				}) + 'h'
			)
		} catch (_) {
			return startTimeIso
		}
	})()

	// Build preview line: "30 de Sep. a las 11h – Primera consulta"
	const previewDate = (() => {
		try {
			return formatInTimeZone(new Date(startTimeIso), 'Europe/Madrid', "d 'de' LLL 'a las' HH'h'", { locale: es })
		} catch (_) {
			return startTimeIso
		}
	})()

	return (
		<Html lang="es">
			<Head>
				<meta httpEquiv="Content-Language" content="es" />
			</Head>
			<Preview>{`${previewDate} – ${typeLabel}`}</Preview>
			<Body style={main}>
				<Container style={container}>
					<Section style={sectionHeader}>
						<Heading as="h2" style={title}>
							Nueva reserva
						</Heading>

						<Text style={subtitle}>
							Hola {practitionerName}, acaban de reservar una cita contigo, estos son los detalles:
						</Text>
					</Section>

					<Section style={sectionBox}>
						<RowItem label="Tipo de servicio" value={typeLabel} />
						<RowItem label="Paciente" value={`${patientFullName} · ${patientEmail}`} />
						<RowItem label="Fecha" value={displayDate} />
						<RowItem
							label="Lugar"
							value={
								googleMeetUrl ? (
									<a href={googleMeetUrl} style={link}>
										Google Meet (unirse)
									</a>
								) : (
									'Online'
								)
							}
						/>
					</Section>

					<Section style={sectionCta}>
						<a href={dashboardBookingUrl} style={ctaButton}>
							<Text style={ctaText}>Ver cita en Coco</Text>
						</a>
						<Text style={footerNote}>Esta cita ha sido creada por el paciente.</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	)
}

function RowItem({ label, value }: { label: string; value: string | JSX.Element }) {
	return (
		<div style={row}>
			<div style={rowLabel}>{label}</div>
			<div style={rowValue}>{value}</div>
		</div>
	)
}

// Styles
const main = {
	backgroundColor: '#ffffff',
	fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif'
}

const container = {
	backgroundColor: '#ffffff',
	margin: '0 auto',
	padding: '0',
	maxWidth: '600px',
	border: 'none',
	borderRadius: '0',
	overflow: 'hidden'
} as const

const sectionHeader = { padding: '32px 40px 8px' } as const
const sectionBox = { padding: '16px 40px 8px' } as const
const sectionCta = { padding: '24px 40px 40px' } as const

const title = {
	color: '#111827',
	fontSize: '20px',
	lineHeight: '28px',
	margin: '0 0 8px',
	fontWeight: 700
}

const subtitle = {
	color: '#4b5563',
	fontSize: '14px',
	lineHeight: '20px',
	margin: 0
}

const row = {
	display: 'flex',
	gap: '12px',
	alignItems: 'baseline',
	margin: '12px 0'
}

const rowLabel = {
	width: '160px',
	color: '#6b7280',
	fontSize: '13px',
	lineHeight: '20px'
}

const rowValue = {
	color: '#111827',
	fontSize: '14px',
	lineHeight: '20px'
}

const link = {
	color: '#0ea5a5',
	textDecoration: 'none'
}

const ctaButton = {
	display: 'inline-block',
	backgroundColor: '#179898',
	borderRadius: '6px',
	padding: '14px 28px',
	textAlign: 'center' as const,
	textDecoration: 'none',
	cursor: 'pointer',
	boxSizing: 'border-box' as const,
	border: 'none'
}

const ctaText = {
	color: '#ffffff',
	fontSize: '12px',
	fontWeight: 500 as const,
	margin: 0,
	textDecoration: 'none',
	lineHeight: '20px'
}

const footerNote = {
	color: '#6b7280',
	fontSize: '12px',
	lineHeight: '18px',
	margin: '12px 0 0'
}
