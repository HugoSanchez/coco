import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'

interface PaymentReceiptEmailProps {
	clientName: string
	amount: number
	currency?: string
	practitionerName?: string
	consultationDate?: string
	receiptUrl: string
	// Monthly invoice variant
	isMonthly?: boolean
	monthLabel?: string
}

export default function PaymentReceiptEmail({
	clientName,
	amount,
	currency = 'EUR',
	practitionerName = 'Tu profesional',
	consultationDate,
	receiptUrl,
	isMonthly = false,
	monthLabel
}: PaymentReceiptEmailProps) {
	const firstName = (clientName || '').trim().split(' ')[0] || clientName
	return (
		<Html lang="es">
			<Head>
				<meta httpEquiv="Content-Language" content="es" />
			</Head>
			<Preview>{'Aquí tienes tu recibo'}</Preview>
			<Body style={main}>
				<Container style={container}>
					{/* Logo */}
					<Section style={logoSection}></Section>

					{/* Body + Button in same section for consistent spacing */}
					<Section style={sectionTight}>
						<Text style={greeting}>{`Hola ${firstName},`}</Text>

						{isMonthly ? (
							<Text style={text}>
								Este email es para confirmarte que hemos procesado correctamente tu pago mensual
								{monthLabel ? ` correspondiente a ${monthLabel}` : ''}.
							</Text>
						) : (
							<Text style={text}>
								Este email es para confirmarte que hemos procesado correctamente el pago de tu consulta
								con {practitionerName}.
							</Text>
						)}

						<Text style={text}>
							<strong>{`Encontrarás tu recibo en el
							enlace a continuación.`}</strong>
						</Text>

						<div style={buttonContainer}>
							<a href={receiptUrl} style={payButton}>
								<Text style={buttonText}>Ver recibo</Text>
							</a>
						</div>
					</Section>

					{/* Greetings Section */}
					<Section style={section}>
						<Text style={signatureLine}>Gracias por tu confianza,</Text>
						<Text style={signatureLine}>{practitionerName} y el equipo de Coco.</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	)
}

// Email Styles
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

const sectionTight = {
	padding: '0 40px',
	marginBottom: '24px'
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

const buttonContainer = { textAlign: 'left' as const, margin: '32px 0 16px' }

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
