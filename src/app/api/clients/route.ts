import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
        // Get the current user session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

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
            console.error('Database error:', error)
            return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
        }

        return NextResponse.json(client)
    } catch (error) {
        console.error('Error creating client:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        // Get the current user session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch all clients for the current user
        const { data: clients, error } = await supabase
            .from('clients')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Database error:', error)
            return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
        }

        return NextResponse.json(clients)
    } catch (error) {
        console.error('Error fetching clients:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
