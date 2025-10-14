import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'

interface MonthlyBillEmailProps {
	clientName: string
	monthLabel: string // e.g., "Septiembre 2025"
	amount: number
	currency?: string
	practitionerName?: string
	paymentUrl?: string
}

export default function MonthlyBillEmail({
	clientName,
	monthLabel,
	amount,
	currency = 'EUR',
	practitionerName = 'Tu profesional',
	paymentUrl
}: MonthlyBillEmailProps) {
	const firstName = (clientName || '').trim().split(' ')[0] || clientName
	return (
		<Html lang="es">
			<Head>
				<meta http-equiv="Content-Language" content="es" />
			</Head>
			<Preview>{`${practitionerName}`}</Preview>
			<Body style={main}>
				<Container style={container}>
					<Section style={section}>
						<Heading as="h2" style={title}>{`Factura del mes de ${monthLabel}`}</Heading>
						<Text style={greeting}>{`Hola ${firstName},`}</Text>
						<Text style={text}>
							Aquí tienes la facutra correspondiente al mes de {monthLabel}. Puedes completar el pago de
							forma segura utilizando el enlace a continuación.
						</Text>
						<div style={buttonContainer}>
							{paymentUrl ? (
								<a href={paymentUrl} style={payButton}>
									<Text style={buttonText}>Pagar factura</Text>
								</a>
							) : (
								<div style={payButton}>
									<Text style={buttonText}>Pagar factura</Text>
								</div>
							)}
						</div>
						<Text style={signatureLine}>Atentamente,</Text>
						<Text style={signatureLine}>{practitionerName} y el equipo de Coco.</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	)
}

// Styles (copied to keep template self-contained)
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
	padding: '40px'
}

const title = {
	color: '#111827',
	fontSize: '20px',
	lineHeight: '28px',
	margin: '0 0 16px',
	fontWeight: '700'
}

const greeting = {
	color: '#333333',
	fontSize: '16px',
	lineHeight: '24px',
	margin: '0 0 16px',
	fontWeight: '400'
}

const text = {
	color: '#333333',
	fontSize: '16px',
	lineHeight: '24px',
	margin: '0 0 16px',
	fontWeight: '400'
}

const signatureLine = {
	color: '#333333',
	fontSize: '16px',
	lineHeight: '24px',
	margin: '0 0 8px',
	fontWeight: '400'
}

const buttonContainer = { textAlign: 'left' as const, margin: '24px 0 24px' }

const payButton = {
	display: 'inline-block',
	backgroundColor: '#179898',
	borderRadius: '6px',
	padding: '14px 32px',
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
