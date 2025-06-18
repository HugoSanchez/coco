import { supabase } from '../supabase'

/**
 * Get user's default billing configuration
 * Returns null if no configuration exists
 */
export async function getBillingPreferences(userId: string) {
  try {
    // Get user's default billing settings
    const { data, error } = await supabase
      .from('billing_settings')
      .select('*')
      .eq('user_id', userId)
      .is('client_id', null)
      .is('booking_id', null)
      .eq('is_default', true)
      .single()

    if (error) {
      // If no record found, return null (not an error)
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching billing preferences:', error)
      return null
    }

    // Transform database format to form format
    return {
      shouldBill: data.should_bill || false,
      billingAmount: data.billing_amount?.toString() || '',
      billingType: data.billing_type || '',
      billingFrequency: data.billing_frequency || '',
      billingTrigger: data.billing_trigger || '',
      billingAdvanceDays: data.billing_advance_days?.toString() || '0'
    }
  } catch (error) {
    console.error('Error in getBillingPreferences:', error)
    return null
  }
}

/**
 * Save or update user's default billing configuration
 * Uses upsert to handle both create and update cases
 */
export async function saveBillingPreferences(userId: string, preferences: any) {
  try {
    // Convert form data to database format for user defaults
    const billingData = {
      should_bill: preferences.shouldBill || false,
      billing_amount: parseFloat(preferences.billingAmount) || null,
      billing_type: preferences.billingType || null,
      billing_frequency: preferences.billingFrequency || null,
      billing_trigger: preferences.billingTrigger || null,
      billing_advance_days: parseInt(preferences.billingAdvanceDays) || 0
    }

    // First, try to update existing default settings
    const { data: updateData, error: updateError } = await supabase
      .from('billing_settings')
      .update(billingData)
      .eq('user_id', userId)
      .is('client_id', null)
      .is('booking_id', null)
      .eq('is_default', true)
      .select()

    // If update was successful and found a record
    if (updateData && updateData.length > 0) {
      return updateData
    }

    // If no record was found to update, create a new one
    const insertData = {
      user_id: userId,
      client_id: null,
      booking_id: null,
      is_default: true,
      ...billingData
    }

    const { data: insertResult, error: insertError } = await supabase
      .from('billing_settings')
      .insert(insertData)
      .select()

    if (insertError) {
      console.error('Error inserting billing preferences:', insertError)
      throw new Error('Failed to save billing preferences')
    }

    return insertResult
  } catch (error) {
    console.error('Error in saveBillingPreferences:', error)
    throw error
  }
}

// Helper function to get billing settings for a specific client
export async function getClientBillingSettings(userId: string, clientId: string) {
  try {
    const { data, error } = await supabase
      .from('billing_settings')
      .select('*')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .is('booking_id', null)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching client billing settings:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in getClientBillingSettings:', error)
    return null
  }
}

// Helper function to get billing settings for a specific booking
export async function getBookingBillingSettings(bookingId: string) {
  try {
    const { data, error } = await supabase
      .from('billing_settings')
      .select('*')
      .eq('booking_id', bookingId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching booking billing settings:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in getBookingBillingSettings:', error)
    return null
  }
}
