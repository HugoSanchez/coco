import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
	try {
		const supabase = createClient()

		// Get current user
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser()
		if (authError || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Update the stripe_accounts table to mark onboarding as completed
		const { error: updateError } = await supabase
			.from('stripe_accounts')
			.update({
				onboarding_completed: true,
				updated_at: new Date().toISOString()
			})
			.eq('user_id', user.id)

		if (updateError) {
			console.error('Error updating onboarding status:', updateError)
			return NextResponse.json(
				{
					error: 'Failed to update onboarding status',
					details: updateError.message
				},
				{ status: 500 }
			)
		}

		return NextResponse.json({
			success: true,
			message: 'Onboarding status updated successfully'
		})
	} catch (error) {
		console.error('Error updating onboarding status:', error)
		return NextResponse.json(
			{
				error: 'Internal server error',
				details:
					error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
