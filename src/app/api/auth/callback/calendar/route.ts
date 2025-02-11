import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID_CALENDAR,
  process.env.GOOGLE_CLIENT_SECRET_CALENDAR,
  'http://localhost:3000/api/auth/callback/calendar'
)


// GET /api/auth/callback/calendar
// This is the callback route for the Google Calendar API
// It is called by Google when the user is redirected back to the app
// after they have authorized the app to access their calendar.
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')

    if (code) {
      try {
        // Get the access token from Google
        const { tokens } = await oauth2Client.getToken(code)
        oauth2Client.setCredentials(tokens)

        // Get user info from Google
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
        const { data: googleUserInfo } = await oauth2.userinfo.get()

        if (!googleUserInfo.email) {
          throw new Error('Failed to get user email from Google')
        }

        // Initialize Supabase client
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

        // Get Supabase user by email
        const { data: profileUser, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', googleUserInfo.email)
            .single()

        if (profileError || !profileUser) {
            console.error('Error finding user profile:', profileError)
            throw new Error('Failed to find user profile')
        }

        // Upsert the calendar tokens
        const { error: tokenError } = await supabase
          .from('calendar_tokens')
          .upsert({
            user_id: profileUser.id,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date
          }, {
            onConflict: 'user_id',
          })

        if (tokenError) throw tokenError

        return NextResponse.redirect(new URL('/onboarding?step=2&calendar_connected=true', request.url))
      } catch (error) {
        console.error('Error in Google Calendar callback:', error)
        return NextResponse.redirect(new URL('/onboarding?step=1&calendar_connected=false', request.url))
      }
    } else {
      return new NextResponse('No code provided', { status: 400 })
    }
  }
