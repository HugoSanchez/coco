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

export interface Profile {
    id: string;
    name: string | null;
    username: string | null;
    email: string;
    description: string | null;
    profile_picture_url: string | null;
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

export async function validateUsername(username: string, currentUsername?: string | null) {
    if (username === currentUsername) return true

    const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single()

    if (error?.code === 'PGRST116') {
        // No matching username found - username is available
        return true
    }

    return false
}

export async function updateProfile(userId: string, profileData: Partial<Profile>) {
    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            ...profileData
        })

    if (error) throw error
}

export async function uploadProfilePicture(userId: string, file: File) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

    return publicUrl;
}

// Add other profile-related queries here...
