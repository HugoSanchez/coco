export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[]

export interface Database {
	public: {
		Tables: {
			bookings: {
				Row: {
					id: string
					user_id: string
					client_id: string
					start_time: string
					end_time: string
					status: string
					billing_status: string
					payment_status: string
					billing_settings_id: string | null
					billed_at: string | null
					paid_at: string | null
					created_at: string
					updated_at: string
				}
				Insert: {
					id?: string
					user_id: string
					client_id: string
					start_time: string
					end_time: string
					status?: string
					billing_status?: string
					payment_status?: string
					billing_settings_id?: string | null
					billed_at?: string | null
					paid_at?: string | null
					created_at?: string
					updated_at?: string
				}
				Update: {
					id?: string
					user_id?: string
					client_id?: string
					start_time?: string
					end_time?: string
					status?: string
					billing_status?: string
					payment_status?: string
					billing_settings_id?: string | null
					billed_at?: string | null
					paid_at?: string | null
					created_at?: string
					updated_at?: string
				}
			}
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			[_ in never]: never
		}
		Enums: {
			[_ in never]: never
		}
		CompositeTypes: {
			[_ in never]: never
		}
	}
}

export type Tables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Insert']
