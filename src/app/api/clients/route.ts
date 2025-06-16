import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        console.log('API: Starting POST request') // Debug log

        // Create authenticated Supabase client with cookies
        const cookieStore = cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

        console.log('API: Created supabase client') // Debug log

        // Get the current user session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        console.log('API: Session:', session ? 'exists' : 'null') // Debug log
        console.log('API: Session error:', sessionError) // Debug log

        if (sessionError || !session) {
            console.log('API: Unauthorized - no session') // Debug log
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log('API: User ID:', session.user.id) // Debug log

        const body = await request.json()
        const {
            name,
            email,
            description,
            billingAmount,
            billingType,
            billingFrequency,
            billingTrigger,
            billingAdvanceDays,
            shouldBill
        } = body

        console.log('API: Request body received:', { name, email }) // Debug log

        // Validate required fields
        if (!name || !email) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
        }

        // Insert the new client
        const { data: client, error } = await supabase
            .from('clients')
            .insert({
                user_id: session.user.id,
                name,
                email,
                description,
                billing_amount: billingAmount,
                billing_type: billingType,
                billing_frequency: billingFrequency,
                billing_trigger: billingTrigger,
                billing_advance_days: billingAdvanceDays,
                should_bill: shouldBill
            })
            .select()
            .single()

        if (error) {
            console.error('API: Database error:', error)
            return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
        }

        console.log('API: Client created successfully:', client.id) // Debug log
        return NextResponse.json(client)
    } catch (error) {
        console.error('API: Error creating client:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {

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
		console.log('API: User:', user) // Debug log
		if (userError || !user) {
			console.error('API: Unauthorized - no user') // Debug log
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}


		/**
        // Fetch all clients for the current user
        const { data: clients, error } = await supabase
            .from('clients')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('API: Database error:', error)
            return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
        }
			*/

        // return NextResponse.json(clients)
    } catch (error) {
        console.error('API: Error fetching clients:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

}
