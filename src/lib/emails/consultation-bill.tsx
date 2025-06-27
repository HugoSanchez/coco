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

interface ConsultationBillEmailProps {
	clientName: string
	consultationDate: string
	amount: number
	billingTrigger: 'before_consultation' | 'after_consultation'
	practitionerName?: string
	dueDate?: string
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
	practitionerName = 'Tu Profesional',
	dueDate
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
						<Heading style={h1}>Factura de Consulta</Heading>
						<Text style={subtitle}>{practitionerName}</Text>
					</Section>

					{/* Greeting */}
					<Section style={{ ...section, paddingTop: '32px' }}>
						<Text style={text}>Hola {clientName},</Text>
						<Text style={text}>
							{billingContext}. A continuación encontrarás los
							detalles de tu factura:
						</Text>
					</Section>

					{/* Bill Details */}
					<Section style={section}>
						<div style={billSection}>
							<Row>
								<Column style={labelColumn}>
									<Text style={label}>Cliente:</Text>
								</Column>
								<Column style={valueColumn}>
									<Text style={value}>{clientName}</Text>
								</Column>
							</Row>

							<Row>
								<Column style={labelColumn}>
									<Text style={label}>
										Fecha de Consulta:
									</Text>
								</Column>
								<Column style={valueColumn}>
									<Text style={value}>
										{consultationDate}
									</Text>
								</Column>
							</Row>

							<Row>
								<Column style={labelColumn}>
									<Text style={label}>
										Tipo de Facturación:
									</Text>
								</Column>
								<Column style={valueColumn}>
									<Text style={value}>
										{isBefore
											? 'Pago Anticipado'
											: 'Pago Post-Consulta'}
									</Text>
								</Column>
							</Row>

							{dueDate && (
								<Row>
									<Column style={labelColumn}>
										<Text style={label}>
											Fecha de Vencimiento:
										</Text>
									</Column>
									<Column style={valueColumn}>
										<Text style={value}>{dueDate}</Text>
									</Column>
								</Row>
							)}

							<Hr style={hr} />

							<Row>
								<Column style={labelColumn}>
									<Text style={totalLabel}>
										Total a Pagar:
									</Text>
								</Column>
								<Column style={valueColumn}>
									<Text style={totalValue}>${amount}</Text>
								</Column>
							</Row>
						</div>
					</Section>

					{/* Instructions */}
					<Section style={section}>
						<Text style={text}>
							{isBefore
								? 'Por favor realiza el pago antes de tu cita para confirmar tu consulta.'
								: 'Gracias por tu consulta. Por favor procede con el pago de los servicios recibidos.'}
						</Text>
						<Text style={text}>
							Si tienes alguna pregunta sobre esta factura, no
							dudes en contactarnos.
						</Text>
					</Section>

					{/* Footer */}
					<Section style={footer}>
						<Text style={footerText}>
							Gracias por confiar en nosotros.
						</Text>
						<Text style={footerText}>{practitionerName}</Text>
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

const h1 = {
	color: '#ffffff',
	fontSize: '28px',
	fontWeight: 'bold',
	margin: '0 0 8px'
}

const subtitle = {
	color: '#d1d5db',
	fontSize: '16px',
	margin: '0'
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
	padding: '32px',
	backgroundColor: '#ffffff',
	border: '2px solid #f3f4f6',
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

const hr = {
	borderColor: '#e5e7eb',
	margin: '16px 0'
}

const totalLabel = {
	color: '#111827',
	fontSize: '16px',
	fontWeight: 'bold',
	margin: '0'
}

const totalValue = {
	color: '#059669',
	fontSize: '28px',
	fontWeight: 'bold',
	margin: '0'
}

const footer = {
	padding: '32px',
	textAlign: 'center' as const,
	borderTop: '1px solid #f3f4f6',
	backgroundColor: '#f9fafb'
}

const footerText = {
	color: '#6b7280',
	fontSize: '14px',
	margin: '0 0 8px'
}
