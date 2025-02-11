import { supabaseAdmin } from '../supabaseAdmin'

export async function updateUserCalendarTokens(tokenResponse: any, userId: string, expiryDuration: number) {
	const { error: updateError } = await supabaseAdmin
			.from('calendar_tokens')
			.update({
				access_token: tokenResponse.token,
				expiry_date: expiryDuration // Default expiry is 1 hour
			})
			.eq('user_id', userId);

		// If unsuccessful, throw an error
		if (updateError) {
			console.error('Error updating token in database:', updateError);
			throw new Error('Failed to update token in database');
		}

	return true;
}


