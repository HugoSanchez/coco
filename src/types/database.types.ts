export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[]

export type Database = {
	graphql_public: {
		Tables: {
			[_ in never]: never
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			graphql: {
				Args: {
					operationName?: string
					query?: string
					variables?: Json
					extensions?: Json
				}
				Returns: Json
			}
		}
		Enums: {
			[_ in never]: never
		}
		CompositeTypes: {
			[_ in never]: never
		}
	}
	public: {
		Tables: {
			billing_settings: {
				Row: {
					billing_advance_days: number | null
					billing_amount: number | null
					billing_frequency: string | null
					billing_trigger: string | null
					billing_type: string | null
					booking_id: string | null
					client_id: string | null
					created_at: string | null
					id: string
					is_default: boolean | null
					should_bill: boolean | null
					updated_at: string | null
					user_id: string | null
				}
				Insert: {
					billing_advance_days?: number | null
					billing_amount?: number | null
					billing_frequency?: string | null
					billing_trigger?: string | null
					billing_type?: string | null
					booking_id?: string | null
					client_id?: string | null
					created_at?: string | null
					id?: string
					is_default?: boolean | null
					should_bill?: boolean | null
					updated_at?: string | null
					user_id?: string | null
				}
				Update: {
					billing_advance_days?: number | null
					billing_amount?: number | null
					billing_frequency?: string | null
					billing_trigger?: string | null
					billing_type?: string | null
					booking_id?: string | null
					client_id?: string | null
					created_at?: string | null
					id?: string
					is_default?: boolean | null
					should_bill?: boolean | null
					updated_at?: string | null
					user_id?: string | null
				}
				Relationships: [
					{
						foreignKeyName: 'billing_preferences_user_id_fkey'
						columns: ['user_id']
						isOneToOne: true
						referencedRelation: 'profiles'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'billing_settings_booking_id_fkey'
						columns: ['booking_id']
						isOneToOne: false
						referencedRelation: 'bookings'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'billing_settings_client_id_fkey'
						columns: ['client_id']
						isOneToOne: false
						referencedRelation: 'clients'
						referencedColumns: ['id']
					}
				]
			}
			bookings: {
				Row: {
					client_id: string
					created_at: string | null
					end_time: string
					id: string
					start_time: string
					status: string | null
					updated_at: string | null
					user_id: string
				}
				Insert: {
					client_id: string
					created_at?: string | null
					end_time: string
					id?: string
					start_time: string
					status?: string | null
					updated_at?: string | null
					user_id: string
				}
				Update: {
					client_id?: string
					created_at?: string | null
					end_time?: string
					id?: string
					start_time?: string
					status?: string | null
					updated_at?: string | null
					user_id?: string
				}
				Relationships: [
					{
						foreignKeyName: 'bookings_client_id_fkey'
						columns: ['client_id']
						isOneToOne: false
						referencedRelation: 'clients'
						referencedColumns: ['id']
					}
				]
			}
			calendar_info: {
				Row: {
					calendar_name: string | null
					created_at: string
					id: string
					updated_at: string
				}
				Insert: {
					calendar_name?: string | null
					created_at?: string
					id: string
					updated_at?: string
				}
				Update: {
					calendar_name?: string | null
					created_at?: string
					id?: string
					updated_at?: string
				}
				Relationships: []
			}
			calendar_tokens: {
				Row: {
					access_token: string
					created_at: string
					expiry_date: number
					id: string
					refresh_token: string
					updated_at: string
					user_id: string
				}
				Insert: {
					access_token: string
					created_at?: string
					expiry_date: number
					id?: string
					refresh_token: string
					updated_at?: string
					user_id: string
				}
				Update: {
					access_token?: string
					created_at?: string
					expiry_date?: number
					id?: string
					refresh_token?: string
					updated_at?: string
					user_id?: string
				}
				Relationships: []
			}
			clients: {
				Row: {
					created_at: string | null
					description: string | null
					email: string
					id: string
					name: string
					updated_at: string | null
					user_id: string
				}
				Insert: {
					created_at?: string | null
					description?: string | null
					email: string
					id?: string
					name: string
					updated_at?: string | null
					user_id: string
				}
				Update: {
					created_at?: string | null
					description?: string | null
					email?: string
					id?: string
					name?: string
					updated_at?: string | null
					user_id?: string
				}
				Relationships: []
			}
			profiles: {
				Row: {
					created_at: string
					description: string | null
					email: string
					id: string
					name: string | null
					profile_picture_url: string | null
					updated_at: string
					username: string | null
				}
				Insert: {
					created_at?: string
					description?: string | null
					email: string
					id: string
					name?: string | null
					profile_picture_url?: string | null
					updated_at?: string
					username?: string | null
				}
				Update: {
					created_at?: string
					description?: string | null
					email?: string
					id?: string
					name?: string | null
					profile_picture_url?: string | null
					updated_at?: string
					username?: string | null
				}
				Relationships: []
			}
			schedules: {
				Row: {
					created_at: string
					currency: string | null
					id: string
					meeting_duration: number | null
					meeting_price: number | null
					time_zone: string | null
					user_id: string | null
					weekly_availability: Json | null
				}
				Insert: {
					created_at?: string
					currency?: string | null
					id?: string
					meeting_duration?: number | null
					meeting_price?: number | null
					time_zone?: string | null
					user_id?: string | null
					weekly_availability?: Json | null
				}
				Update: {
					created_at?: string
					currency?: string | null
					id?: string
					meeting_duration?: number | null
					meeting_price?: number | null
					time_zone?: string | null
					user_id?: string | null
					weekly_availability?: Json | null
				}
				Relationships: []
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

type DefaultSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database
	}
		? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R
	  }
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
			DefaultSchema['Views'])
	? (DefaultSchema['Tables'] &
			DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
			Row: infer R
	  }
		? R
		: never
	: never

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database
	}
		? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I
	  }
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
	? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
			Insert: infer I
	  }
		? I
		: never
	: never

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database
	}
		? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U
	  }
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
	? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
			Update: infer U
	  }
		? U
		: never
	: never

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema['Enums']
		| { schema: keyof Database },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof Database
	}
		? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
	? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
	: never

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof Database },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof Database
	}
		? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
	? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
	? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
	: never

export const Constants = {
	graphql_public: {
		Enums: {}
	},
	public: {
		Enums: {}
	}
} as const
