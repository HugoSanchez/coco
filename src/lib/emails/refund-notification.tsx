import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Section,
	Text
} from '@react-email/components'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'

function formatCurrency(amount: number, currency: string = 'EUR'): string {
	// es-ES uses a non-breaking space between number and symbol; strip it.
	const formatted = new Intl.NumberFormat('es-ES', {
		style: 'currency',
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount)
	return formatted.replace(/\u00A0/g, '')
}

interface RefundNotificationEmailProps {
	clientName: string
	amount: number
	currency?: string
	practitionerName?: string
	refundId?: string
	consultationDate?: string
}

export default function RefundNotificationEmail({
	clientName,
	amount,
	currency = 'EUR',
	practitionerName = 'Tu profesional',
	refundId,
	consultationDate
}: RefundNotificationEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>{'Confirmación de reembolso'}</Preview>
			<Body style={main}>
				<Container style={container}>
					<Section style={{ ...section, marginBottom: '16px' }}>
						<Text
							style={greeting}
						>{`Hola ${clientName.trim()},`}</Text>

						<Text style={text}>
							Este email es para notificarte que{' '}
							{practitionerName} ha procesado el reembolso del
							pago de tu consulta del{' '}
							{formatDateWithTimeToSpanish(
								consultationDate as string
							)}
							. El importe devuelto es{' '}
							<strong>{formatCurrency(amount, currency)}</strong>.
						</Text>
						<Text style={text}>
							Dependiendo de tu banco o método de pago, el
							reembolso puede tardar varios días laborables en
							reflejarse.
						</Text>
					</Section>

					<Section style={section}>
						<Text style={signatureLine}>Atentamente,</Text>
						<Text style={signatureLine}>
							{practitionerName} y el equipo de Coco.
						</Text>
					</Section>

					<Section style={footer}>
						<Text style={footerText}>
							Si no reconoces este reembolso, por favor ponte en
							contacto con tu profesional.
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	)
}

const main = {
	backgroundColor: '#ffffff',
	fontFamily:
		'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif'
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
			formatInTimeZone(
				new Date(dateString),
				'Europe/Madrid',
				"d 'de' MMMM 'de' yyyy 'a las' HH:mm",
				{ locale: es }
			) + 'h'
		)
	} catch (error) {
		return dateString
	}
}
