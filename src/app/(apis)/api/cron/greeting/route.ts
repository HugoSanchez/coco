import { NextResponse } from 'next/server'

// Force dynamic because this uses environment variables and server-side IO
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
	////////////////////////////////////////////////////////////////
	///// Step 0: Authenticate request
	///////////////////////////////////////////////////////////////
	const auth = process.env.CRON_SECRET
	const header = request.headers.get('authorization')
	if (
		!auth ||
		!header?.startsWith('Bearer ') ||
		header.split(' ')[1] !== auth
	) {
		return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
	}

	///////////////////////////////////////////////////////////////
	///// Step 1: Send greeting
	///////////////////////////////////////////////////////////////
	console.log('Greeting cron job triggered!')

	///////////////////////////////////////////////////////////////
	///// Step 2: Return success
	///////////////////////////////////////////////////////////////
	return NextResponse.json({ success: true })
}
