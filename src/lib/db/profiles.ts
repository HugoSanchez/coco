import { supabase } from '../supabase'

export interface UserProfileWithSchedule {
    id: string;
    name: string;
    description: string;
    profile_picture_url?: string;
    schedules?: {
        id: string;
        user_id: string;
        meeting_duration: number;
        timezone: string;
        weekly_schedule: any; // You might want to type this more specifically
        created_at: string;
        updated_at: string;
    };
}

export async function getUserProfileAndScheduleByUsername(username: string) {
    // First, get the basic profile data
    const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

	if (profileError) throw profileError

	// Second query: Get schedule
	const { data: schedule, error: scheduleError } = await supabase
		.from('schedules')
		.select('*')
		.eq('user_id', profile.id)
		.single()

	if (scheduleError) throw scheduleError

	// Combine the data
	return {
		...profile,
		schedule
	} as UserProfileWithSchedule
}

// Add other profile-related queries here...
