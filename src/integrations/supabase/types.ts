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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_ledger: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          created_by: string | null
          direction: string
          id: string
          is_reversal: boolean | null
          ledger_date: string
          note: string | null
          ref_id: string | null
          ref_type: string
          reversed_entry_id: string | null
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          created_by?: string | null
          direction: string
          id?: string
          is_reversal?: boolean | null
          ledger_date?: string
          note?: string | null
          ref_id?: string | null
          ref_type: string
          reversed_entry_id?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          is_reversal?: boolean | null
          ledger_date?: string
          note?: string | null
          ref_id?: string | null
          ref_type?: string
          reversed_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_ledger_reversed_entry_id_fkey"
            columns: ["reversed_entry_id"]
            isOneToOne: false
            referencedRelation: "account_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_number: string | null
          balance: number | null
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          type: string | null
        }
        Insert: {
          account_number?: string | null
          balance?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          type?: string | null
        }
        Update: {
          account_number?: string | null
          balance?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string | null
        }
        Relationships: []
      }
      ad_campaigns: {
        Row: {
          amount_spent: number | null
          budget: number | null
          cac: number | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number | null
          created_at: string | null
          end_date: string | null
          id: string
          impressions: number | null
          orders_attributed: number | null
          platform: string | null
          revenue_attributed: number | null
          roas: number | null
          start_date: string | null
          status: string | null
        }
        Insert: {
          amount_spent?: number | null
          budget?: number | null
          cac?: number | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          impressions?: number | null
          orders_attributed?: number | null
          platform?: string | null
          revenue_attributed?: number | null
          roas?: number | null
          start_date?: string | null
          status?: string | null
        }
        Update: {
          amount_spent?: number | null
          budget?: number | null
          cac?: number | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          impressions?: number | null
          orders_attributed?: number | null
          platform?: string | null
          revenue_attributed?: number | null
          roas?: number | null
          start_date?: string | null
          status?: string | null
        }
        Relationships: []
      }
      address_corrections: {
        Row: {
          corrected_area: string | null
          corrected_city: string | null
          corrected_zone: string | null
          created_at: string
          detected_area: string | null
          detected_city: string | null
          detected_zone: string | null
          frequency: number
          id: string
          raw_address: string
          raw_area_text: string | null
        }
        Insert: {
          corrected_area?: string | null
          corrected_city?: string | null
          corrected_zone?: string | null
          created_at?: string
          detected_area?: string | null
          detected_city?: string | null
          detected_zone?: string | null
          frequency?: number
          id?: string
          raw_address: string
          raw_area_text?: string | null
        }
        Update: {
          corrected_area?: string | null
          corrected_city?: string | null
          corrected_zone?: string | null
          created_at?: string
          detected_area?: string | null
          detected_city?: string | null
          detected_zone?: string | null
          frequency?: number
          id?: string
          raw_address?: string
          raw_area_text?: string | null
        }
        Relationships: []
      }
      agents: {
        Row: {
          bank_account: string | null
          bank_name: string | null
          bkash_number: string | null
          contact_person: string | null
          created_at: string | null
          id: string
          nagad_number: string | null
          name: string
          notes: string | null
          phone: string | null
          profile_image_url: string | null
          rating: number | null
          total_amount: number | null
          total_orders: number | null
          whatsapp: string | null
        }
        Insert: {
          bank_account?: string | null
          bank_name?: string | null
          bkash_number?: string | null
          contact_person?: string | null
          created_at?: string | null
          id?: string
          nagad_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          profile_image_url?: string | null
          rating?: number | null
          total_amount?: number | null
          total_orders?: number | null
          whatsapp?: string | null
        }
        Update: {
          bank_account?: string | null
          bank_name?: string | null
          bkash_number?: string | null
          contact_person?: string | null
          created_at?: string | null
          id?: string
          nagad_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          profile_image_url?: string | null
          rating?: number | null
          total_amount?: number | null
          total_orders?: number | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          date: string | null
          id: string
          notes: string | null
          staff_id: string | null
          status: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          date?: string | null
          id?: string
          notes?: string | null
          staff_id?: string | null
          status?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          date?: string | null
          id?: string
          notes?: string | null
          staff_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after_json: Json | null
          before_json: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cod_settlement_lines: {
        Row: {
          consignment_id: string | null
          created_at: string
          expected_amount: number | null
          id: string
          matched_status: string | null
          mismatch_reason: string | null
          order_id: string | null
          paid_amount: number
          settlement_id: string
        }
        Insert: {
          consignment_id?: string | null
          created_at?: string
          expected_amount?: number | null
          id?: string
          matched_status?: string | null
          mismatch_reason?: string | null
          order_id?: string | null
          paid_amount?: number
          settlement_id: string
        }
        Update: {
          consignment_id?: string | null
          created_at?: string
          expected_amount?: number | null
          id?: string
          matched_status?: string | null
          mismatch_reason?: string | null
          order_id?: string | null
          paid_amount?: number
          settlement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cod_settlement_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cod_settlement_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cod_settlement_lines_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "cod_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      cod_settlements: {
        Row: {
          courier_name: string
          created_at: string
          created_by: string | null
          id: string
          matched_count: number | null
          mismatch_count: number | null
          settlement_date: string
          settlement_ref: string | null
          statement_file_url: string | null
          status: string | null
          total_orders: number | null
          total_paid_amount: number
          unmatched_count: number | null
        }
        Insert: {
          courier_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          matched_count?: number | null
          mismatch_count?: number | null
          settlement_date: string
          settlement_ref?: string | null
          statement_file_url?: string | null
          status?: string | null
          total_orders?: number | null
          total_paid_amount?: number
          unmatched_count?: number | null
        }
        Update: {
          courier_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          matched_count?: number | null
          mismatch_count?: number | null
          settlement_date?: string
          settlement_ref?: string | null
          statement_file_url?: string | null
          status?: string | null
          total_orders?: number | null
          total_paid_amount?: number
          unmatched_count?: number | null
        }
        Relationships: []
      }
      courier_history: {
        Row: {
          courier_name: string
          created_at: string
          delivered_at: string | null
          id: string
          order_id: string | null
          phone: string
          status: string | null
          tracking_id: string | null
        }
        Insert: {
          courier_name: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id?: string | null
          phone: string
          status?: string | null
          tracking_id?: string | null
        }
        Update: {
          courier_name?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id?: string | null
          phone?: string
          status?: string | null
          tracking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_rate_cards: {
        Row: {
          base_charge: number
          cod_fee_percent: number | null
          courier_name: string
          created_at: string | null
          extra_charge: number | null
          id: string
          is_active: boolean | null
          service_area: string
          weight_slab_max: number | null
          weight_slab_min: number | null
        }
        Insert: {
          base_charge?: number
          cod_fee_percent?: number | null
          courier_name: string
          created_at?: string | null
          extra_charge?: number | null
          id?: string
          is_active?: boolean | null
          service_area: string
          weight_slab_max?: number | null
          weight_slab_min?: number | null
        }
        Update: {
          base_charge?: number
          cod_fee_percent?: number | null
          courier_name?: string
          created_at?: string | null
          extra_charge?: number | null
          id?: string
          is_active?: boolean | null
          service_area?: string
          weight_slab_max?: number | null
          weight_slab_min?: number | null
        }
        Relationships: []
      }
      customer_followups: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_phone: string
          done_at: string | null
          due_at: string
          id: string
          is_done: boolean | null
          note: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_phone: string
          done_at?: string | null
          due_at: string
          id?: string
          is_done?: boolean | null
          note?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_phone?: string
          done_at?: string | null
          due_at?: string
          id?: string
          is_done?: boolean | null
          note?: string | null
        }
        Relationships: []
      }
      customer_qc_cache: {
        Row: {
          cancelled_orders: number | null
          created_at: string | null
          id: string
          last_fetched_at: string | null
          phone: string
          raw_data: Json | null
          returned_orders: number | null
          success_rate: number | null
          successful_orders: number | null
          total_orders: number | null
        }
        Insert: {
          cancelled_orders?: number | null
          created_at?: string | null
          id?: string
          last_fetched_at?: string | null
          phone: string
          raw_data?: Json | null
          returned_orders?: number | null
          success_rate?: number | null
          successful_orders?: number | null
          total_orders?: number | null
        }
        Update: {
          cancelled_orders?: number | null
          created_at?: string | null
          id?: string
          last_fetched_at?: string | null
          phone?: string
          raw_data?: Json | null
          returned_orders?: number | null
          success_rate?: number | null
          successful_orders?: number | null
          total_orders?: number | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          district: string | null
          email: string | null
          full_name: string
          id: string
          import_batch_id: string | null
          imported_at: string | null
          last_order_date: string | null
          manual_segment: string | null
          notes: string | null
          phone: string
          phone2: string | null
          segment: string | null
          source: string | null
          tags: string[] | null
          thana: string | null
          total_orders: number | null
          total_spent: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          district?: string | null
          email?: string | null
          full_name: string
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          last_order_date?: string | null
          manual_segment?: string | null
          notes?: string | null
          phone: string
          phone2?: string | null
          segment?: string | null
          source?: string | null
          tags?: string[] | null
          thana?: string | null
          total_orders?: number | null
          total_spent?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          district?: string | null
          email?: string | null
          full_name?: string
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          last_order_date?: string | null
          manual_segment?: string | null
          notes?: string | null
          phone?: string
          phone2?: string | null
          segment?: string | null
          source?: string | null
          tags?: string[] | null
          thana?: string | null
          total_orders?: number | null
          total_spent?: number | null
        }
        Relationships: []
      }
      damage_log: {
        Row: {
          condition: string | null
          created_at: string | null
          description: string | null
          id: string
          order_id: string | null
          photo_url: string | null
          product_id: string | null
          quantity: number | null
        }
        Insert: {
          condition?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          photo_url?: string | null
          product_id?: string | null
          quantity?: number | null
        }
        Update: {
          condition?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          photo_url?: string | null
          product_id?: string | null
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "damage_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          head_employee_id: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          head_employee_id?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          head_employee_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_head_employee_id_fkey"
            columns: ["head_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_name: string | null
          basic_salary: number | null
          bkash_number: string | null
          blood_group: string | null
          contract_end_date: string | null
          created_at: string
          date_of_birth: string | null
          department_id: string | null
          designation: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_id: string
          employment_type: string | null
          full_name: string
          gender: string | null
          hrm_role_id: string | null
          id: string
          join_date: string | null
          nagad_number: string | null
          nid_document_url: string | null
          nid_number: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          probation_end_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          bkash_number?: string | null
          blood_group?: string | null
          contract_end_date?: string | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id: string
          employment_type?: string | null
          full_name: string
          gender?: string | null
          hrm_role_id?: string | null
          id?: string
          join_date?: string | null
          nagad_number?: string | null
          nid_document_url?: string | null
          nid_number?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          probation_end_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          bkash_number?: string | null
          blood_group?: string | null
          contract_end_date?: string | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id?: string
          employment_type?: string | null
          full_name?: string
          gender?: string | null
          hrm_role_id?: string | null
          id?: string
          join_date?: string | null
          nagad_number?: string | null
          nid_document_url?: string | null
          nid_number?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          probation_end_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_hrm_role_id_fkey"
            columns: ["hrm_role_id"]
            isOneToOne: false
            referencedRelation: "hrm_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      hrm_attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          is_late: boolean | null
          notes: string | null
          overtime_hours: number | null
          status: string | null
          working_hours: number | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          is_late?: boolean | null
          notes?: string | null
          overtime_hours?: number | null
          status?: string | null
          working_hours?: number | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          is_late?: boolean | null
          notes?: string | null
          overtime_hours?: number | null
          status?: string | null
          working_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hrm_attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hrm_leave_balances: {
        Row: {
          casual_leave_total: number | null
          casual_leave_used: number | null
          created_at: string
          employee_id: string
          id: string
          paid_leave_total: number | null
          paid_leave_used: number | null
          sick_leave_total: number | null
          sick_leave_used: number | null
          unpaid_leave_used: number | null
          year: number
        }
        Insert: {
          casual_leave_total?: number | null
          casual_leave_used?: number | null
          created_at?: string
          employee_id: string
          id?: string
          paid_leave_total?: number | null
          paid_leave_used?: number | null
          sick_leave_total?: number | null
          sick_leave_used?: number | null
          unpaid_leave_used?: number | null
          year?: number
        }
        Update: {
          casual_leave_total?: number | null
          casual_leave_used?: number | null
          created_at?: string
          employee_id?: string
          id?: string
          paid_leave_total?: number | null
          paid_leave_used?: number | null
          sick_leave_total?: number | null
          sick_leave_used?: number | null
          unpaid_leave_used?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hrm_leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hrm_leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          start_date: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days?: number
          employee_id: string
          end_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          start_date: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hrm_leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrm_leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hrm_roles: {
        Row: {
          created_at: string
          id: string
          level: string
          name: string
          permissions: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          name: string
          permissions?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          name?: string
          permissions?: Json | null
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string
          duplicate_action: string
          failed_count: number
          file_name: string
          id: string
          imported_count: number
          skipped_count: number
          total_rows: number
        }
        Insert: {
          created_at?: string
          duplicate_action?: string
          failed_count?: number
          file_name: string
          id?: string
          imported_count?: number
          skipped_count?: number
          total_rows?: number
        }
        Update: {
          created_at?: string
          duplicate_action?: string
          failed_count?: number
          file_name?: string
          id?: string
          imported_count?: number
          skipped_count?: number
          total_rows?: number
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string | null
          qty_in: number | null
          qty_out: number | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id?: string | null
          qty_in?: number | null
          qty_out?: number | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string | null
          qty_in?: number | null
          qty_out?: number | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      leads: {
        Row: {
          converted_at: string | null
          created_at: string | null
          id: string
          is_converted: boolean | null
          name: string
          note: string | null
          phone: string
          source: string | null
          stage: string | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          id?: string
          is_converted?: boolean | null
          name: string
          note?: string | null
          phone: string
          source?: string | null
          stage?: string | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          id?: string
          is_converted?: boolean | null
          name?: string
          note?: string | null
          phone?: string
          source?: string | null
          stage?: string | null
        }
        Relationships: []
      }
      leaves: {
        Row: {
          created_at: string | null
          days: number | null
          end_date: string | null
          id: string
          leave_type: string | null
          reason: string | null
          staff_id: string | null
          start_date: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          days?: number | null
          end_date?: string | null
          id?: string
          leave_type?: string | null
          reason?: string | null
          staff_id?: string | null
          start_date?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          days?: number | null
          end_date?: string | null
          id?: string
          leave_type?: string | null
          reason?: string | null
          staff_id?: string | null
          start_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaves_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          related_id: string | null
          related_type: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          related_id?: string | null
          related_type?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          related_id?: string | null
          related_type?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: []
      }
      order_activity_log: {
        Row: {
          action: string
          created_at: string
          details: string | null
          done_by: string | null
          id: string
          new_status: string | null
          old_status: string | null
          order_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          done_by?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          done_by?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_activity_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_activity_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_costs: {
        Row: {
          cod_fee: number | null
          courier_actual_charge: number | null
          courier_expected_charge: number | null
          created_at: string | null
          delivery_subsidy: number | null
          id: string
          order_id: string
          packaging_cost: number | null
          payment_gateway_fee: number | null
          return_handling_cost: number | null
          updated_at: string | null
        }
        Insert: {
          cod_fee?: number | null
          courier_actual_charge?: number | null
          courier_expected_charge?: number | null
          created_at?: string | null
          delivery_subsidy?: number | null
          id?: string
          order_id: string
          packaging_cost?: number | null
          payment_gateway_fee?: number | null
          return_handling_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          cod_fee?: number | null
          courier_actual_charge?: number | null
          courier_expected_charge?: number | null
          created_at?: string | null
          delivery_subsidy?: number | null
          id?: string
          order_id?: string
          packaging_cost?: number | null
          payment_gateway_fee?: number | null
          return_handling_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_costs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "order_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_costs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cogs_total: number | null
          discount: number | null
          id: string
          order_id: string | null
          product_id: string | null
          product_name_fallback: string | null
          profit: number | null
          quantity: number
          total_price: number
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          cogs_total?: number | null
          discount?: number | null
          id?: string
          order_id?: string | null
          product_id?: string | null
          product_name_fallback?: string | null
          profit?: number | null
          quantity: number
          total_price: number
          unit_cost?: number | null
          unit_price: number
        }
        Update: {
          cogs_total?: number | null
          discount?: number | null
          id?: string
          order_id?: string | null
          product_id?: string | null
          product_name_fallback?: string | null
          profit?: number | null
          quantity?: number
          total_price?: number
          unit_cost?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      orders: {
        Row: {
          address_parse_log: Json | null
          assigned_to: string | null
          cancelled_at: string | null
          channel: string
          cod_amount: number | null
          cost_of_goods: number | null
          courier_charge: number | null
          courier_status: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_charge: number | null
          delivery_district: string | null
          delivery_thana: string | null
          discount: number | null
          gross_profit: number | null
          id: string
          needs_address_review: boolean
          notes: string | null
          order_date: string | null
          order_number: string
          parsed_address_confidence: number | null
          pathao_consignment_id: string | null
          pathao_tracking_code: string | null
          payment_method: string | null
          payment_status: string | null
          shopify_order_id: string | null
          shopify_order_number: string | null
          status: string | null
          subtotal: number | null
          tags: string[] | null
          total_amount: number | null
          updated_at: string | null
          web_order_status: string | null
        }
        Insert: {
          address_parse_log?: Json | null
          assigned_to?: string | null
          cancelled_at?: string | null
          channel: string
          cod_amount?: number | null
          cost_of_goods?: number | null
          courier_charge?: number | null
          courier_status?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_charge?: number | null
          delivery_district?: string | null
          delivery_thana?: string | null
          discount?: number | null
          gross_profit?: number | null
          id?: string
          needs_address_review?: boolean
          notes?: string | null
          order_date?: string | null
          order_number: string
          parsed_address_confidence?: number | null
          pathao_consignment_id?: string | null
          pathao_tracking_code?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          status?: string | null
          subtotal?: number | null
          tags?: string[] | null
          total_amount?: number | null
          updated_at?: string | null
          web_order_status?: string | null
        }
        Update: {
          address_parse_log?: Json | null
          assigned_to?: string | null
          cancelled_at?: string | null
          channel?: string
          cod_amount?: number | null
          cost_of_goods?: number | null
          courier_charge?: number | null
          courier_status?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_charge?: number | null
          delivery_district?: string | null
          delivery_thana?: string | null
          discount?: number | null
          gross_profit?: number | null
          id?: string
          needs_address_review?: boolean
          notes?: string | null
          order_date?: string | null
          order_number?: string
          parsed_address_confidence?: number | null
          pathao_consignment_id?: string | null
          pathao_tracking_code?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          status?: string | null
          subtotal?: number | null
          tags?: string[] | null
          total_amount?: number | null
          updated_at?: string | null
          web_order_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          paid_amount: number
          party_name: string
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          paid_amount?: number
          party_name: string
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          paid_amount?: number
          party_name?: string
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      payroll: {
        Row: {
          basic_salary: number | null
          bonus: number | null
          commission: number | null
          created_at: string | null
          deductions: number | null
          id: string
          month: number | null
          net_salary: number | null
          payment_date: string | null
          payment_method: string | null
          staff_id: string | null
          status: string | null
          year: number | null
        }
        Insert: {
          basic_salary?: number | null
          bonus?: number | null
          commission?: number | null
          created_at?: string | null
          deductions?: number | null
          id?: string
          month?: number | null
          net_salary?: number | null
          payment_date?: string | null
          payment_method?: string | null
          staff_id?: string | null
          status?: string | null
          year?: number | null
        }
        Update: {
          basic_salary?: number | null
          bonus?: number | null
          commission?: number | null
          created_at?: string | null
          deductions?: number | null
          id?: string
          month?: number | null
          net_salary?: number | null
          payment_date?: string | null
          payment_method?: string | null
          staff_id?: string | null
          status?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      po_additional_costs: {
        Row: {
          amount_bdt: number
          created_at: string | null
          id: string
          label: string
          po_id: string | null
        }
        Insert: {
          amount_bdt?: number
          created_at?: string | null
          id?: string
          label: string
          po_id?: string | null
        }
        Update: {
          amount_bdt?: number
          created_at?: string | null
          id?: string
          label?: string
          po_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_additional_costs_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          note: string | null
          payment_date: string
          payment_method: string | null
          payment_type: string | null
          po_id: string | null
          transaction_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          note?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_type?: string | null
          po_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          note?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_type?: string | null
          po_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_payments_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_timeline: {
        Row: {
          completed_at: string | null
          created_at: string | null
          done_by: string | null
          id: string
          note: string | null
          po_id: string | null
          stage: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          done_by?: string | null
          id?: string
          note?: string | null
          po_id?: string | null
          stage: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          done_by?: string | null
          id?: string
          note?: string | null
          po_id?: string | null
          stage?: number
        }
        Relationships: [
          {
            foreignKeyName: "po_timeline_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_quantity: number | null
          avg_cost: number | null
          category_id: string | null
          cbm: number | null
          china_price_cny: number | null
          china_price_usd: number | null
          cost_method: string | null
          created_at: string | null
          customs_duty_per_unit: number | null
          description: string | null
          discounted_price: number | null
          id: string
          image_url: string | null
          landed_cost_bdt: number | null
          name: string
          other_cost_per_unit: number | null
          profit_margin_percent: number | null
          profit_per_unit: number | null
          reorder_point: number | null
          reorder_quantity: number | null
          reserved_quantity: number | null
          selling_price: number | null
          shipping_cost_per_unit: number | null
          shopify_product_id: string | null
          shopify_variant_id: string | null
          sku: string
          status: string | null
          stock_quantity: number | null
          supplier_id: string | null
          unit: string | null
          updated_at: string | null
          weight_kg: number | null
        }
        Insert: {
          available_quantity?: number | null
          avg_cost?: number | null
          category_id?: string | null
          cbm?: number | null
          china_price_cny?: number | null
          china_price_usd?: number | null
          cost_method?: string | null
          created_at?: string | null
          customs_duty_per_unit?: number | null
          description?: string | null
          discounted_price?: number | null
          id?: string
          image_url?: string | null
          landed_cost_bdt?: number | null
          name: string
          other_cost_per_unit?: number | null
          profit_margin_percent?: number | null
          profit_per_unit?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          reserved_quantity?: number | null
          selling_price?: number | null
          shipping_cost_per_unit?: number | null
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          sku: string
          status?: string | null
          stock_quantity?: number | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          available_quantity?: number | null
          avg_cost?: number | null
          category_id?: string | null
          cbm?: number | null
          china_price_cny?: number | null
          china_price_usd?: number | null
          cost_method?: string | null
          created_at?: string | null
          customs_duty_per_unit?: number | null
          description?: string | null
          discounted_price?: number | null
          id?: string
          image_url?: string | null
          landed_cost_bdt?: number | null
          name?: string
          other_cost_per_unit?: number | null
          profit_margin_percent?: number | null
          profit_per_unit?: number | null
          reorder_point?: number | null
          reorder_quantity?: number | null
          reserved_quantity?: number | null
          selling_price?: number | null
          shipping_cost_per_unit?: number | null
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          sku?: string
          status?: string | null
          stock_quantity?: number | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          condition: string | null
          defective_quantity: number | null
          id: string
          image_url: string | null
          notes: string | null
          product_id: string | null
          product_name: string | null
          purchase_order_id: string | null
          quantity: number
          received_quantity: number | null
          total_price_usd: number | null
          unit: string | null
          unit_price_cny: number | null
          unit_price_usd: number | null
          variant_note: string | null
        }
        Insert: {
          condition?: string | null
          defective_quantity?: number | null
          id?: string
          image_url?: string | null
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          purchase_order_id?: string | null
          quantity: number
          received_quantity?: number | null
          total_price_usd?: number | null
          unit?: string | null
          unit_price_cny?: number | null
          unit_price_usd?: number | null
          variant_note?: string | null
        }
        Update: {
          condition?: string | null
          defective_quantity?: number | null
          id?: string
          image_url?: string | null
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          purchase_order_id?: string | null
          quantity?: number
          received_quantity?: number | null
          total_price_usd?: number | null
          unit?: string | null
          unit_price_cny?: number | null
          unit_price_usd?: number | null
          variant_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_arrival_date: string | null
          actual_shipment_date: string | null
          additional_costs_bdt: number | null
          advance_paid_bdt: number | null
          agent_id: string | null
          bl_number: string | null
          c_and_f_charge_bdt: number | null
          container_number: string | null
          cost_per_unit_bdt: number | null
          created_at: string | null
          created_by: string | null
          customs_duty_bdt: number | null
          exchange_rate_cny_bdt: number | null
          exchange_rate_usd_bdt: number | null
          expected_arrival_date: string | null
          expected_production_end: string | null
          expected_shipment_date: string | null
          freight_cost_bdt: number | null
          freight_cost_usd: number | null
          freight_forwarder: string | null
          grand_total_bdt: number | null
          id: string
          import_type: string | null
          local_transport_bdt: number | null
          notes: string | null
          order_date: string
          other_charges_bdt: number | null
          payment_status: string | null
          po_number: string
          port_of_discharge: string | null
          port_of_entry: string | null
          port_of_loading: string | null
          remaining_payment_bdt: number | null
          shipping_agent: string | null
          shipping_method: string | null
          status: string | null
          supplier_id: string | null
          tags: string[] | null
          total_landed_cost_bdt: number | null
          total_product_cost_cny: number | null
          total_product_cost_usd: number | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          actual_arrival_date?: string | null
          actual_shipment_date?: string | null
          additional_costs_bdt?: number | null
          advance_paid_bdt?: number | null
          agent_id?: string | null
          bl_number?: string | null
          c_and_f_charge_bdt?: number | null
          container_number?: string | null
          cost_per_unit_bdt?: number | null
          created_at?: string | null
          created_by?: string | null
          customs_duty_bdt?: number | null
          exchange_rate_cny_bdt?: number | null
          exchange_rate_usd_bdt?: number | null
          expected_arrival_date?: string | null
          expected_production_end?: string | null
          expected_shipment_date?: string | null
          freight_cost_bdt?: number | null
          freight_cost_usd?: number | null
          freight_forwarder?: string | null
          grand_total_bdt?: number | null
          id?: string
          import_type?: string | null
          local_transport_bdt?: number | null
          notes?: string | null
          order_date: string
          other_charges_bdt?: number | null
          payment_status?: string | null
          po_number: string
          port_of_discharge?: string | null
          port_of_entry?: string | null
          port_of_loading?: string | null
          remaining_payment_bdt?: number | null
          shipping_agent?: string | null
          shipping_method?: string | null
          status?: string | null
          supplier_id?: string | null
          tags?: string[] | null
          total_landed_cost_bdt?: number | null
          total_product_cost_cny?: number | null
          total_product_cost_usd?: number | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_arrival_date?: string | null
          actual_shipment_date?: string | null
          additional_costs_bdt?: number | null
          advance_paid_bdt?: number | null
          agent_id?: string | null
          bl_number?: string | null
          c_and_f_charge_bdt?: number | null
          container_number?: string | null
          cost_per_unit_bdt?: number | null
          created_at?: string | null
          created_by?: string | null
          customs_duty_bdt?: number | null
          exchange_rate_cny_bdt?: number | null
          exchange_rate_usd_bdt?: number | null
          expected_arrival_date?: string | null
          expected_production_end?: string | null
          expected_shipment_date?: string | null
          freight_cost_bdt?: number | null
          freight_cost_usd?: number | null
          freight_forwarder?: string | null
          grand_total_bdt?: number | null
          id?: string
          import_type?: string | null
          local_transport_bdt?: number | null
          notes?: string | null
          order_date?: string
          other_charges_bdt?: number | null
          payment_status?: string | null
          po_number?: string
          port_of_discharge?: string | null
          port_of_entry?: string | null
          port_of_loading?: string | null
          remaining_payment_bdt?: number | null
          shipping_agent?: string | null
          shipping_method?: string | null
          status?: string | null
          supplier_id?: string | null
          tags?: string[] | null
          total_landed_cost_bdt?: number | null
          total_product_cost_cny?: number | null
          total_product_cost_usd?: number | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          expected_date: string | null
          id: string
          reference: string | null
          source: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          description?: string | null
          expected_date?: string | null
          id?: string
          reference?: string | null
          source?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          expected_date?: string | null
          id?: string
          reference?: string | null
          source?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      returns: {
        Row: {
          created_at: string | null
          id: string
          items_returned: Json | null
          notes: string | null
          order_id: string | null
          reason: string | null
          refund_amount: number | null
          refund_method: string | null
          return_date: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          items_returned?: Json | null
          notes?: string | null
          order_id?: string | null
          reason?: string | null
          refund_amount?: number | null
          refund_method?: string | null
          return_date?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          items_returned?: Json | null
          notes?: string | null
          order_id?: string | null
          reason?: string | null
          refund_amount?: number | null
          refund_method?: string | null
          return_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          id: string
          name: string
          permissions: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          permissions?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          permissions?: Json | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      shipments: {
        Row: {
          actual_charge: number | null
          cod_expected_amount: number | null
          consignment_id: string | null
          courier_id: string | null
          courier_name: string | null
          courier_status: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          expected_charge: number | null
          id: string
          last_tracking_at: string | null
          order_id: string
          service_area: string | null
          shipped_at: string | null
          tracking_code: string | null
          updated_at: string | null
          weight_kg: number | null
        }
        Insert: {
          actual_charge?: number | null
          cod_expected_amount?: number | null
          consignment_id?: string | null
          courier_id?: string | null
          courier_name?: string | null
          courier_status?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          expected_charge?: number | null
          id?: string
          last_tracking_at?: string | null
          order_id: string
          service_area?: string | null
          shipped_at?: string | null
          tracking_code?: string | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          actual_charge?: number | null
          cod_expected_amount?: number | null
          consignment_id?: string | null
          courier_id?: string | null
          courier_name?: string | null
          courier_status?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          expected_charge?: number | null
          id?: string
          last_tracking_at?: string | null
          order_id?: string
          service_area?: string | null
          shipped_at?: string | null
          tracking_code?: string | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          join_date: string | null
          phone: string | null
          role_id: string | null
          salary: number | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          join_date?: string | null
          phone?: string | null
          role_id?: string | null
          salary?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          join_date?: string | null
          phone?: string | null
          role_id?: string | null
          salary?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_metrics: {
        Row: {
          id: string
          last_updated: string
          module_name: string
          total_gb: number
          used_gb: number
        }
        Insert: {
          id?: string
          last_updated?: string
          module_name: string
          total_gb?: number
          used_gb?: number
        }
        Update: {
          id?: string
          last_updated?: string
          module_name?: string
          total_gb?: number
          used_gb?: number
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          alipay_id: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          company_name: string | null
          contact_person: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          preferred_payment: string | null
          rating: number | null
          status: string | null
          swift_code: string | null
          total_amount: number | null
          total_orders: number | null
          usdt_network: string | null
          usdt_wallet: string | null
          wechat_id: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          alipay_id?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          preferred_payment?: string | null
          rating?: number | null
          status?: string | null
          swift_code?: string | null
          total_amount?: number | null
          total_orders?: number | null
          usdt_network?: string | null
          usdt_wallet?: string | null
          wechat_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          alipay_id?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          preferred_payment?: string | null
          rating?: number | null
          status?: string | null
          swift_code?: string | null
          total_amount?: number | null
          total_orders?: number | null
          usdt_network?: string | null
          usdt_wallet?: string | null
          wechat_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      system_issues: {
        Row: {
          description: string | null
          id: string
          module: string | null
          reported_at: string
          reported_by: string | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          description?: string | null
          id?: string
          module?: string | null
          reported_at?: string
          reported_by?: string | null
          severity?: string
          status?: string
          title: string
        }
        Update: {
          description?: string | null
          id?: string
          module?: string | null
          reported_at?: string
          reported_by?: string | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          auto_generated: boolean | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          payment_method: string | null
          reference_id: string | null
          reference_type: string | null
          source_id: string | null
          source_module: string | null
          transaction_date: string | null
          type: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          auto_generated?: boolean | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source_id?: string | null
          source_module?: string | null
          transaction_date?: string | null
          type: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          auto_generated?: boolean | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source_id?: string | null
          source_module?: string | null
          transaction_date?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      web_order_notes: {
        Row: {
          call_result: string | null
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          new_status: string | null
          note_type: string
          old_status: string | null
          order_id: string | null
        }
        Insert: {
          call_result?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          new_status?: string | null
          note_type?: string
          old_status?: string | null
          order_id?: string | null
        }
        Update: {
          call_result?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          new_status?: string | null
          note_type?: string
          old_status?: string | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      daily_sales_view: {
        Row: {
          cancelled: number | null
          date: string | null
          delivered: number | null
          returned: number | null
          total_cogs: number | null
          total_orders: number | null
          total_profit: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      order_summary_view: {
        Row: {
          channel: string | null
          cost_of_goods: number | null
          courier_status: string | null
          customer_name: string | null
          customer_phone: string | null
          gross_profit: number | null
          id: string | null
          order_date: string | null
          order_number: string | null
          pathao_tracking_code: string | null
          payment_status: string | null
          status: string | null
          total_amount: number | null
        }
        Relationships: []
      }
      product_profit_view: {
        Row: {
          gross_profit: number | null
          id: string | null
          landed_cost_bdt: number | null
          name: string | null
          needs_reorder: boolean | null
          profit_margin: number | null
          reorder_point: number | null
          selling_price: number | null
          sku: string | null
          stock_quantity: number | null
        }
        Insert: {
          gross_profit?: never
          id?: string | null
          landed_cost_bdt?: number | null
          name?: string | null
          needs_reorder?: never
          profit_margin?: never
          reorder_point?: number | null
          selling_price?: number | null
          sku?: string | null
          stock_quantity?: number | null
        }
        Update: {
          gross_profit?: never
          id?: string | null
          landed_cost_bdt?: number | null
          name?: string | null
          needs_reorder?: never
          profit_margin?: never
          reorder_point?: number | null
          selling_price?: number | null
          sku?: string | null
          stock_quantity?: number | null
        }
        Relationships: []
      }
      v_account_balances: {
        Row: {
          account_number: string | null
          balance: number | null
          id: string | null
          name: string | null
          total_in: number | null
          total_out: number | null
          type: string | null
        }
        Relationships: []
      }
      v_daily_cashflow: {
        Row: {
          account_name: string | null
          account_type: string | null
          cash_in: number | null
          cash_out: number | null
          ledger_date: string | null
          net_flow: number | null
        }
        Relationships: []
      }
      v_daily_pnl: {
        Row: {
          cod_fee: number | null
          cogs: number | null
          courier_cost: number | null
          courier_subsidy: number | null
          delivered_orders: number | null
          gateway_fee: number | null
          gross_profit: number | null
          packaging_cost: number | null
          pnl_date: string | null
          return_cost: number | null
          revenue: number | null
        }
        Relationships: []
      }
      v_monthly_pnl: {
        Row: {
          cod_fee: number | null
          cogs: number | null
          courier_cost: number | null
          courier_subsidy: number | null
          delivered_orders: number | null
          gateway_fee: number | null
          gross_profit: number | null
          packaging_cost: number | null
          pnl_month: string | null
          return_cost: number | null
          revenue: number | null
        }
        Relationships: []
      }
      v_stock_on_hand: {
        Row: {
          available_qty: number | null
          avg_cost: number | null
          name: string | null
          on_hand_qty: number | null
          product_id: string | null
          reserved_qty: number | null
          sku: string | null
          stock_value: number | null
        }
        Relationships: []
      }
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
  public: {
    Enums: {},
  },
} as const
