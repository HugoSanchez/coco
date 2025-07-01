import { NextResponse } from 'next/server'
import { getAvailableSlots } from '@/lib/calendar'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    const monthStr = searchParams.get('month')

    if (!username || !monthStr) {
      return NextResponse.json({ error: 'Missing username or month' }, { status: 400 })
    }

    const month = new Date(monthStr)

    try {
      const availableSlots = await getAvailableSlots(username, month)
      return NextResponse.json(availableSlots)
    } catch (error) {
      console.error('Error fetching available slots:', error)
      return NextResponse.json({ error: 'Failed to fetch available slots' }, { status: 500 })
    }
}