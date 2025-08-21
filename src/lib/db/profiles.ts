/**
 * User Profile Database Operations
 *
 * This module handles all database operations related to user profiles, including:
 * - Profile creation and updates
 * - Username validation and uniqueness checking
 * - Profile picture uploads and management
 * - Retrieving user profiles with associated schedules
 *
 * PROFILE STRUCTURE:
 * - Basic profile data is stored in the 'profiles' table
 * - Profile pictures are stored in Supabase Storage ('profile-pictures' bucket)
 * - Schedules are linked to profiles via user_id foreign key
 *
 * SECURITY:
 * - All operations are protected by Row Level Security (RLS)
 * - Users can only access and modify their own profiles
 * - Public profile data can be accessed via username for booking pages
 */

import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
const supabase = createSupabaseClient()

/**
 * Extended user profile interface that includes associated schedule data
 * Used for public booking pages where both profile and schedule info are needed
 *
 * @interface UserProfileWithSchedule
 * @property id - UUID of the user
 * @property name - Display name of the user
 * @property description - User's bio/description
 * @property profile_picture_url - URL to the user's profile picture
 * @property schedules - Associated schedule configuration
 */
export interface UserProfileWithSchedule {
	id: string
	name: string
	description: string
	profile_picture_url?: string
	schedules?: {
		id: string
		user_id: string
		meeting_duration: number
		timezone: string
		weekly_schedule: any // Weekly availability configuration (JSON)
		created_at: string
		updated_at: string
	}
}

/**
 * Basic user profile interface matching the profiles table structure
 * Used for profile management and updates
 *
 * @interface Profile
 * @property id - UUID of the user (matches auth.users.id)
 * @property name - Display name (can be null for new users)
 * @property username - Unique username for public booking URLs
 * @property email - User's email address
 * @property description - User's bio/description
 * @property profile_picture_url - URL to profile picture in storage
 */
export interface Profile {
	id: string
	name: string | null
	username: string | null
	email: string
	description: string | null
	profile_picture_url: string | null
}

/**
 * Retrieves a user's complete profile and schedule data by username
 *
 * This function is primarily used for public booking pages where visitors
 * need to see the user's profile information and available time slots.
 *
 * The function performs two separate queries to avoid complex JOINs and
 * ensure we get exactly the data we need:
 * 1. Fetch profile data by username
 * 2. Fetch associated schedule data by user_id
 *
 * @param username - The unique username to search for
 * @returns Promise<UserProfileWithSchedule> - Combined profile and schedule data
 * @throws Error if profile not found, schedule not found, or database error
 */
export async function getUserProfileAndScheduleByUsername(username: string) {
	// First query: Get the basic profile data using the unique username
	const { data: profile, error: profileError } = await supabase
		.from('profiles')
		.select('*')
		.eq('username', username)
		.single() // We expect exactly one result due to unique constraint

	if (profileError) throw profileError

	// Second query: Get the associated schedule using the profile's user_id
	const { data: schedule, error: scheduleError } = await supabase
		.from('schedules')
		.select('*')
		.eq('user_id', profile.id)
		.single() // Each user should have exactly one schedule

	if (scheduleError) throw scheduleError

	// Combine the data into a single object for easier consumption
	return {
		...profile,
		schedule
	} as UserProfileWithSchedule
}

/**
 * Validates if a username is available for use
 *
 * Usernames must be unique across the platform as they're used in public URLs.
 * This function checks for conflicts while allowing users to keep their current username.
 *
 * @param username - The username to validate
 * @param currentUsername - The user's current username (optional, for updates)
 * @returns Promise<boolean> - true if username is available, false if taken
 */
export async function validateUsername(
	username: string,
	currentUsername?: string | null
) {
	// If the username is the same as current, it's always valid (no change)
	if (username === currentUsername) return true

	// Check if any other user has this username
	const { data, error } = await supabase
		.from('profiles')
		.select('username')
		.eq('username', username)
		.single()

	// PGRST116 error code means "no rows found" - username is available
	if (error?.code === 'PGRST116') {
		return true
	}

	// If we found a matching username, it's not available
	// If there was any other error, assume it's not available for safety
	return false
}

/**
 * Updates a user's profile information
 *
 * Uses upsert to handle both profile creation and updates seamlessly.
 * This is particularly useful for new users who may not have a profile row yet.
 *
 * @param userId - UUID of the user whose profile to update
 * @param profileData - Partial profile data to update (only changed fields)
 * @throws Error if update fails or user doesn't have permission
 */
export async function updateProfile(
	userId: string,
	profileData: Partial<Profile>
) {
	const { error } = await supabase.from('profiles').upsert({
		id: userId, // Ensure we're updating the correct user's profile
		...profileData
	})

	if (error) throw error
}

/**
 * Uploads a profile picture to Supabase Storage and returns the public URL
 *
 * The function:
 * 1. Generates a unique filename to prevent conflicts
 * 2. Uploads the file to the 'profile-pictures' storage bucket
 * 3. Returns the public URL for immediate use
 *
 * Note: This function only handles the file upload. You should call updateProfile()
 * separately to save the URL to the user's profile record.
 *
 * @param userId - UUID of the user uploading the picture
 * @param file - The image file to upload
 * @returns Promise<string> - Public URL of the uploaded image
 * @throws Error if upload fails or file is invalid
 */
export async function uploadProfilePicture(userId: string, file: File) {
	// Extract file extension for proper file typing
	const fileExt = file.name.split('.').pop()

	// Create unique filename to prevent conflicts and enable versioning
	const fileName = `${userId}-${Date.now()}.${fileExt}`

	// Upload file to the 'profile-pictures' storage bucket
	const { error: uploadError } = await supabase.storage
		.from('profile-pictures')
		.upload(fileName, file)

	console.log('uploadError', uploadError)
	if (uploadError) throw uploadError

	// Get the public URL for the uploaded file
	const {
		data: { publicUrl }
	} = supabase.storage.from('profile-pictures').getPublicUrl(fileName)

	return publicUrl
}

/**
 * Retrieves a user's profile by their user ID
 *
 * @param userId - UUID of the user whose profile to fetch
 * @returns Promise<Profile | null> - User profile or null if not found
 * @throws Error if database operation fails
 */
export async function getProfileById(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<Profile | null> {
	// Use provided client or fall back to default
	const client = supabaseClient || supabase

	const { data: profile, error } = await client
		.from('profiles')
		.select('*')
		.eq('id', userId)
		.single()

	if (error) {
		if (error.code === 'PGRST116') return null // Not found
		throw error
	}
	return profile
}

/**
 * Retrieves a user's email by their user ID
 * Convenience function for cases where only email is needed
 *
 * @param userId - UUID of the user whose email to fetch
 * @param supabaseClient - Optional Supabase client instance (uses default if not provided)
 * @returns Promise<string | null> - User email or null if not found
 * @throws Error if database operation fails
 */
export async function getUserEmail(
	userId: string,
	supabaseClient?: SupabaseClient
): Promise<string | null> {
	// Use provided client or fall back to default
	const client = supabaseClient || supabase

	const { data: profile, error } = await client
		.from('profiles')
		.select('email')
		.eq('id', userId)
		.single()

	if (error) {
		if (error.code === 'PGRST116') return null // Not found
		throw error
	}
	return profile.email
}

// Retrieves a user's profile by email (helper for OAuth callbacks)
export async function getProfileByEmail(
	email: string,
	supabaseClient?: SupabaseClient
) {
	const client = supabaseClient || supabase
	const { data, error } = await client
		.from('profiles')
		.select('*')
		.eq('email', email)
		.single()
	return { data, error }
}

// TODO: Add additional profile-related functions as needed:
// - deleteProfile()
// - searchProfiles()
// - updateLastActive()
// - getProfileStats()
