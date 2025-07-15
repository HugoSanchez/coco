import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Section,
	Text,
	Hr,
	Row,
	Column
} from '@react-email/components'

/**
 * Format a date string to Spanish format
 * Example: "2025-06-30" -> "30 de Junio de 2025"
 */
function formatDateToSpanish(dateString: string): string {
	const monthNames = [
		'Enero',
		'Febrero',
		'Marzo',
		'Abril',
		'Mayo',
		'Junio',
		'Julio',
		'Agosto',
		'Septiembre',
		'Octubre',
		'Noviembre',
		'Diciembre'
	]

	try {
		const date = new Date(dateString)
		const day = date.getDate()
		const month = monthNames[date.getMonth()]
		const year = date.getFullYear()

		return `${day} de ${month} de ${year}`
	} catch (error) {
		// Fallback to original string if parsing fails
		return dateString
	}
}

interface ConsultationBillEmailProps {
	clientName: string
	consultationDate: string
	amount: number
	billingTrigger: 'before_consultation' | 'after_consultation'
	practitionerName?: string
	practitionerEmail?: string
	practitionerImageUrl?: string
	dueDate?: string
	paymentUrl?: string
}

/**
 * Consultation Billing Email Template
 *
 * Professional email template for sending consultation bills to clients.
 * Uses React Email components for consistent cross-client rendering.
 */
export default function ConsultationBillEmail({
	clientName,
	consultationDate,
	amount,
	billingTrigger,
	practitionerName = 'Frencisco Tocadiscos',
	practitionerEmail = 'contacto@tuprofesional.com',
	practitionerImageUrl = 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face',
	dueDate,
	paymentUrl
}: ConsultationBillEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>{'Confirmar Consulta - Pago Requerido'}</Preview>
			<Body style={main}>
				<Container style={container}>
					{/* Logo */}
					<Section style={logoSection}></Section>

					{/* Greeting */}
					<Section style={section}>
						<Text style={greeting}>
							{`Hola ${clientName.trim()},`}
						</Text>
						<Text style={text}>
							Este email es para comunicarte que tu próxima
							consulta con {practitionerName} está pre-programada
							para el {formatDateToSpanish(consultationDate)}.
						</Text>

						<Text style={text}>
							<strong>{`Para confirmar tu cita, por favor sigue las instrucciones de pago que encontrarás a continuación.`}</strong>
						</Text>

						<Text style={text}>
							{`Una vez realizado el pago, recibirás un email con los detalles de la cita así como la factura correspondiente. Si tienes cualquier duda, puedes ponerte en contacto con ${practitionerName}.`}
						</Text>
					</Section>

					{/* Payment Button */}
					<Section style={section}>
						<div style={buttonContainer}>
							{paymentUrl ? (
								<a href={paymentUrl} style={payButton}>
									<Text style={buttonText}>
										Confirmar consulta
									</Text>
								</a>
							) : (
								<div style={payButton}>
									<Text style={buttonText}>
										Confirmar consulta
									</Text>
								</div>
							)}
						</div>
					</Section>

					{/* Greetings Section */}
					<Section style={section}>
						<Text style={signatureLine}>Atentamente,</Text>
						<Text style={signatureLine}>
							{practitionerName} y el equipo de Coco.
						</Text>
					</Section>

					{/* Footer */}
					<Section style={footer}>
						<Text style={footerText}>
							Coco es una plataforma de reservas para
							profesionales de la salud. Si no eres{' '}
							{clientName.trim()}, o no has concertado una cita
							con {practitionerName} por favor ignora este email.
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	)
}

// Email Styles
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

const logoSection = {
	padding: '48px 40px 32px',
	backgroundColor: '#ffffff',
	textAlign: 'left' as const
}

const logo = {
	color: '#000000',
	fontSize: '18px',
	fontWeight: '900',
	margin: '0',
	textAlign: 'left' as const,
	lineHeight: '22px'
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

const buttonContainer = {
	textAlign: 'left' as const,
	margin: '0 0 32px'
}

const payButton = {
	display: 'inline-block',
	backgroundColor: '#179898',
	borderRadius: '6px',
	padding: '16px 44px',
	textAlign: 'center' as const,
	textDecoration: 'none',
	cursor: 'pointer',
	boxSizing: 'border-box' as const,
	border: 'none'
}

const buttonText = {
	color: '#ffffff',
	fontSize: '16px',
	fontWeight: '500',
	margin: '0',
	textDecoration: 'none',
	lineHeight: '20px'
}
