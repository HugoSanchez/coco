import { NextResponse } from 'next/server'
import seedBookings from '@/lib/seedBookings'

export async function GET(request: Request) {
	const url = new URL(request.url)
	const count = Number(url.searchParams.get('count') ?? '5')
	const clientId = url.searchParams.get('clientId')

	if (!clientId) {
		return NextResponse.json(
			{ success: false, error: 'clientId query param is required' },
			{ status: 400 }
		)
	}

	try {
		const result = await seedBookings({ count, clientId })
		return NextResponse.json(result)
	} catch (err: any) {
		console.error(err)
		return NextResponse.json(
			{ success: false, error: err.message },
			{ status: 500 }
		)
	}
}
