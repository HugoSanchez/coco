export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
          billing_amount: number | null
          billing_type: string
          booking_id: string | null
          client_id: string | null
          created_at: string | null
          currency: string
          first_consultation_amount: number | null
          first_meeting_duration_min: number | null
          id: string
          is_default: boolean | null
          meeting_duration_min: number | null
          payment_email_lead_hours: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          billing_amount?: number | null
          billing_type: string
          booking_id?: string | null
          client_id?: string | null
          created_at?: string | null
          currency?: string
          first_consultation_amount?: number | null
          first_meeting_duration_min?: number | null
          id?: string
          is_default?: boolean | null
          meeting_duration_min?: number | null
          payment_email_lead_hours?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          billing_amount?: number | null
          billing_type?: string
          booking_id?: string | null
          client_id?: string | null
          created_at?: string | null
          currency?: string
          first_consultation_amount?: number | null
          first_meeting_duration_min?: number | null
          id?: string
          is_default?: boolean | null
          meeting_duration_min?: number | null
          payment_email_lead_hours?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_settings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount: number
          billing_type: string
          booking_id: string
          client_email: string
          client_id: string | null
          client_name: string
          created_at: string
          currency: string
          email_scheduled_at: string | null
          email_send_locked_at: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          paid_at: string | null
          refund_invoice_id: string | null
          refund_reason: string | null
          refunded_amount: number
          refunded_at: string | null
          sent_at: string | null
          status: string
          stripe_refund_id: string | null
          tax_amount: number
          tax_rate_percent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_type: string
          booking_id: string
          client_email: string
          client_id?: string | null
          client_name: string
          created_at?: string
          currency?: string
          email_scheduled_at?: string | null
          email_send_locked_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          paid_at?: string | null
          refund_invoice_id?: string | null
          refund_reason?: string | null
          refunded_amount?: number
          refunded_at?: string | null
          sent_at?: string | null
          status?: string
          stripe_refund_id?: string | null
          tax_amount?: number
          tax_rate_percent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_type?: string
          booking_id?: string
          client_email?: string
          client_id?: string | null
          client_name?: string
          created_at?: string
          currency?: string
          email_scheduled_at?: string | null
          email_send_locked_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          paid_at?: string | null
          refund_invoice_id?: string | null
          refund_reason?: string | null
          refunded_amount?: number
          refunded_at?: string | null
          sent_at?: string | null
          status?: string
          stripe_refund_id?: string | null
          tax_amount?: number
          tax_rate_percent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_refund_invoice_id_fkey"
            columns: ["refund_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          client_id: string
          consultation_type: string | null
          created_at: string | null
          end_time: string
          id: string
          location_text: string | null
          mode: string
          start_time: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          consultation_type?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          location_text?: string | null
          mode?: string
          start_time: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          consultation_type?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          location_text?: string | null
          mode?: string
          start_time?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          booking_id: string
          created_at: string | null
          event_status: string
          event_type: string
          google_event_id: string
          google_meet_link: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          event_status?: string
          event_type?: string
          google_event_id: string
          google_meet_link?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          event_status?: string
          event_type?: string
          google_event_id?: string
          google_meet_link?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          expiry_date: number
          granted_scopes: string[] | null
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expiry_date: number
          granted_scopes?: string[] | null
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expiry_date?: number
          granted_scopes?: string[] | null
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
          full_name_search: string | null
          id: string
          last_name: string | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          email: string
          full_name_search?: string | null
          id?: string
          last_name?: string | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          email?: string
          full_name_search?: string | null
          id?: string
          last_name?: string | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_communications: {
        Row: {
          bill_id: string | null
          booking_id: string | null
          client_id: string | null
          created_at: string | null
          email_type: string
          error_message: string | null
          id: string
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          bill_id?: string | null
          booking_id?: string | null
          client_id?: string | null
          created_at?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          bill_id?: string | null
          booking_id?: string | null
          client_id?: string | null
          created_at?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_communications_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_communications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_counters: {
        Row: {
          next_number: number
          series: string
          user_id: string
        }
        Insert: {
          next_number: number
          series: string
          user_id: string
        }
        Update: {
          next_number?: number
          series?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          billing_period_end: string | null
          billing_period_start: string | null
          canceled_at: string | null
          client_email_snapshot: string
          client_id: string | null
          client_name_snapshot: string
          created_at: string
          currency: string
          document_kind: string
          due_date: string | null
          id: string
          issued_at: string | null
          issuer_address_snapshot: Json | null
          issuer_name_snapshot: string | null
          issuer_tax_id_snapshot: string | null
          legacy_bill_id: string | null
          month: number | null
          notes: string | null
          number: number | null
          paid_at: string | null
          pdf_sha256: string | null
          pdf_url: string | null
          reason: string | null
          rectifies_invoice_id: string | null
          series: string | null
          status: string
          stripe_receipt_url: string | null
          stripe_refund_id: string | null
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          user_id: string
          year: number | null
        }
        Insert: {
          billing_period_end?: string | null
          billing_period_start?: string | null
          canceled_at?: string | null
          client_email_snapshot: string
          client_id?: string | null
          client_name_snapshot: string
          created_at?: string
          currency?: string
          document_kind?: string
          due_date?: string | null
          id?: string
          issued_at?: string | null
          issuer_address_snapshot?: Json | null
          issuer_name_snapshot?: string | null
          issuer_tax_id_snapshot?: string | null
          legacy_bill_id?: string | null
          month?: number | null
          notes?: string | null
          number?: number | null
          paid_at?: string | null
          pdf_sha256?: string | null
          pdf_url?: string | null
          reason?: string | null
          rectifies_invoice_id?: string | null
          series?: string | null
          status?: string
          stripe_receipt_url?: string | null
          stripe_refund_id?: string | null
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          user_id: string
          year?: number | null
        }
        Update: {
          billing_period_end?: string | null
          billing_period_start?: string | null
          canceled_at?: string | null
          client_email_snapshot?: string
          client_id?: string | null
          client_name_snapshot?: string
          created_at?: string
          currency?: string
          document_kind?: string
          due_date?: string | null
          id?: string
          issued_at?: string | null
          issuer_address_snapshot?: Json | null
          issuer_name_snapshot?: string | null
          issuer_tax_id_snapshot?: string | null
          legacy_bill_id?: string | null
          month?: number | null
          notes?: string | null
          number?: number | null
          paid_at?: string | null
          pdf_sha256?: string | null
          pdf_url?: string | null
          reason?: string | null
          rectifies_invoice_id?: string | null
          series?: string | null
          status?: string
          stripe_receipt_url?: string | null
          stripe_refund_id?: string | null
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_rectifies_invoice_id_fkey"
            columns: ["rectifies_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_sessions: {
        Row: {
          amount: number
          booking_id: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          invoice_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_in_person_location_text: string | null
          description: string | null
          email: string
          fiscal_address_line1: string | null
          fiscal_address_line2: string | null
          fiscal_city: string | null
          fiscal_country: string | null
          fiscal_postal_code: string | null
          fiscal_province: string | null
          id: string
          name: string | null
          profile_picture_url: string | null
          tax_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          default_in_person_location_text?: string | null
          description?: string | null
          email: string
          fiscal_address_line1?: string | null
          fiscal_address_line2?: string | null
          fiscal_city?: string | null
          fiscal_country?: string | null
          fiscal_postal_code?: string | null
          fiscal_province?: string | null
          id: string
          name?: string | null
          profile_picture_url?: string | null
          tax_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          default_in_person_location_text?: string | null
          description?: string | null
          email?: string
          fiscal_address_line1?: string | null
          fiscal_address_line2?: string | null
          fiscal_city?: string | null
          fiscal_country?: string | null
          fiscal_postal_code?: string | null
          fiscal_province?: string | null
          id?: string
          name?: string | null
          profile_picture_url?: string | null
          tax_id?: string | null
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
      stripe_accounts: {
        Row: {
          created_at: string | null
          id: string
          onboarding_completed: boolean | null
          payments_enabled: boolean | null
          stripe_account_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          onboarding_completed?: boolean | null
          payments_enabled?: boolean | null
          stripe_account_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          onboarding_completed?: boolean | null
          payments_enabled?: boolean | null
          stripe_account_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      weekly_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          timezone: string
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          timezone?: string
          updated_at?: string
          user_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_invoice_counter: {
        Args: { s: string; u: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
