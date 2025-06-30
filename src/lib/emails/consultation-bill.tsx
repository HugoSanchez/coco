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
	const isBefore = billingTrigger === 'before_consultation'
	const billingContext = isBefore
		? 'Tu consulta está programada y requiere pago anticipado'
		: 'Tu consulta ha sido completada'

	return (
		<Html>
			<Head />
			<Preview>
				{isBefore
					? 'Factura de Consulta - Pago Requerido'
					: 'Factura de Consulta Completada'}
			</Preview>
			<Body style={main}>
				<Container style={container}>
					{/* Header */}
					<Section style={header}>
						<div style={headerContainer}>
							<Heading style={h1}>Factura de Consulta</Heading>
						</div>
					</Section>

					{/* Greeting */}
					<Section style={{ ...section, paddingTop: '32px' }}>
						<Text style={text}>Hola {clientName},</Text>
						<Text style={text}>
							Aquí tienes la factura y detalles de pago de tu{' '}
							{isBefore ? '' : 'próxima'}
							consulta con {' ' + practitionerName}
						</Text>
					</Section>

					{/* Bill Details */}
					<Section style={section}>
						<div style={billSection}>
							<Row>
								<Column style={labelColumn}>
									<Text style={label}>Profesional:</Text>
								</Column>
								<Column style={valueColumn}>
									<Text style={value}>
										{practitionerName}
									</Text>
								</Column>
							</Row>

							<Row>
								<Column style={labelColumn}>
									<Text style={label}>
										Fecha de la Consulta:
									</Text>
								</Column>
								<Column style={valueColumn}>
									<Text style={value}>
										{formatDateToSpanish(consultationDate)}
									</Text>
								</Column>
							</Row>

							<Row>
								<Column style={labelColumn}>
									<Text style={label}>Honorarios:</Text>
								</Column>
								<Column style={valueColumn}>
									<Text style={value}>{amount}€</Text>
								</Column>
							</Row>
						</div>
					</Section>

					{/* Payment Button */}
					<Section style={section}>
						<div style={buttonContainer}>
							{paymentUrl ? (
								<a href={paymentUrl} style={payButton}>
									<Text style={buttonText}>
										Pagar Consulta
									</Text>
								</a>
							) : (
								<div style={payButton}>
									<Text style={buttonText}>
										Pagar Consulta
									</Text>
								</div>
							)}
						</div>
					</Section>

					{/* Instructions */}
					<Section style={section}>
						<Text style={text}>
							Si tienes alguna pregunta sobre esta factura, no
							dudes en contactar con tu profesional:{' '}
							{practitionerEmail}.
						</Text>
					</Section>

					{/* Footer */}
					<Section style={footer}>
						<div style={footerPractitionerInfo}>
							<Text style={footerText}>
								Gracias por confiar en nosotros.
							</Text>
						</div>
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
	border: '1px solid #e5e7eb',
	borderRadius: '12px',
	overflow: 'hidden'
}

const header = {
	padding: '40px 32px',
	background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)',
	textAlign: 'center' as const
}

const headerContainer = {
	display: 'flex',
	flexDirection: 'column' as const,
	justifyContent: 'center',
	alignItems: 'center',
	width: '100%'
}

const h1 = {
	color: '#ffffff',
	fontSize: '28px',
	fontWeight: 'bold',
	margin: '0 0 16px',
	textAlign: 'center' as const,
	width: '100%'
}

const subtitle = {
	color: '#ffffff',
	fontSize: '16px',
	fontWeight: '400',
	margin: '0',
	textAlign: 'left' as const,
	lineHeight: '24px'
}

const practitionerImage = {
	width: '24px',
	height: '24px',
	borderRadius: '50%',
	objectFit: 'cover' as const
}

const practitionerContainer = {
	textAlign: 'center' as const,
	width: '100%'
}

const practitionerTable = {
	margin: '0 auto',
	borderCollapse: 'collapse' as const,
	borderSpacing: '0'
}

const practitionerImageCell = {
	paddingRight: '12px',
	verticalAlign: 'middle' as const,
	lineHeight: '24px',
	height: '24px'
}

const practitionerNameCell = {
	verticalAlign: 'middle' as const,
	lineHeight: '24px',
	height: '24px'
}

const section = {
	padding: '0 32px',
	marginBottom: '32px'
}

const text = {
	color: '#374151',
	fontSize: '16px',
	lineHeight: '26px',
	margin: '0 0 20px'
}

const billSection = {
	padding: '',
	backgroundColor: '#ffffff',
	border: '',
	borderRadius: '12px',
	margin: '0 0 32px 0',
	boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
}

const labelColumn = {
	width: '40%',
	verticalAlign: 'top' as const,
	paddingRight: '12px'
}

const valueColumn = {
	width: '60%',
	verticalAlign: 'top' as const
}

const label = {
	color: '#6b7280',
	fontSize: '14px',
	fontWeight: '600',
	margin: '0 0 12px',
	textTransform: 'uppercase' as const,
	letterSpacing: '0.5px'
}

const value = {
	color: '#111827',
	fontSize: '16px',
	fontWeight: '500',
	margin: '0 0 12px'
}

const totalValue = {
	color: '#111827',
	fontSize: '16px',
	fontWeight: '300',
	margin: '0 0 12px'
}

const footer = {
	padding: '32px',
	textAlign: 'center' as const,
	borderTop: '1px solid #f3f4f6',
	backgroundColor: '#f9fafb'
}

const footerPractitionerInfo = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	gap: '16px',
	textAlign: 'left' as const
}

const footerText = {
	color: '#6b7280',
	fontSize: '14px',
	margin: '0 0 8px'
}

const buttonContainer = {
	textAlign: 'center' as const,
	margin: '0 0 24px'
}

const payButton = {
	display: 'block',
	width: '100%',
	background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)',
	borderRadius: '8px',
	padding: '16px 32px',
	textAlign: 'center' as const,
	textDecoration: 'none',
	cursor: 'pointer',
	boxSizing: 'border-box' as const
}

const buttonText = {
	color: '#ffffff',
	fontSize: '16px',
	fontWeight: '600',
	margin: '0',
	textDecoration: 'none'
}
