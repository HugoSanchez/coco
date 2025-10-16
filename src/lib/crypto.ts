import crypto from 'crypto'

export type ManageAction = 'reschedule' | 'cancel'

const sec = (): string => {
	const s = process.env.CRON_SECRET
	if (!s) throw new Error('CRON_SECRET is not set')
	return s
}

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
const fromB64url = (s: string) => {
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
	const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
	return Buffer.from(b64 + pad, 'base64')
}

/**
 * Computes a compact, URL-safe HMAC signature for a booking manage link.
 * base64url(HMAC_SHA256(CRON_SECRET, `${id}:${email}:${action}`))
 */
export function signManageSig(id: string, email: string, action: ManageAction): string {
	const mac = crypto.createHmac('sha256', sec()).update(`${id}:${email}:${action}`, 'utf8').digest()
	return b64url(mac)
}

/**
 * Verifies the signature for a manage link using constant-time comparison.
 */
export function verifyManageSig(sig: string, id: string, email: string, action: ManageAction): boolean {
	try {
		const exp = signManageSig(id, email, action)
		const aB = fromB64url(sig)
		const bB = fromB64url(exp)
		if (aB.length !== bB.length) return false
		const a = new Uint8Array(aB.buffer, aB.byteOffset, aB.byteLength)
		const b = new Uint8Array(bB.buffer, bB.byteOffset, bB.byteLength)
		return crypto.timingSafeEqual(a, b)
	} catch {
		return false
	}
}

/**
 * Convenience to build a full reschedule/cancel URL with signature.
 */
export function buildManageUrl(
	baseUrl: string,
	kind: 'reschedule' | 'cancel',
	bookingId: string,
	email: string
): string {
	const action: ManageAction = kind
	const sig = signManageSig(bookingId, email, action)
	const path = action === 'reschedule' ? 'reschedulings' : 'cancellations'
	return `${baseUrl}/${path}/${bookingId}?sig=${sig}`
}
