import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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
		scope: [
		'https://www.googleapis.com/auth/calendar.readonly',
		'https://www.googleapis.com/auth/userinfo.email',
		'https://www.googleapis.com/auth/userinfo.profile'
		],
		prompt: 'consent',
		access_type: 'offline',
		response_type: 'code'
	})
	return NextResponse.redirect(authUrl)
}


export async function DELETE(request: Request) {
  try {
    // Initialize Supabase client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get user from request
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete calendar tokens for the user
    const { error: deleteError } = await supabase
      .from('calendar_tokens')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to disconnect calendar' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting calendar:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
