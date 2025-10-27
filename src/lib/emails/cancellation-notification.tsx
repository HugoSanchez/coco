import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'

interface CancellationNotificationEmailProps {
	clientName: string
	consultationDate?: string
	practitionerName?: string
}

export default function CancellationNotificationEmail({
	clientName,
	consultationDate,
	practitionerName = 'Tu profesional'
}: CancellationNotificationEmailProps) {
	return (
		<Html lang="es">
			<Head>
				<meta httpEquiv="Content-Language" content="es" />
			</Head>
			<Preview>{`${practitionerName} ha cancelado tu cita`}</Preview>
			<Body style={main}>
				<Container style={container}>
					<Section style={{ ...section, marginBottom: '16px' }}>
						<Text style={greeting}>{`Hola ${clientName.trim()},`}</Text>

						<Text style={text}>
							Este email es para notificarte de que {practitionerName} ha cancelado tu cita prevista para{' '}
							{formatDateWithTimeToSpanish(consultationDate as string)}.
						</Text>
						<Text style={text}>
							Si necesitas reprogramar, puedes ponerte en contacto con
							{` ${practitionerName}.`}
						</Text>
					</Section>

					<Section style={section}>
						<Text style={signatureLine}>Atentamente,</Text>
						<Text style={signatureLine}>{practitionerName} y el equipo de Coco.</Text>
					</Section>

					<Section style={footer}>
						<Text style={footerText}>
							Si tienes cualquier duda, por favor, ponte en contacto con tu profesional.
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	)
}

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
}

const section = {
	padding: '0 40px',
	marginBottom: '40px'
}

const greeting = {
	color: '#333333',
	fontSize: '16px',
	lineHeight: '24px',
	margin: '0 0 24px',
	fontWeight: '400'
}

const text = {
	color: '#333333',
	fontSize: '16px',
	lineHeight: '24px',
	margin: '0 0 24px',
	fontWeight: '400'
}

const signatureLine = {
	color: '#333333',
	fontSize: '16px',
	lineHeight: '24px',
	margin: '0 0 8px',
	fontWeight: '400'
}

const footer = {
	padding: '40px',
	textAlign: 'left' as const,
	borderTop: '1px solid #e9ecef',
	backgroundColor: '#ffffff'
}

const footerText = {
	color: '#666666',
	fontSize: '14px',
	margin: '0 0 8px',
	lineHeight: '20px'
}

function formatDateWithTimeToSpanish(dateString: string): string {
	try {
		return (
			formatInTimeZone(new Date(dateString), 'Europe/Madrid', "d 'de' MMMM 'de' yyyy 'a las' HH:mm", {
				locale: es
			}) + 'h'
		)
	} catch (error) {
		return dateString
	}
}
