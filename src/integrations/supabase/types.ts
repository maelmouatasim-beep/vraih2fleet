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
      profiles: {
        Row: {
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
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
          priority: string | null
          project_id: string
          start_date: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string[] | null
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
          priority?: string | null
          project_id: string
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string[] | null
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
          priority?: string | null
          project_id?: string
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string | null
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
          make_model: string
          route_type: string
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
          make_model?: string
          route_type?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_owner: { Args: { project_uuid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
