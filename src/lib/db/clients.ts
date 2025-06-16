import { supabase } from '@/lib/supabase'
import { Tables } from '@/types/database.types'

export type Client = Tables<'clients'>

export async function getClientsForUser(userId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export interface CreateClientPayload {
  user_id: string
  name: string
  email: string
  description?: string | null
  should_bill?: boolean
  billing_amount?: number | null
  billing_type?: string | null
  billing_frequency?: string | null
  billing_trigger?: string | null
  billing_advance_days?: number | null
}

export async function createClient(payload: CreateClientPayload) {
  const { error } = await supabase
    .from('clients')
    .insert([payload])
  if (error) throw error
}
