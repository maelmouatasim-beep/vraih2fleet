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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage_events: {
        Row: {
          cache_read_tokens: number
          cache_write_tokens: number
          created_at: string
          feature: string
          id: string
          input_tokens: number
          model: string
          organization_id: string
          output_tokens: number
          user_id: string | null
        }
        Insert: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          created_at?: string
          feature: string
          id?: string
          input_tokens?: number
          model: string
          organization_id: string
          output_tokens?: number
          user_id?: string | null
        }
        Update: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          created_at?: string
          feature?: string
          id?: string
          input_tokens?: number
          model?: string
          organization_id?: string
          output_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      client_documents: {
        Row: {
          applied: Json
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          document_date: string | null
          extraction: Json
          file_name: string
          id: string
          kind: string
          mime_type: string
          organization_id: string
          project_id: string | null
          sha256: string
          size_bytes: number
          status: string
          storage_path: string
          supplier: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          applied?: Json
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          document_date?: string | null
          extraction?: Json
          file_name: string
          id?: string
          kind: string
          mime_type: string
          organization_id: string
          project_id?: string | null
          sha256: string
          size_bytes: number
          status?: string
          storage_path: string
          supplier?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Update: {
          applied?: Json
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          document_date?: string | null
          extraction?: Json
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string
          organization_id?: string
          project_id?: string | null
          sha256?: string
          size_bytes?: number
          status?: string
          storage_path?: string
          supplier?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          proposal: Json | null
          role: string
          sources: Json
          user_id: string
          verified_numbers: number | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          proposal?: Json | null
          role: string
          sources?: Json
          user_id?: string
          verified_numbers?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          proposal?: Json | null
          role?: string
          sources?: Json
          user_id?: string
          verified_numbers?: number | null
        }
        Relationships: []
      }
      organization_ai_settings: {
        Row: {
          copilot_enabled: boolean
          council_note_enabled: boolean
          daily_request_limit: number
          document_reading_enabled: boolean
          monthly_token_limit: number
          organization_id: string
          smart_import_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          copilot_enabled?: boolean
          council_note_enabled?: boolean
          daily_request_limit?: number
          document_reading_enabled?: boolean
          monthly_token_limit?: number
          organization_id: string
          smart_import_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          copilot_enabled?: boolean
          council_note_enabled?: boolean
          daily_request_limit?: number
          document_reading_enabled?: boolean
          monthly_token_limit?: number
          organization_id?: string
          smart_import_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_hash: string
          key_name: string
          key_prefix: string
          last_reset_at: string | null
          last_used_at: string | null
          rate_limit_per_hour: number | null
          request_count: number | null
          scopes: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_name: string
          key_prefix: string
          last_reset_at?: string | null
          last_used_at?: string | null
          rate_limit_per_hour?: number | null
          request_count?: number | null
          scopes?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_name?: string
          key_prefix?: string
          last_reset_at?: string | null
          last_used_at?: string | null
          rate_limit_per_hour?: number | null
          request_count?: number | null
          scopes?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      confirmed_subsidies: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          document_reference: string
          id: string
          label: string | null
          notes: string | null
          payment_year: number | null
          program_id: string
          project_id: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          document_reference: string
          id?: string
          label?: string | null
          notes?: string | null
          payment_year?: number | null
          program_id: string
          project_id: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          document_reference?: string
          id?: string
          label?: string | null
          notes?: string | null
          payment_year?: number | null
          program_id?: string
          project_id?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmed_subsidies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmed_subsidies_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_reference_data: {
        Row: {
          category: string
          created_at: string
          data: Json | null
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_leads: {
        Row: {
          calculator_inputs: Json | null
          calculator_results_summary: Json | null
          converted_at: string | null
          converted_to_user: boolean | null
          created_at: string | null
          email: string
          id: string
          source: string | null
        }
        Insert: {
          calculator_inputs?: Json | null
          calculator_results_summary?: Json | null
          converted_at?: string | null
          converted_to_user?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          calculator_inputs?: Json | null
          calculator_results_summary?: Json | null
          converted_at?: string | null
          converted_to_user?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      energy_client_inputs: {
        Row: {
          created_at: string
          diesel_document_id: string | null
          diesel_price_per_l: number | null
          electricity_cost_per_kwh: number | null
          electricity_document_id: string | null
          grid_connection_quote: number | null
          h2_price_per_kg: number | null
          id: string
          notes: string | null
          organization_id: string
          project_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          diesel_document_id?: string | null
          diesel_price_per_l?: number | null
          electricity_cost_per_kwh?: number | null
          electricity_document_id?: string | null
          grid_connection_quote?: number | null
          h2_price_per_kg?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          project_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          diesel_document_id?: string | null
          diesel_price_per_l?: number | null
          electricity_cost_per_kwh?: number | null
          electricity_document_id?: string | null
          grid_connection_quote?: number | null
          h2_price_per_kg?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          project_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "energy_client_inputs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "energy_client_inputs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      garages: {
        Row: {
          address: string | null
          available_power_kw: number | null
          charger_quote_document_id: string | null
          charger_unit_quote: Json | null
          created_at: string
          departure_time: string | null
          grid_connection_quote: number | null
          grid_quote_document_id: string | null
          hq_rate: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          parking_spots: number | null
          return_time: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          available_power_kw?: number | null
          charger_quote_document_id?: string | null
          charger_unit_quote?: Json | null
          created_at?: string
          departure_time?: string | null
          grid_connection_quote?: number | null
          grid_quote_document_id?: string | null
          hq_rate?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          parking_spots?: number | null
          return_time?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          available_power_kw?: number | null
          charger_quote_document_id?: string | null
          charger_unit_quote?: Json | null
          created_at?: string
          departure_time?: string | null
          grid_connection_quote?: number | null
          grid_quote_document_id?: string | null
          hq_rate?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          parking_spots?: number | null
          return_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hydrogen_suppliers: {
        Row: {
          certifications: string[] | null
          city: string | null
          company_name: string
          contact_email: string | null
          contact_phone: string | null
          country: string
          created_at: string
          currency: string | null
          delivery_time_weeks: number | null
          description_en: string | null
          description_fr: string | null
          employee_count: string | null
          established_year: number | null
          headquarters_address: string | null
          id: string
          is_verified: boolean
          languages: string[] | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          metadata: Json | null
          postal_code: string | null
          price_range_max: number | null
          price_range_min: number | null
          products_services: string[]
          province_state: string | null
          rating: number | null
          response_time_hours: number | null
          review_count: number | null
          service_regions: string[] | null
          social_media: Json | null
          supplier_type: Database["public"]["Enums"]["supplier_type"]
          updated_at: string
          vehicle_categories: string[] | null
          verification_date: string | null
          warranty_years: number | null
          website_url: string | null
        }
        Insert: {
          certifications?: string[] | null
          city?: string | null
          company_name: string
          contact_email?: string | null
          contact_phone?: string | null
          country: string
          created_at?: string
          currency?: string | null
          delivery_time_weeks?: number | null
          description_en?: string | null
          description_fr?: string | null
          employee_count?: string | null
          established_year?: number | null
          headquarters_address?: string | null
          id?: string
          is_verified?: boolean
          languages?: string[] | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          metadata?: Json | null
          postal_code?: string | null
          price_range_max?: number | null
          price_range_min?: number | null
          products_services?: string[]
          province_state?: string | null
          rating?: number | null
          response_time_hours?: number | null
          review_count?: number | null
          service_regions?: string[] | null
          social_media?: Json | null
          supplier_type: Database["public"]["Enums"]["supplier_type"]
          updated_at?: string
          vehicle_categories?: string[] | null
          verification_date?: string | null
          warranty_years?: number | null
          website_url?: string | null
        }
        Update: {
          certifications?: string[] | null
          city?: string | null
          company_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          currency?: string | null
          delivery_time_weeks?: number | null
          description_en?: string | null
          description_fr?: string | null
          employee_count?: string | null
          established_year?: number | null
          headquarters_address?: string | null
          id?: string
          is_verified?: boolean
          languages?: string[] | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          metadata?: Json | null
          postal_code?: string | null
          price_range_max?: number | null
          price_range_min?: number | null
          products_services?: string[]
          province_state?: string | null
          rating?: number | null
          response_time_hours?: number | null
          review_count?: number | null
          service_regions?: string[] | null
          social_media?: Json | null
          supplier_type?: Database["public"]["Enums"]["supplier_type"]
          updated_at?: string
          vehicle_categories?: string[] | null
          verification_date?: string | null
          warranty_years?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      incentives_programs: {
        Row: {
          amount_cad: number
          amount_max_cad: number | null
          application_url: string
          created_at: string
          deadline: string | null
          description_en: string
          description_fr: string
          eligibility_criteria_en: string
          eligibility_criteria_fr: string
          fuel_types: string[]
          id: string
          last_verified_date: string
          level: Database["public"]["Enums"]["incentive_level"]
          program_name_en: string
          program_name_fr: string
          province: string | null
          source_url: string
          status: Database["public"]["Enums"]["incentive_status"]
          updated_at: string
          vehicle_classes: string[]
        }
        Insert: {
          amount_cad: number
          amount_max_cad?: number | null
          application_url: string
          created_at?: string
          deadline?: string | null
          description_en: string
          description_fr: string
          eligibility_criteria_en: string
          eligibility_criteria_fr: string
          fuel_types?: string[]
          id?: string
          last_verified_date?: string
          level: Database["public"]["Enums"]["incentive_level"]
          program_name_en: string
          program_name_fr: string
          province?: string | null
          source_url: string
          status?: Database["public"]["Enums"]["incentive_status"]
          updated_at?: string
          vehicle_classes?: string[]
        }
        Update: {
          amount_cad?: number
          amount_max_cad?: number | null
          application_url?: string
          created_at?: string
          deadline?: string | null
          description_en?: string
          description_fr?: string
          eligibility_criteria_en?: string
          eligibility_criteria_fr?: string
          fuel_types?: string[]
          id?: string
          last_verified_date?: string
          level?: Database["public"]["Enums"]["incentive_level"]
          program_name_en?: string
          program_name_fr?: string
          province?: string | null
          source_url?: string
          status?: Database["public"]["Enums"]["incentive_status"]
          updated_at?: string
          vehicle_classes?: string[]
        }
        Relationships: []
      }
      infrastructure_plans: {
        Row: {
          chargers_fast: number
          chargers_slow: number
          chargers_ultra: number
          created_at: string
          ev_battery_capacity_kwh: number
          ev_capex: number
          ev_charging_hours: number
          ev_charging_speed: string
          ev_daily_kwh: number
          ev_grid_upgrade: number
          ev_installation: number
          ev_opex: number
          ev_vehicles_count: number
          h2_capex: number
          h2_daily_kg: number
          h2_land_permits: number
          h2_operating_hours: number
          h2_opex: number
          h2_refueling_frequency: number
          h2_station_capacity: number
          h2_stations_count: number
          h2_vehicles_count: number
          id: string
          name: string | null
          project_id: string | null
          scenario_id: string | null
          total_capex: number
          total_opex_10y: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chargers_fast?: number
          chargers_slow?: number
          chargers_ultra?: number
          created_at?: string
          ev_battery_capacity_kwh?: number
          ev_capex?: number
          ev_charging_hours?: number
          ev_charging_speed?: string
          ev_daily_kwh?: number
          ev_grid_upgrade?: number
          ev_installation?: number
          ev_opex?: number
          ev_vehicles_count?: number
          h2_capex?: number
          h2_daily_kg?: number
          h2_land_permits?: number
          h2_operating_hours?: number
          h2_opex?: number
          h2_refueling_frequency?: number
          h2_station_capacity?: number
          h2_stations_count?: number
          h2_vehicles_count?: number
          id?: string
          name?: string | null
          project_id?: string | null
          scenario_id?: string | null
          total_capex?: number
          total_opex_10y?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chargers_fast?: number
          chargers_slow?: number
          chargers_ultra?: number
          created_at?: string
          ev_battery_capacity_kwh?: number
          ev_capex?: number
          ev_charging_hours?: number
          ev_charging_speed?: string
          ev_daily_kwh?: number
          ev_grid_upgrade?: number
          ev_installation?: number
          ev_opex?: number
          ev_vehicles_count?: number
          h2_capex?: number
          h2_daily_kg?: number
          h2_land_permits?: number
          h2_operating_hours?: number
          h2_opex?: number
          h2_refueling_frequency?: number
          h2_station_capacity?: number
          h2_stations_count?: number
          h2_vehicles_count?: number
          id?: string
          name?: string | null
          project_id?: string | null
          scenario_id?: string | null
          total_capex?: number
          total_opex_10y?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "infrastructure_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infrastructure_plans_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          project_id: string | null
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          project_id?: string | null
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          project_id?: string | null
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          name: string
          org_type: string
          region: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name: string
          org_type?: string
          region?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name?: string
          org_type?: string
          region?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
        }
        Relationships: [
          {
            foreignKeyName: "pending_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_alerts: {
        Row: {
          alert_key: string
          dismissed_at: string | null
          dismissed_by: string | null
          emailed_at: string | null
          first_seen_at: string
          id: string
          kind: string
          last_seen_at: string
          message_en: string
          message_fr: string
          project_id: string
          resolved_at: string | null
          severity: string
          title_en: string
          title_fr: string
        }
        Insert: {
          alert_key: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          emailed_at?: string | null
          first_seen_at?: string
          id?: string
          kind: string
          last_seen_at?: string
          message_en: string
          message_fr: string
          project_id: string
          resolved_at?: string | null
          severity: string
          title_en: string
          title_fr: string
        }
        Update: {
          alert_key?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          emailed_at?: string | null
          first_seen_at?: string
          id?: string
          kind?: string
          last_seen_at?: string
          message_en?: string
          message_fr?: string
          project_id?: string
          resolved_at?: string | null
          severity?: string
          title_en?: string
          title_fr?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_change_log: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          organization_id: string
          project_id: string | null
          source: string
          summary: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          organization_id: string
          project_id?: string | null
          source: string
          summary?: string | null
          user_id?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          organization_id?: string
          project_id?: string | null
          source?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_change_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_change_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          current_organization_id: string | null
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string | null
          email_notifications: Json | null
          fleet_size: string | null
          fleet_types: string[] | null
          full_name: string | null
          function_title: string | null
          id: string
          newsletter_opt_in: boolean | null
          updated_at: string
        }
        Insert: {
          current_organization_id?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          email_notifications?: Json | null
          fleet_size?: string | null
          fleet_types?: string[] | null
          full_name?: string | null
          function_title?: string | null
          id: string
          newsletter_opt_in?: boolean | null
          updated_at?: string
        }
        Update: {
          current_organization_id?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          email_notifications?: Json | null
          fleet_size?: string | null
          fleet_types?: string[] | null
          full_name?: string | null
          function_title?: string | null
          id?: string
          newsletter_opt_in?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      project_collaborators: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          project_id: string
          section: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          project_id: string
          section?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          project_id?: string
          section?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_versions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          project_id: string
          snapshot: Json
          version_name: string
          version_note: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          project_id: string
          snapshot: Json
          version_name: string
          version_note?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          project_id?: string
          snapshot?: Json
          version_name?: string
          version_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_vehicles: {
        Row: {
          acquired_vehicle: string | null
          actual_cost: number | null
          completed_date: string | null
          created_at: string
          id: string
          project_id: string
          quote_document_id: string | null
          quote_price: number | null
          quote_technology: string | null
          replacement_year: number | null
          target_technology: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          acquired_vehicle?: string | null
          actual_cost?: number | null
          completed_date?: string | null
          created_at?: string
          id?: string
          project_id: string
          quote_document_id?: string | null
          quote_price?: number | null
          quote_technology?: string | null
          replacement_year?: number | null
          target_technology?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          acquired_vehicle?: string | null
          actual_cost?: number | null
          completed_date?: string | null
          created_at?: string
          id?: string
          project_id?: string
          quote_document_id?: string | null
          quote_price?: number | null
          quote_technology?: string | null
          replacement_year?: number | null
          target_technology?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_vehicles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_vehicles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          country_or_region: string
          created_at: string
          currency: string
          default_analysis_horizon_years: number
          default_discount_rate: number
          description: string | null
          id: string
          name: string
          organization_id: string | null
          optimized_assignment: Json | null
          optimizer_constraints: Json | null
          selected_strategy: string | null
          strategy_applied_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          country_or_region?: string
          created_at?: string
          currency?: string
          default_analysis_horizon_years?: number
          default_discount_rate?: number
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          optimized_assignment?: Json | null
          optimizer_constraints?: Json | null
          selected_strategy?: string | null
          strategy_applied_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          country_or_region?: string
          created_at?: string
          currency?: string
          default_analysis_horizon_years?: number
          default_discount_rate?: number
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          optimized_assignment?: Json | null
          optimizer_constraints?: Json | null
          selected_strategy?: string | null
          strategy_applied_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          engine_version: string
          fingerprint: string
          id: string
          parameters: Json
          project_id: string
          report_kind: string
          strategy_key: string
          tco_alt: number | null
          tco_ref: number | null
          van: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          engine_version: string
          fingerprint: string
          id?: string
          parameters: Json
          project_id: string
          report_kind: string
          strategy_key: string
          tco_alt?: number | null
          tco_ref?: number | null
          van?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          engine_version?: string
          fingerprint?: string
          id?: string
          parameters?: Json
          project_id?: string
          report_kind?: string
          strategy_key?: string
          tco_alt?: number | null
          tco_ref?: number | null
          van?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "report_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_data_conditions: {
        Row: {
          condition_type: string
          created_at: string
          description: string | null
          id: string
          multiplier: number
          reference_id: string
        }
        Insert: {
          condition_type: string
          created_at?: string
          description?: string | null
          id?: string
          multiplier?: number
          reference_id: string
        }
        Update: {
          condition_type?: string
          created_at?: string
          description?: string | null
          id?: string
          multiplier?: number
          reference_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_data_conditions_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "reference_data_ranges"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_data_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          id: string
          new_max_value: number | null
          new_mid_value: number | null
          new_min_value: number | null
          old_max_value: number | null
          old_mid_value: number | null
          old_min_value: number | null
          reference_id: string
          timestamp: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          id?: string
          new_max_value?: number | null
          new_mid_value?: number | null
          new_min_value?: number | null
          old_max_value?: number | null
          old_mid_value?: number | null
          old_min_value?: number | null
          reference_id: string
          timestamp?: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          id?: string
          new_max_value?: number | null
          new_mid_value?: number | null
          new_min_value?: number | null
          old_max_value?: number | null
          old_mid_value?: number | null
          old_min_value?: number | null
          reference_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_data_history_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "reference_data_ranges"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_data_ranges: {
        Row: {
          category: Database["public"]["Enums"]["reference_category"]
          confidence_level: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          date_effective: string
          id: string
          last_updated: string
          max_value: number
          mid_value: number
          min_value: number
          region: string
          source_url: string | null
          subcategory: string
          unit: string
        }
        Insert: {
          category: Database["public"]["Enums"]["reference_category"]
          confidence_level?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          date_effective?: string
          id?: string
          last_updated?: string
          max_value: number
          mid_value: number
          min_value: number
          region: string
          source_url?: string | null
          subcategory: string
          unit: string
        }
        Update: {
          category?: Database["public"]["Enums"]["reference_category"]
          confidence_level?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          date_effective?: string
          id?: string
          last_updated?: string
          max_value?: number
          mid_value?: number
          min_value?: number
          region?: string
          source_url?: string | null
          subcategory?: string
          unit?: string
        }
        Relationships: []
      }
      reference_pricing: {
        Row: {
          created_at: string
          currency: string
          fuel_type: string
          id: string
          price_per_unit: number
          region: string
          source: string | null
          source_url: string | null
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          fuel_type: string
          id?: string
          price_per_unit: number
          region: string
          source?: string | null
          source_url?: string | null
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          fuel_type?: string
          id?: string
          price_per_unit?: number
          region?: string
          source?: string | null
          source_url?: string | null
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      reference_timelines: {
        Row: {
          category: string
          city: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          item_name: string
          last_verified: string | null
          max_duration_days: number | null
          metadata: Json | null
          min_duration_days: number | null
          region: string | null
          reliability_score: number | null
          source_type: string | null
          source_url: string | null
          typical_duration_days: number
          updated_at: string | null
        }
        Insert: {
          category: string
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          item_name: string
          last_verified?: string | null
          max_duration_days?: number | null
          metadata?: Json | null
          min_duration_days?: number | null
          region?: string | null
          reliability_score?: number | null
          source_type?: string | null
          source_url?: string | null
          typical_duration_days: number
          updated_at?: string | null
        }
        Update: {
          category?: string
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          item_name?: string
          last_verified?: string | null
          max_duration_days?: number | null
          metadata?: Json | null
          min_duration_days?: number | null
          region?: string | null
          reliability_score?: number | null
          source_type?: string | null
          source_url?: string | null
          typical_duration_days?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      roadmap_alerts: {
        Row: {
          action_label: string | null
          action_url: string | null
          assigned_to: string | null
          created_at: string | null
          id: string
          is_dismissed: boolean | null
          is_read: boolean | null
          message: string
          metadata: Json | null
          milestone_id: string | null
          roadmap_id: string
          severity: string | null
          title: string
          trigger_date: string | null
          triggered_at: string | null
          type: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          milestone_id?: string | null
          roadmap_id: string
          severity?: string | null
          title: string
          trigger_date?: string | null
          triggered_at?: string | null
          type: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          milestone_id?: string | null
          roadmap_id?: string
          severity?: string | null
          title?: string
          trigger_date?: string | null
          triggered_at?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_alerts_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "roadmap_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_alerts_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "transition_roadmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_cash_flow: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          currency: string | null
          date: string
          description: string | null
          id: string
          is_actual: boolean | null
          is_recurring: boolean | null
          metadata: Json | null
          milestone_id: string | null
          recurrence_pattern: string | null
          roadmap_id: string
          type: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          currency?: string | null
          date: string
          description?: string | null
          id?: string
          is_actual?: boolean | null
          is_recurring?: boolean | null
          metadata?: Json | null
          milestone_id?: string | null
          recurrence_pattern?: string | null
          roadmap_id: string
          type: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          currency?: string | null
          date?: string
          description?: string | null
          id?: string
          is_actual?: boolean | null
          is_recurring?: boolean | null
          metadata?: Json | null
          milestone_id?: string | null
          recurrence_pattern?: string | null
          roadmap_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_cash_flow_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "roadmap_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_cash_flow_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "transition_roadmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_milestones: {
        Row: {
          alert_days_before: number | null
          alert_sent: boolean | null
          assigned_team: string | null
          assigned_to: string | null
          completion_date: string | null
          cost_actual: number | null
          cost_estimate: number | null
          created_at: string | null
          dependencies: Json | null
          description: string | null
          due_date: string
          duration_days: number | null
          id: string
          is_critical: boolean | null
          metadata: Json | null
          phase_id: string
          priority: string | null
          progress_percentage: number | null
          start_date: string | null
          status: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          alert_days_before?: number | null
          alert_sent?: boolean | null
          assigned_team?: string | null
          assigned_to?: string | null
          completion_date?: string | null
          cost_actual?: number | null
          cost_estimate?: number | null
          created_at?: string | null
          dependencies?: Json | null
          description?: string | null
          due_date: string
          duration_days?: number | null
          id?: string
          is_critical?: boolean | null
          metadata?: Json | null
          phase_id: string
          priority?: string | null
          progress_percentage?: number | null
          start_date?: string | null
          status?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          alert_days_before?: number | null
          alert_sent?: boolean | null
          assigned_team?: string | null
          assigned_to?: string | null
          completion_date?: string | null
          cost_actual?: number | null
          cost_estimate?: number | null
          created_at?: string | null
          dependencies?: Json | null
          description?: string | null
          due_date?: string
          duration_days?: number | null
          id?: string
          is_critical?: boolean | null
          metadata?: Json | null
          phase_id?: string
          priority?: string | null
          progress_percentage?: number | null
          start_date?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_milestones_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "roadmap_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_phases: {
        Row: {
          budget_allocated: number | null
          budget_spent: number | null
          color: string | null
          completion_percentage: number | null
          created_at: string | null
          description: string | null
          end_date: string
          id: string
          metadata: Json | null
          name: string
          order_index: number
          roadmap_id: string
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          budget_allocated?: number | null
          budget_spent?: number | null
          color?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          metadata?: Json | null
          name: string
          order_index: number
          roadmap_id: string
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          budget_allocated?: number | null
          budget_spent?: number | null
          color?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          metadata?: Json | null
          name?: string
          order_index?: number
          roadmap_id?: string
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_phases_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "transition_roadmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      scenarios: {
        Row: {
          analysis_years: number
          created_at: string
          description: string | null
          discount_rate: number
          fleet_composition: Json
          id: string
          name: string
          project_id: string
          region: string
          updated_at: string
        }
        Insert: {
          analysis_years?: number
          created_at?: string
          description?: string | null
          discount_rate?: number
          fleet_composition?: Json
          id?: string
          name: string
          project_id: string
          region?: string
          updated_at?: string
        }
        Update: {
          analysis_years?: number
          created_at?: string
          description?: string | null
          discount_rate?: number
          fleet_composition?: Json
          id?: string
          name?: string
          project_id?: string
          region?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          fleet_size: number | null
          id: string
          status: string
          subscription_start_date: string | null
          tier: string
          trial_end_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fleet_size?: number | null
          id?: string
          status?: string
          subscription_start_date?: string | null
          tier?: string
          trial_end_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fleet_size?: number | null
          id?: string
          status?: string
          subscription_start_date?: string | null
          tier?: string
          trial_end_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subsidy_applications: {
        Row: {
          amount_awarded: number | null
          amount_requested: number | null
          created_at: string
          created_by: string | null
          decision_date: string | null
          id: string
          label: string | null
          notes: string | null
          program_id: string
          project_id: string
          received_date: string | null
          status: string
          submitted_date: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          amount_awarded?: number | null
          amount_requested?: number | null
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          program_id: string
          project_id: string
          received_date?: string | null
          status?: string
          submitted_date?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          amount_awarded?: number | null
          amount_requested?: number | null
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          program_id?: string
          project_id?: string
          received_date?: string | null
          status?: string
          submitted_date?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subsidy_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subsidy_applications_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      subsidy_program_events: {
        Row: {
          change_id: string
          change_kind: string
          id: string
          program_id: string
          source_url: string
          summary_en: string
          summary_fr: string
          validated_at: string
          validated_by: string | null
        }
        Insert: {
          change_id: string
          change_kind: string
          id?: string
          program_id: string
          source_url: string
          summary_en: string
          summary_fr: string
          validated_at?: string
          validated_by?: string | null
        }
        Update: {
          change_id?: string
          change_kind?: string
          id?: string
          program_id?: string
          source_url?: string
          summary_en?: string
          summary_fr?: string
          validated_at?: string
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subsidy_program_events_change_id_fkey"
            columns: ["change_id"]
            isOneToOne: true
            referencedRelation: "subsidy_watch_changes"
            referencedColumns: ["id"]
          },
        ]
      }
      subsidy_watch_changes: {
        Row: {
          archive_path: string | null
          change_kind: string
          dedupe_key: string
          detected_at: string
          excerpt_after: string
          excerpt_before: string
          facts_added: Json
          facts_removed: Json
          id: string
          program_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_url: string
          status: string
        }
        Insert: {
          archive_path?: string | null
          change_kind: string
          dedupe_key: string
          detected_at?: string
          excerpt_after?: string
          excerpt_before?: string
          facts_added?: Json
          facts_removed?: Json
          id?: string
          program_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url: string
          status?: string
        }
        Update: {
          archive_path?: string | null
          change_kind?: string
          dedupe_key?: string
          detected_at?: string
          excerpt_after?: string
          excerpt_before?: string
          facts_added?: Json
          facts_removed?: Json
          id?: string
          program_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string
          status?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          mentions: string[] | null
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          mentions?: string[] | null
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          mentions?: string[] | null
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string[] | null
          auto_key: string | null
          blocked_by: string | null
          budget_allocated: number | null
          budget_spent: number | null
          completed_date: string | null
          created_at: string | null
          created_by: string | null
          depends_on: string[] | null
          description: string | null
          due_date: string | null
          id: string
          is_over_budget: boolean | null
          is_overdue: boolean | null
          milestone_id: string | null
          order_index: number | null
          plan_year: number | null
          priority: string | null
          project_id: string
          start_date: string | null
          status: string
          subsidy_program: string | null
          title: string
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          assigned_to?: string[] | null
          auto_key?: string | null
          blocked_by?: string | null
          budget_allocated?: number | null
          budget_spent?: number | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          depends_on?: string[] | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_over_budget?: boolean | null
          is_overdue?: boolean | null
          milestone_id?: string | null
          order_index?: number | null
          plan_year?: number | null
          priority?: string | null
          project_id: string
          start_date?: string | null
          status?: string
          subsidy_program?: string | null
          title: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          assigned_to?: string[] | null
          auto_key?: string | null
          blocked_by?: string | null
          budget_allocated?: number | null
          budget_spent?: number | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          depends_on?: string[] | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_over_budget?: boolean | null
          is_overdue?: boolean | null
          milestone_id?: string | null
          order_index?: number | null
          plan_year?: number | null
          priority?: string | null
          project_id?: string
          start_date?: string | null
          status?: string
          subsidy_program?: string | null
          title?: string
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "roadmap_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tco_results: {
        Row: {
          applied_diesel_price: number | null
          applied_electricity_price: number | null
          applied_hydrogen_price: number | null
          baseline_tco: number | null
          by_vehicle_type: Json | null
          capex: number
          carbon_credits_value: number | null
          charging_stations: number | null
          charging_stations_cost: number | null
          co2_savings: number | null
          co2_savings_percent: number | null
          co2_total: number
          cold_weather_impact: number | null
          created_at: string
          downtime_cost: number | null
          grid_demand_cost: number | null
          h2_stations: number | null
          h2_stations_cost: number | null
          id: string
          is_current: boolean
          insurance_cost: number | null
          npv: number | null
          opex_total: number
          payback_period_years: number | null
          residual_value: number | null
          scenario_id: string
          tco_per_km: number | null
          tco_savings: number | null
          tco_total: number
          telematics_cost: number | null
          total_infrastructure_cost: number | null
          yearly_breakdown: Json | null
        }
        Insert: {
          applied_diesel_price?: number | null
          applied_electricity_price?: number | null
          applied_hydrogen_price?: number | null
          baseline_tco?: number | null
          by_vehicle_type?: Json | null
          capex: number
          carbon_credits_value?: number | null
          charging_stations?: number | null
          charging_stations_cost?: number | null
          co2_savings?: number | null
          co2_savings_percent?: number | null
          co2_total: number
          cold_weather_impact?: number | null
          created_at?: string
          downtime_cost?: number | null
          grid_demand_cost?: number | null
          h2_stations?: number | null
          h2_stations_cost?: number | null
          id?: string
          is_current?: boolean
          insurance_cost?: number | null
          npv?: number | null
          opex_total: number
          payback_period_years?: number | null
          residual_value?: number | null
          scenario_id: string
          tco_per_km?: number | null
          tco_savings?: number | null
          tco_total: number
          telematics_cost?: number | null
          total_infrastructure_cost?: number | null
          yearly_breakdown?: Json | null
        }
        Update: {
          applied_diesel_price?: number | null
          applied_electricity_price?: number | null
          applied_hydrogen_price?: number | null
          baseline_tco?: number | null
          by_vehicle_type?: Json | null
          capex?: number
          carbon_credits_value?: number | null
          charging_stations?: number | null
          charging_stations_cost?: number | null
          co2_savings?: number | null
          co2_savings_percent?: number | null
          co2_total?: number
          cold_weather_impact?: number | null
          created_at?: string
          downtime_cost?: number | null
          grid_demand_cost?: number | null
          h2_stations?: number | null
          h2_stations_cost?: number | null
          id?: string
          is_current?: boolean
          insurance_cost?: number | null
          npv?: number | null
          opex_total?: number
          payback_period_years?: number | null
          residual_value?: number | null
          scenario_id?: string
          tco_per_km?: number | null
          tco_savings?: number | null
          tco_total?: number
          telematics_cost?: number | null
          total_infrastructure_cost?: number | null
          yearly_breakdown?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tco_results_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      telematics_connections: {
        Row: {
          created_at: string
          database: string | null
          encrypted_credentials: string
          id: string
          last_sync_at: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          database?: string | null
          encrypted_credentials: string
          id?: string
          last_sync_at?: string | null
          provider: string
          status?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          database?: string | null
          encrypted_credentials?: string
          id?: string
          last_sync_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      telematics_groups: {
        Row: {
          avg_daily_km: number
          created_at: string
          id: string
          name: string
          recommended_technology: string | null
          user_id: string
          vehicle_count: number
        }
        Insert: {
          avg_daily_km?: number
          created_at?: string
          id?: string
          name: string
          recommended_technology?: string | null
          user_id: string
          vehicle_count?: number
        }
        Update: {
          avg_daily_km?: number
          created_at?: string
          id?: string
          name?: string
          recommended_technology?: string | null
          user_id?: string
          vehicle_count?: number
        }
        Relationships: []
      }
      telematics_vehicles: {
        Row: {
          annual_km: number
          connection_id: string
          created_at: string
          current_odometer: number | null
          daily_km: number | null
          external_id: string
          fuel_consumption: number
          group_id: string | null
          has_real_odometer: boolean | null
          id: string
          last_updated_at: string | null
          consumption_source: string
          make: string | null
          make_model: string
          model: string | null
          model_year: number | null
          route_type: string
          vin: string | null
          user_id: string
          vehicle_type: string
        }
        Insert: {
          annual_km?: number
          connection_id: string
          created_at?: string
          current_odometer?: number | null
          daily_km?: number | null
          external_id: string
          fuel_consumption?: number
          group_id?: string | null
          has_real_odometer?: boolean | null
          id?: string
          last_updated_at?: string | null
          make_model: string
          route_type?: string
          vin?: string | null
          user_id: string
          vehicle_type: string
        }
        Update: {
          annual_km?: number
          connection_id?: string
          created_at?: string
          current_odometer?: number | null
          daily_km?: number | null
          external_id?: string
          fuel_consumption?: number
          group_id?: string | null
          has_real_odometer?: boolean | null
          id?: string
          last_updated_at?: string | null
          consumption_source?: string
          make?: string | null
          make_model?: string
          model?: string | null
          model_year?: number | null
          route_type?: string
          vin?: string | null
          user_id?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "telematics_vehicles_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "telematics_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telematics_vehicles_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "telematics_connections_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telematics_vehicles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "telematics_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      transition_roadmaps: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          end_date: string
          generated_automatically: boolean | null
          id: string
          name: string
          project_id: string
          start_date: string
          status: string | null
          total_budget: number | null
          updated_at: string | null
          updated_by: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          end_date: string
          generated_automatically?: boolean | null
          id?: string
          name: string
          project_id: string
          start_date: string
          status?: string | null
          total_budget?: number | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          end_date?: string
          generated_automatically?: boolean | null
          id?: string
          name?: string
          project_id?: string
          start_date?: string
          status?: string | null
          total_budget?: number | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transition_roadmaps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorite_suppliers: {
        Row: {
          created_at: string
          id: string
          supplier_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          supplier_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "hydrogen_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorite_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "hydrogen_suppliers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_objectives: {
        Row: {
          created_at: string | null
          id: string
          target_co2_reduction: number | null
          target_year: number | null
          target_zev_percent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          target_co2_reduction?: number | null
          target_year?: number | null
          target_zev_percent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          target_co2_reduction?: number | null
          target_year?: number | null
          target_zev_percent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          delivered_at: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          delivered_at?: string | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id: string
        }
        Update: {
          delivered_at?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string | null
          events: string[]
          failure_count: number | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          name: string
          secret: string
          updated_at: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          events?: string[]
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name?: string
          secret: string
          updated_at?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          events?: string[]
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name?: string
          secret?: string
          updated_at?: string | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          annual_km: number | null
          category: string
          consumption_per_100km: number | null
          consumption_source: string
          created_at: string
          department: string | null
          depot: string | null
          garage_id: string | null
          gvwr_class: string | null
          fuel_type: string
          id: string
          in_service_date: string | null
          make: string | null
          max_daily_km: number | null
          model: string | null
          model_year: number | null
          notes: string | null
          organization_id: string
          status: string
          telematics_vehicle_id: string | null
          unit_number: string
          updated_at: string
          usage_profile: string | null
          vin: string | null
        }
        Insert: {
          annual_km?: number | null
          category: string
          consumption_per_100km?: number | null
          consumption_source?: string
          created_at?: string
          department?: string | null
          depot?: string | null
          garage_id?: string | null
          gvwr_class?: string | null
          fuel_type?: string
          id?: string
          in_service_date?: string | null
          make?: string | null
          max_daily_km?: number | null
          model?: string | null
          model_year?: number | null
          notes?: string | null
          organization_id: string
          status?: string
          telematics_vehicle_id?: string | null
          unit_number: string
          updated_at?: string
          usage_profile?: string | null
          vin?: string | null
        }
        Update: {
          annual_km?: number | null
          category?: string
          consumption_per_100km?: number | null
          consumption_source?: string
          created_at?: string
          department?: string | null
          depot?: string | null
          garage_id?: string | null
          gvwr_class?: string | null
          fuel_type?: string
          id?: string
          in_service_date?: string | null
          make?: string | null
          max_daily_km?: number | null
          model?: string | null
          model_year?: number | null
          notes?: string | null
          organization_id?: string
          status?: string
          telematics_vehicle_id?: string | null
          unit_number?: string
          updated_at?: string
          usage_profile?: string | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_garage_id_fkey"
            columns: ["garage_id"]
            isOneToOne: false
            referencedRelation: "garages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_telematics_vehicle_id_fkey"
            columns: ["telematics_vehicle_id"]
            isOneToOne: false
            referencedRelation: "telematics_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      hydrogen_suppliers_public: {
        Row: {
          certifications: string[] | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          delivery_time_weeks: number | null
          description_en: string | null
          description_fr: string | null
          employee_count: string | null
          established_year: number | null
          id: string | null
          is_verified: boolean | null
          languages: string[] | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          price_range_max: number | null
          price_range_min: number | null
          products_services: string[] | null
          province_state: string | null
          rating: number | null
          review_count: number | null
          service_regions: string[] | null
          supplier_type: Database["public"]["Enums"]["supplier_type"] | null
          updated_at: string | null
          vehicle_categories: string[] | null
          warranty_years: number | null
          website_url: string | null
        }
        Insert: {
          certifications?: string[] | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          delivery_time_weeks?: number | null
          description_en?: string | null
          description_fr?: string | null
          employee_count?: string | null
          established_year?: number | null
          id?: string | null
          is_verified?: boolean | null
          languages?: string[] | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          price_range_max?: number | null
          price_range_min?: number | null
          products_services?: string[] | null
          province_state?: string | null
          rating?: number | null
          review_count?: number | null
          service_regions?: string[] | null
          supplier_type?: Database["public"]["Enums"]["supplier_type"] | null
          updated_at?: string | null
          vehicle_categories?: string[] | null
          warranty_years?: number | null
          website_url?: string | null
        }
        Update: {
          certifications?: string[] | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          delivery_time_weeks?: number | null
          description_en?: string | null
          description_fr?: string | null
          employee_count?: string | null
          established_year?: number | null
          id?: string | null
          is_verified?: boolean | null
          languages?: string[] | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          price_range_max?: number | null
          price_range_min?: number | null
          products_services?: string[] | null
          province_state?: string | null
          rating?: number | null
          review_count?: number | null
          service_regions?: string[] | null
          supplier_type?: Database["public"]["Enums"]["supplier_type"] | null
          updated_at?: string | null
          vehicle_categories?: string[] | null
          warranty_years?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      profiles_display: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string | null
          full_name: string | null
          function_title: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          full_name?: string | null
          function_title?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          full_name?: string | null
          function_title?: string | null
          id?: string | null
        }
        Relationships: []
      }
      telematics_connections_safe: {
        Row: {
          created_at: string | null
          database: string | null
          id: string | null
          last_sync_at: string | null
          provider: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          database?: string | null
          id?: string | null
          last_sync_at?: string | null
          provider?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          database?: string | null
          id?: string | null
          last_sync_at?: string | null
          provider?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ai_usage_summary: {
        Args: { _org: string }
        Returns: {
          month_cache_read_tokens: number
          month_input_tokens: number
          month_output_tokens: number
          month_requests: number
          today_requests: number
        }[]
      }
      accept_organization_invitation: {
        Args: { _invitation: string }
        Returns: string
      }
      list_organization_members_detail: {
        Args: { _org: string }
        Returns: {
          member_id: string
          user_id: string
          role: Database["public"]["Enums"]["org_role"]
          created_at: string
          email: string | null
          full_name: string | null
        }[]
      }
      reject_subsidy_change: {
        Args: { _change: string; _note?: string | null }
        Returns: undefined
      }
      sync_plan_alerts: {
        Args: { _alerts: Json; _project: string }
        Returns: boolean
      }
      dismiss_plan_alert: {
        Args: { _alert: string }
        Returns: undefined
      }
      validate_subsidy_change: {
        Args: { _change: string; _note?: string | null; _summary_en: string; _summary_fr: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_owner: { Args: { project_uuid: string }; Returns: boolean }
      get_project_org_type: { Args: { _project: string }; Returns: string | null }
    }
    Enums: {
      app_role: "admin" | "user"
      org_role: "admin" | "member" | "reader"
      confidence_level: "very_low" | "low" | "medium" | "high" | "very_high"
      incentive_level: "federal" | "provincial" | "municipal"
      incentive_status: "active" | "expired" | "coming_soon"
      project_role: "owner" | "editor" | "viewer"
      reference_category:
        | "fuel_prices"
        | "electricity"
        | "hydrogen"
        | "vehicles"
        | "co2_factors"
      supplier_type:
        | "vehicle_manufacturer"
        | "infrastructure"
        | "fuel_provider"
        | "maintenance"
        | "charging_infrastructure"
        | "biomethane"
        | "diesel_biodiesel"
        | "retrofit_services"
        | "other"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      confidence_level: ["very_low", "low", "medium", "high", "very_high"],
      incentive_level: ["federal", "provincial", "municipal"],
      incentive_status: ["active", "expired", "coming_soon"],
      project_role: ["owner", "editor", "viewer"],
      reference_category: [
        "fuel_prices",
        "electricity",
        "hydrogen",
        "vehicles",
        "co2_factors",
      ],
      supplier_type: [
        "vehicle_manufacturer",
        "infrastructure",
        "fuel_provider",
        "maintenance",
        "charging_infrastructure",
        "biomethane",
        "diesel_biodiesel",
        "retrofit_services",
        "other",
      ],
    },
  },
} as const
