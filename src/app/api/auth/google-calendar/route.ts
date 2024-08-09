import { NextResponse } from 'next/server'
import { google } from 'googleapis'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID_CALENDAR,
  process.env.GOOGLE_CLIENT_SECRET_CALENDAR,
  'http://localhost:3000/api/auth/callback/calendar'
)

// GET /api/auth/google-calendar
// It generates the URL for the Google Calendar API authorization flow  
export async function GET() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    prompt: 'consent'
  })
  return NextResponse.redirect(authUrl)
}