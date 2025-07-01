import { google } from 'googleapis'

const clientId = process.env.GOOGLE_CLIENT_ID_CALENDAR
const clientSecret = process.env.GOOGLE_CLIENT_SECRET_CALENDAR
const redirectUri = process.env.GOOGLE_REDIRECT_URI

if (!clientId || !clientSecret || !redirectUri) {
	console.error('Missing Google Calendar environment variables', redirectUri)
	throw new Error('Missing Google Calendar environment variables')
}

export const oauth2Client = new google.auth.OAuth2(
	clientId,
	clientSecret,
	redirectUri
)
