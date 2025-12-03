import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'

interface InvoiceAdjustmentEmailProps {
	clientName: string
	practitionerName?: string
	monthLabel?: string
	amount?: number
	currency?: string
	paymentUrl?: string
	notes?: string
}

export default function InvoiceAdjustmentNotificationEmail({
	clientName,
	practitionerName = 'Tu profesional',
	monthLabel,
	amount,
	currency = 'EUR',
	paymentUrl,
	notes
}: InvoiceAdjustmentEmailProps) {
	const firstName = (clientName || '').trim().split(' ')[0] || clientName
	const formattedAmount = typeof amount === 'number' ? `${amount.toFixed(2)} ${currency.toUpperCase()}` : undefined
	const label = monthLabel ? `de ${monthLabel}` : ''
	const practitionerFullName = practitionerName?.trim() || 'Tu profesional'

	return (
		<Html lang="es">
			<Head>
				<meta httpEquiv="Content-Language" content="es" />
			</Head>
			<Preview>{`Actualización de tu factura ${label}`}</Preview>
			<Body style={main}>
				<Container style={container}>
					<Section style={section}>
						<Heading as="h2" style={title}>{`Actualizamos tu factura ${label}`}</Heading>
						<Text style={greeting}>{`Hola ${firstName},`}</Text>
						<Text style={text}>
							{`Hemos actualizado tu factura ${label} porque se cancelaron algunas sesiones.`}{' '}
							{formattedAmount
								? `El importe pendiente ahora es de ${formattedAmount}.`
								: 'El importe pendiente ya refleja solo las sesiones realizadas.'}
						</Text>
						<Text style={text}>
							Puedes revisar y pagar con el mismo enlace de siempre. Si tienes dudas, respóndeme a este
							correo.
						</Text>
						{paymentUrl && (
							<div style={buttonContainer}>
								<a href={paymentUrl} style={payButton}>
									<Text style={buttonText}>Ver factura actualizada</Text>
								</a>
							</div>
						)}
						{notes && <Text style={noteText}>{notes}</Text>}
						<Text style={signatureLine}>Gracias,</Text>
						<Text style={signatureLine}>{practitionerFullName}</Text>
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

const noteText = {
	color: '#6b7280',
	fontSize: '14px',
	lineHeight: '20px',
	margin: '0 0 16px'
}
