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
          reversed_at: string | null
          reversed_by: string | null
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
          reversed_at?: string | null
          reversed_by?: string | null
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
          reversed_at?: string | null
          reversed_by?: string | null
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
      account_mappings: {
        Row: {
          account_id: string | null
          description: string | null
          id: string
          mapping_key: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          description?: string | null
          id?: string
          mapping_key: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          description?: string | null
          id?: string
          mapping_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_period_locks: {
        Row: {
          id: string
          locked_at: string
          locked_by: string | null
          note: string | null
          period_end: string
        }
        Insert: {
          id?: string
          locked_at?: string
          locked_by?: string | null
          note?: string | null
          period_end: string
        }
        Update: {
          id?: string
          locked_at?: string
          locked_by?: string | null
          note?: string | null
          period_end?: string
        }
        Relationships: []
      }
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          end_date: string
          id: string
          period_key: string
          start_date: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          period_key: string
          start_date: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          period_key?: string
          start_date?: string
          status?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          account_number: string | null
          balance: number | null
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          type: string | null
        }
        Insert: {
          account_number?: string | null
          balance?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          type?: string | null
        }
        Update: {
          account_number?: string | null
          balance?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
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
      ad_expenses: {
        Row: {
          allocation_type: string | null
          amount_bdt: number
          campaign_id: string | null
          category: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          exchange_rate: number | null
          expense_date: string
          id: string
          metric_id: string | null
          note: string | null
          product_id: string | null
          ref_id: string | null
          sub_category: string | null
        }
        Insert: {
          allocation_type?: string | null
          amount_bdt?: number
          campaign_id?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          exchange_rate?: number | null
          expense_date: string
          id?: string
          metric_id?: string | null
          note?: string | null
          product_id?: string | null
          ref_id?: string | null
          sub_category?: string | null
        }
        Update: {
          allocation_type?: string | null
          amount_bdt?: number
          campaign_id?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          exchange_rate?: number | null
          expense_date?: string
          id?: string
          metric_id?: string | null
          note?: string | null
          product_id?: string | null
          ref_id?: string | null
          sub_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_expenses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_expenses_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "meta_campaign_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_expenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_expenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_expenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
        ]
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
      allocation_rules: {
        Row: {
          allocation_method: string
          category_id: string
          config_json: Json | null
          created_at: string
          default_target: string
          id: string
          is_active: boolean
          name: string
          scope: string
          updated_at: string
        }
        Insert: {
          allocation_method: string
          category_id: string
          config_json?: Json | null
          created_at?: string
          default_target?: string
          id?: string
          is_active?: boolean
          name: string
          scope?: string
          updated_at?: string
        }
        Update: {
          allocation_method?: string
          category_id?: string
          config_json?: Json | null
          created_at?: string
          default_target?: string
          id?: string
          is_active?: boolean
          name?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
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
          device_info: string | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          performed_by: string | null
          reason: string | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          device_info?: string | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          device_info?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      campaign_products: {
        Row: {
          allocation_pct: number | null
          campaign_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          product_id: string | null
        }
        Insert: {
          allocation_pct?: number | null
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string | null
        }
        Update: {
          allocation_pct?: number | null
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_products_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
        ]
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
      chart_of_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          normal_balance: string
          parent_id: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          account_type: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          normal_balance?: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          normal_balance?: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
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
          invoice_id: string | null
          matched_status: string | null
          mismatch_reason: string | null
          note: string | null
          order_id: string | null
          paid_amount: number
          settlement_id: string
          shipment_id: string | null
        }
        Insert: {
          consignment_id?: string | null
          created_at?: string
          expected_amount?: number | null
          id?: string
          invoice_id?: string | null
          matched_status?: string | null
          mismatch_reason?: string | null
          note?: string | null
          order_id?: string | null
          paid_amount?: number
          settlement_id: string
          shipment_id?: string | null
        }
        Update: {
          consignment_id?: string | null
          created_at?: string
          expected_amount?: number | null
          id?: string
          invoice_id?: string | null
          matched_status?: string | null
          mismatch_reason?: string | null
          note?: string | null
          order_id?: string | null
          paid_amount?: number
          settlement_id?: string
          shipment_id?: string | null
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
          {
            foreignKeyName: "cod_settlement_lines_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
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
          period_end: string | null
          period_start: string | null
          settlement_date: string
          settlement_ref: string | null
          statement_file_url: string | null
          status: string | null
          total_expected: number | null
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
          period_end?: string | null
          period_start?: string | null
          settlement_date: string
          settlement_ref?: string | null
          statement_file_url?: string | null
          status?: string | null
          total_expected?: number | null
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
          period_end?: string | null
          period_start?: string | null
          settlement_date?: string
          settlement_ref?: string | null
          statement_file_url?: string | null
          status?: string | null
          total_expected?: number | null
          total_orders?: number | null
          total_paid_amount?: number
          unmatched_count?: number | null
        }
        Relationships: []
      }
      courier_cost_events: {
        Row: {
          cod_fee: number | null
          created_at: string
          created_by: string | null
          delivery_fee: number | null
          discount: number | null
          event_type: string
          id: string
          return_cost: number | null
          shipment_id: string
          source: string | null
          total_cost: number | null
        }
        Insert: {
          cod_fee?: number | null
          created_at?: string
          created_by?: string | null
          delivery_fee?: number | null
          discount?: number | null
          event_type: string
          id?: string
          return_cost?: number | null
          shipment_id: string
          source?: string | null
          total_cost?: number | null
        }
        Update: {
          cod_fee?: number | null
          created_at?: string
          created_by?: string | null
          delivery_fee?: number | null
          discount?: number | null
          event_type?: string
          id?: string
          return_cost?: number | null
          shipment_id?: string
          source?: string | null
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_cost_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "courier_shipments"
            referencedColumns: ["id"]
          },
        ]
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
          cod_maximum: number | null
          cod_minimum: number | null
          courier_name: string
          created_at: string | null
          effective_from: string | null
          effective_to: string | null
          extra_charge: number | null
          id: string
          is_active: boolean | null
          return_charge: number | null
          service_area: string
          weight_slab_max: number | null
          weight_slab_min: number | null
        }
        Insert: {
          base_charge?: number
          cod_fee_percent?: number | null
          cod_maximum?: number | null
          cod_minimum?: number | null
          courier_name: string
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          extra_charge?: number | null
          id?: string
          is_active?: boolean | null
          return_charge?: number | null
          service_area: string
          weight_slab_max?: number | null
          weight_slab_min?: number | null
        }
        Update: {
          base_charge?: number
          cod_fee_percent?: number | null
          cod_maximum?: number | null
          cod_minimum?: number | null
          courier_name?: string
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          extra_charge?: number | null
          id?: string
          is_active?: boolean | null
          return_charge?: number | null
          service_area?: string
          weight_slab_max?: number | null
          weight_slab_min?: number | null
        }
        Relationships: []
      }
      courier_settlement_allocations: {
        Row: {
          allocated_amount: number
          created_at: string
          id: string
          settlement_id: string
          shipment_id: string
        }
        Insert: {
          allocated_amount?: number
          created_at?: string
          id?: string
          settlement_id: string
          shipment_id: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          id?: string
          settlement_id?: string
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_settlement_allocations_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "courier_settlements_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_settlement_allocations_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "courier_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_settlements_v2: {
        Row: {
          amount_received: number
          courier_id: string
          created_at: string
          created_by: string | null
          id: string
          journal_id: string | null
          notes: string | null
          received_account: string | null
          settlement_date: string
          settlement_ref: string | null
        }
        Insert: {
          amount_received?: number
          courier_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_id?: string | null
          notes?: string | null
          received_account?: string | null
          settlement_date: string
          settlement_ref?: string | null
        }
        Update: {
          amount_received?: number
          courier_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_id?: string | null
          notes?: string | null
          received_account?: string | null
          settlement_date?: string
          settlement_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_settlements_v2_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_settlements_v2_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_shipments: {
        Row: {
          booking_status: string
          courier_additional_charge: number | null
          courier_cod_fee: number
          courier_compensation_cost: number | null
          courier_delivery_fee: number
          courier_discount: number
          courier_id: string
          courier_net_payable: number
          courier_promo_discount: number | null
          courier_return_cost: number
          courier_total_cost: number
          created_at: string
          customer_shipping_amount: number
          customer_total_amount: number
          delivered_amount: number | null
          delivered_at: string | null
          id: string
          in_transit_at: string | null
          last_cost_updated_at: string | null
          order_id: string
          product_amount: number
          returned_amount: number | null
          returned_at: string | null
          tracking_id: string | null
          updated_at: string
        }
        Insert: {
          booking_status?: string
          courier_additional_charge?: number | null
          courier_cod_fee?: number
          courier_compensation_cost?: number | null
          courier_delivery_fee?: number
          courier_discount?: number
          courier_id: string
          courier_net_payable?: number
          courier_promo_discount?: number | null
          courier_return_cost?: number
          courier_total_cost?: number
          created_at?: string
          customer_shipping_amount?: number
          customer_total_amount?: number
          delivered_amount?: number | null
          delivered_at?: string | null
          id?: string
          in_transit_at?: string | null
          last_cost_updated_at?: string | null
          order_id: string
          product_amount?: number
          returned_amount?: number | null
          returned_at?: string | null
          tracking_id?: string | null
          updated_at?: string
        }
        Update: {
          booking_status?: string
          courier_additional_charge?: number | null
          courier_cod_fee?: number
          courier_compensation_cost?: number | null
          courier_delivery_fee?: number
          courier_discount?: number
          courier_id?: string
          courier_net_payable?: number
          courier_promo_discount?: number | null
          courier_return_cost?: number
          courier_total_cost?: number
          created_at?: string
          customer_shipping_amount?: number
          customer_total_amount?: number
          delivered_amount?: number | null
          delivered_at?: string | null
          id?: string
          in_transit_at?: string | null
          last_cost_updated_at?: string | null
          order_id?: string
          product_amount?: number
          returned_amount?: number | null
          returned_at?: string | null
          tracking_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_shipments_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_statement_lines: {
        Row: {
          cod_fee: number | null
          created_at: string
          customer_total_amount: number | null
          delivery_fee: number | null
          delivery_status: string | null
          discount: number | null
          id: string
          match_status: string
          mismatch_reason: string | null
          net_payable: number | null
          order_id: string | null
          payout_amount: number | null
          raw_json: Json | null
          return_cost: number | null
          statement_id: string
          total_cost: number | null
          tracking_id: string | null
        }
        Insert: {
          cod_fee?: number | null
          created_at?: string
          customer_total_amount?: number | null
          delivery_fee?: number | null
          delivery_status?: string | null
          discount?: number | null
          id?: string
          match_status?: string
          mismatch_reason?: string | null
          net_payable?: number | null
          order_id?: string | null
          payout_amount?: number | null
          raw_json?: Json | null
          return_cost?: number | null
          statement_id: string
          total_cost?: number | null
          tracking_id?: string | null
        }
        Update: {
          cod_fee?: number | null
          created_at?: string
          customer_total_amount?: number | null
          delivery_fee?: number | null
          delivery_status?: string | null
          discount?: number | null
          id?: string
          match_status?: string
          mismatch_reason?: string | null
          net_payable?: number | null
          order_id?: string | null
          payout_amount?: number | null
          raw_json?: Json | null
          return_cost?: number | null
          statement_id?: string
          total_cost?: number | null
          tracking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "courier_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_statements: {
        Row: {
          courier_id: string
          currency: string
          id: string
          imported_at: string
          imported_by: string | null
          statement_date_from: string
          statement_date_to: string
          statement_ref: string | null
          status: string
        }
        Insert: {
          courier_id: string
          currency?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          statement_date_from: string
          statement_date_to: string
          statement_ref?: string | null
          status?: string
        }
        Update: {
          courier_id?: string
          currency?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          statement_date_from?: string
          statement_date_to?: string
          statement_ref?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_statements_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
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
      daily_pnl_cache: {
        Row: {
          calculated_at: string | null
          cancelled_orders: number | null
          cod_fees: number | null
          cogs: number | null
          courier_delivery_charge: number | null
          courier_receivable: number | null
          courier_subsidy: number | null
          delivered_orders: number | null
          gross_margin_pct: number | null
          gross_profit: number | null
          gross_revenue: number | null
          id: string
          influencer_cost: number | null
          meta_ads_cost: number | null
          net_margin_pct: number | null
          net_profit: number | null
          other_expenses: number | null
          packaging_cost: number | null
          partial_orders: number | null
          pnl_date: string
          product_id: string | null
          rent_allocated: number | null
          return_loss_cogs: number | null
          returned_orders: number | null
          salary_allocated: number | null
          total_expenses: number | null
          video_cost: number | null
        }
        Insert: {
          calculated_at?: string | null
          cancelled_orders?: number | null
          cod_fees?: number | null
          cogs?: number | null
          courier_delivery_charge?: number | null
          courier_receivable?: number | null
          courier_subsidy?: number | null
          delivered_orders?: number | null
          gross_margin_pct?: number | null
          gross_profit?: number | null
          gross_revenue?: number | null
          id?: string
          influencer_cost?: number | null
          meta_ads_cost?: number | null
          net_margin_pct?: number | null
          net_profit?: number | null
          other_expenses?: number | null
          packaging_cost?: number | null
          partial_orders?: number | null
          pnl_date: string
          product_id?: string | null
          rent_allocated?: number | null
          return_loss_cogs?: number | null
          returned_orders?: number | null
          salary_allocated?: number | null
          total_expenses?: number | null
          video_cost?: number | null
        }
        Update: {
          calculated_at?: string | null
          cancelled_orders?: number | null
          cod_fees?: number | null
          cogs?: number | null
          courier_delivery_charge?: number | null
          courier_receivable?: number | null
          courier_subsidy?: number | null
          delivered_orders?: number | null
          gross_margin_pct?: number | null
          gross_profit?: number | null
          gross_revenue?: number | null
          id?: string
          influencer_cost?: number | null
          meta_ads_cost?: number | null
          net_margin_pct?: number | null
          net_profit?: number | null
          other_expenses?: number | null
          packaging_cost?: number | null
          partial_orders?: number | null
          pnl_date?: string
          product_id?: string | null
          rent_allocated?: number | null
          return_loss_cogs?: number | null
          returned_orders?: number | null
          salary_allocated?: number | null
          total_expenses?: number | null
          video_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_pnl_cache_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_pnl_cache_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_pnl_cache_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
        ]
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
      exception_events: {
        Row: {
          actor: string | null
          created_at: string
          event_type: string
          exception_id: string
          id: string
          message: string | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          event_type: string
          exception_id: string
          id?: string
          message?: string | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          event_type?: string
          exception_id?: string
          id?: string
          message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exception_events_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "exceptions"
            referencedColumns: ["id"]
          },
        ]
      }
      exception_rules: {
        Row: {
          code: string
          config_json: Json | null
          created_at: string
          id: string
          is_active: boolean
          last_run_at: string | null
          last_run_result: string | null
          module: string
          name: string
          schedule: string
          updated_at: string
        }
        Insert: {
          code: string
          config_json?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_result?: string | null
          module: string
          name: string
          schedule?: string
          updated_at?: string
        }
        Update: {
          code?: string
          config_json?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_result?: string | null
          module?: string
          name?: string
          schedule?: string
          updated_at?: string
        }
        Relationships: []
      }
      exceptions: {
        Row: {
          assigned_to: string | null
          code: string
          created_at: string
          description: string | null
          detected_at: string
          detected_by: string
          id: string
          metadata: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source_entity_id: string | null
          source_entity_type: string | null
          source_module: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          code: string
          created_at?: string
          description?: string | null
          detected_at?: string
          detected_by?: string
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_module: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          code?: string
          created_at?: string
          description?: string | null
          detected_at?: string
          detected_by?: string
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_module?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string | null
          currency: string
          id: string
          rate: number
          rate_date: string
          source: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string
          id?: string
          rate: number
          rate_date: string
          source?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string
          id?: string
          rate?: number
          rate_date?: string
          source?: string | null
        }
        Relationships: []
      }
      expense_allocation_lines: {
        Row: {
          allocated_amount: number
          allocation_id: string
          created_at: string
          id: string
          target_id: string
          target_type: string
          weight_value: number | null
        }
        Insert: {
          allocated_amount?: number
          allocation_id: string
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          weight_value?: number | null
        }
        Update: {
          allocated_amount?: number
          allocation_id?: string
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          weight_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_allocation_lines_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "expense_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_allocations: {
        Row: {
          allocation_method: string
          category_id: string | null
          created_at: string
          created_by: string | null
          date_from: string
          date_to: string
          id: string
          run_name: string
          status: string
          total_amount: number
        }
        Insert: {
          allocation_method: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date_from: string
          date_to: string
          id?: string
          run_name: string
          status?: string
          total_amount?: number
        }
        Update: {
          allocation_method?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          date_from?: string
          date_to?: string
          id?: string
          run_name?: string
          status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_allocations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          default_gl_account_id: string | null
          id: string
          is_allocatable: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_gl_account_id?: string | null
          id?: string
          is_allocatable?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_gl_account_id?: string | null
          id?: string
          is_allocatable?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_default_gl_account_id_fkey"
            columns: ["default_gl_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          allocation_type: string | null
          amount_bdt: number
          category: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          exchange_rate: number | null
          expense_date: string
          fixed_allocation_method: string | null
          id: string
          is_fixed_cost: boolean | null
          is_reversed: boolean | null
          note: string | null
          original_amount: number | null
          payment_account_id: string | null
          per_unit_amount: number | null
          product_id: string | null
          ref_id: string | null
          ref_type: string | null
          reversed_at: string | null
          reversed_by: string | null
          source: string | null
          sub_category: string | null
          total_units_allocated: number | null
        }
        Insert: {
          allocation_type?: string | null
          amount_bdt: number
          category: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          exchange_rate?: number | null
          expense_date: string
          fixed_allocation_method?: string | null
          id?: string
          is_fixed_cost?: boolean | null
          is_reversed?: boolean | null
          note?: string | null
          original_amount?: number | null
          payment_account_id?: string | null
          per_unit_amount?: number | null
          product_id?: string | null
          ref_id?: string | null
          ref_type?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source?: string | null
          sub_category?: string | null
          total_units_allocated?: number | null
        }
        Update: {
          allocation_type?: string | null
          amount_bdt?: number
          category?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          exchange_rate?: number | null
          expense_date?: string
          fixed_allocation_method?: string | null
          id?: string
          is_fixed_cost?: boolean | null
          is_reversed?: boolean | null
          note?: string | null
          original_amount?: number | null
          payment_account_id?: string | null
          per_unit_amount?: number | null
          product_id?: string | null
          ref_id?: string | null
          ref_type?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source?: string | null
          sub_category?: string | null
          total_units_allocated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      expenses_v2: {
        Row: {
          amount: number
          attachment_url: string | null
          category_id: string
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          journal_id: string | null
          paid_from_account_id: string | null
          payment_method: string
          reference_id: string | null
          reference_type: string
          status: string
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          journal_id?: string | null
          paid_from_account_id?: string | null
          payment_method?: string
          reference_id?: string | null
          reference_type?: string
          status?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          journal_id?: string | null
          paid_from_account_id?: string | null
          payment_method?: string
          reference_id?: string | null
          reference_type?: string
          status?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_v2_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_v2_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_v2_paid_from_account_id_fkey"
            columns: ["paid_from_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_marketing: {
        Row: {
          amount: number
          campaign_name: string | null
          channel: string
          created_at: string
          id: string
          notes: string | null
          payment_method: string | null
          posting_event_id: string | null
          product_id: string | null
          spend_date: string
          updated_at: string
        }
        Insert: {
          amount?: number
          campaign_name?: string | null
          channel?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          posting_event_id?: string | null
          product_id?: string | null
          spend_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          campaign_name?: string | null
          channel?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          posting_event_id?: string | null
          product_id?: string | null
          spend_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_marketing_posting_event_id_fkey"
            columns: ["posting_event_id"]
            isOneToOne: false
            referencedRelation: "posting_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_marketing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_marketing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_marketing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          created_at: string | null
          grn_id: string
          id: string
          line_total: number
          product_id: string | null
          product_name: string | null
          qty_received: number
          sku: string | null
          unit_cost: number
        }
        Insert: {
          created_at?: string | null
          grn_id: string
          id?: string
          line_total?: number
          product_id?: string | null
          product_name?: string | null
          qty_received?: number
          sku?: string | null
          unit_cost?: number
        }
        Update: {
          created_at?: string | null
          grn_id?: string
          id?: string
          line_total?: number
          product_id?: string | null
          product_name?: string | null
          qty_received?: number
          sku?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          created_at: string | null
          created_by: string | null
          grn_number: string
          id: string
          import_shipment_id: string | null
          journal_id: string | null
          notes: string | null
          po_id: string | null
          receipt_date: string
          receipt_type: string
          status: string
          supplier_id: string | null
          total_product_cost: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          grn_number: string
          id?: string
          import_shipment_id?: string | null
          journal_id?: string | null
          notes?: string | null
          po_id?: string | null
          receipt_date?: string
          receipt_type?: string
          status?: string
          supplier_id?: string | null
          total_product_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          grn_number?: string
          id?: string
          import_shipment_id?: string | null
          journal_id?: string | null
          notes?: string | null
          po_id?: string | null
          receipt_date?: string
          receipt_type?: string
          status?: string
          supplier_id?: string | null
          total_product_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_financials"
            referencedColumns: ["supplier_id"]
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
      hrm_goals: {
        Row: {
          created_at: string
          current_value: number | null
          description: string | null
          due_date: string | null
          employee_id: string
          id: string
          status: string
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          description?: string | null
          due_date?: string | null
          employee_id: string
          id?: string
          status?: string
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_value?: number | null
          description?: string | null
          due_date?: string | null
          employee_id?: string
          id?: string
          status?: string
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hrm_goals_employee_id_fkey"
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
      hrm_payroll: {
        Row: {
          basic_salary: number
          bonus: number | null
          created_at: string
          deductions: number | null
          employee_id: string
          id: string
          month: number
          net_salary: number
          notes: string | null
          overtime_amount: number | null
          overtime_hours: number | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          updated_at: string
          year: number
        }
        Insert: {
          basic_salary?: number
          bonus?: number | null
          created_at?: string
          deductions?: number | null
          employee_id: string
          id?: string
          month: number
          net_salary?: number
          notes?: string | null
          overtime_amount?: number | null
          overtime_hours?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          updated_at?: string
          year: number
        }
        Update: {
          basic_salary?: number
          bonus?: number | null
          created_at?: string
          deductions?: number | null
          employee_id?: string
          id?: string
          month?: number
          net_salary?: number
          notes?: string | null
          overtime_amount?: number | null
          overtime_hours?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hrm_payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hrm_performance_reviews: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          improvements: string | null
          overall_comment: string | null
          rating: number | null
          review_date: string
          review_period: string
          reviewer_name: string | null
          status: string
          strengths: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          improvements?: string | null
          overall_comment?: string | null
          rating?: number | null
          review_date?: string
          review_period?: string
          reviewer_name?: string | null
          status?: string
          strengths?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          improvements?: string | null
          overall_comment?: string | null
          rating?: number | null
          review_date?: string
          review_period?: string
          reviewer_name?: string | null
          status?: string
          strengths?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hrm_performance_reviews_employee_id_fkey"
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
      hrm_task_comments: {
        Row: {
          author_name: string
          content: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_name?: string
          content: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hrm_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "hrm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      hrm_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by_name: string | null
          department_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_name?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_name?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hrm_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrm_tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
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
      import_shipment_pos: {
        Row: {
          created_at: string
          id: string
          import_shipment_id: string
          po_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          import_shipment_id: string
          po_id: string
        }
        Update: {
          created_at?: string
          id?: string
          import_shipment_id?: string
          po_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_shipment_pos_import_shipment_id_fkey"
            columns: ["import_shipment_id"]
            isOneToOne: false
            referencedRelation: "import_shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_shipment_pos_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      import_shipments: {
        Row: {
          agent_id: string | null
          created_at: string
          customs_cost: number
          finalized_at: string | null
          finalized_by: string | null
          freight_cost: number
          id: string
          import_number: string
          is_finalized: boolean
          local_transport: number
          notes: string | null
          other_charges: number
          status: string
          supplier_id: string | null
          total_landed_cost: number | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          customs_cost?: number
          finalized_at?: string | null
          finalized_by?: string | null
          freight_cost?: number
          id?: string
          import_number: string
          is_finalized?: boolean
          local_transport?: number
          notes?: string | null
          other_charges?: number
          status?: string
          supplier_id?: string | null
          total_landed_cost?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          customs_cost?: number
          finalized_at?: string | null
          finalized_by?: string | null
          freight_cost?: number
          id?: string
          import_number?: string
          is_finalized?: boolean
          local_transport?: number
          notes?: string | null
          other_charges?: number
          status?: string
          supplier_id?: string | null
          total_landed_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_shipments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_shipments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_shipments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_financials"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      influencer_deal_skus: {
        Row: {
          allocation_pct: number | null
          created_at: string
          deal_id: string
          id: string
          product_id: string
        }
        Insert: {
          allocation_pct?: number | null
          created_at?: string
          deal_id: string
          id?: string
          product_id: string
        }
        Update: {
          allocation_pct?: number | null
          created_at?: string
          deal_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_deal_skus_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "influencer_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_deal_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_deal_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_deal_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      influencer_deals: {
        Row: {
          amount_paid: number
          campaign_name: string
          created_at: string
          end_date: string | null
          id: string
          influencer_id: string
          notes: string | null
          payment_method: string | null
          payment_status: string
          posting_event_id: string | null
          proof_url: string | null
          revenue_generated: number | null
          start_date: string
          total_cost: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          campaign_name: string
          created_at?: string
          end_date?: string | null
          id?: string
          influencer_id: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          posting_event_id?: string | null
          proof_url?: string | null
          revenue_generated?: number | null
          start_date?: string
          total_cost?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          campaign_name?: string
          created_at?: string
          end_date?: string | null
          id?: string
          influencer_id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          posting_event_id?: string | null
          proof_url?: string | null
          revenue_generated?: number | null
          start_date?: string
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_deals_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_deals_posting_event_id_fkey"
            columns: ["posting_event_id"]
            isOneToOne: false
            referencedRelation: "posting_events"
            referencedColumns: ["id"]
          },
        ]
      }
      influencers: {
        Row: {
          contact_info: string | null
          created_at: string
          id: string
          name: string
          niche: string | null
          notes: string | null
          page_link: string | null
          platform: string
          status: string
          updated_at: string
        }
        Insert: {
          contact_info?: string | null
          created_at?: string
          id?: string
          name: string
          niche?: string | null
          notes?: string | null
          page_link?: string | null
          platform?: string
          status?: string
          updated_at?: string
        }
        Update: {
          contact_info?: string | null
          created_at?: string
          id?: string
          name?: string
          niche?: string | null
          notes?: string | null
          page_link?: string | null
          platform?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_ledger: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          product_id: string | null
          qty_in: number
          qty_out: number
          reference_id: string | null
          reference_type: string | null
          requires_approval: boolean | null
          running_avg_cost: number | null
          sku: string | null
          txn_date: string | null
          txn_type: string
          unit_cost: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string | null
          qty_in?: number
          qty_out?: number
          reference_id?: string | null
          reference_type?: string | null
          requires_approval?: boolean | null
          running_avg_cost?: number | null
          sku?: string | null
          txn_date?: string | null
          txn_type: string
          unit_cost?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string | null
          qty_in?: number
          qty_out?: number
          reference_id?: string | null
          reference_type?: string | null
          requires_approval?: boolean | null
          running_avg_cost?: number | null
          sku?: string | null
          txn_date?: string | null
          txn_type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
        ]
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
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          entry_number: number
          id: string
          is_auto: boolean
          period_key: string | null
          posted_at: string | null
          posted_by: string | null
          reference_id: string | null
          reference_type: string | null
          reversal_of_id: string | null
          reversed_by_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          entry_number?: number
          id?: string
          is_auto?: boolean
          period_key?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          reversal_of_id?: string | null
          reversed_by_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          entry_number?: number
          id?: string
          is_auto?: boolean
          period_key?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          reversal_of_id?: string | null
          reversed_by_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversed_by_id_fkey"
            columns: ["reversed_by_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      landed_cost_allocation_lines: {
        Row: {
          allocated_cost: number | null
          allocation_id: string
          base_value: number | null
          created_at: string | null
          id: string
          product_id: string | null
          qty_received: number | null
          sku: string | null
        }
        Insert: {
          allocated_cost?: number | null
          allocation_id: string
          base_value?: number | null
          created_at?: string | null
          id?: string
          product_id?: string | null
          qty_received?: number | null
          sku?: string | null
        }
        Update: {
          allocated_cost?: number | null
          allocation_id?: string
          base_value?: number | null
          created_at?: string | null
          id?: string
          product_id?: string | null
          qty_received?: number | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landed_cost_allocation_lines_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "landed_cost_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landed_cost_allocation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landed_cost_allocation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landed_cost_allocation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      landed_cost_allocations: {
        Row: {
          allocation_method: string
          created_at: string | null
          grn_id: string | null
          id: string
          import_shipment_id: string | null
          po_id: string | null
          posted_at: string | null
          posted_by: string | null
          status: string
          total_landed_cost: number
        }
        Insert: {
          allocation_method?: string
          created_at?: string | null
          grn_id?: string | null
          id?: string
          import_shipment_id?: string | null
          po_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          total_landed_cost?: number
        }
        Update: {
          allocation_method?: string
          created_at?: string | null
          grn_id?: string | null
          id?: string
          import_shipment_id?: string | null
          po_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          total_landed_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "landed_cost_allocations_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landed_cost_allocations_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      landed_costs: {
        Row: {
          amount: number
          cost_date: string
          cost_type: string
          created_at: string | null
          created_by: string | null
          id: string
          import_shipment_id: string | null
          journal_id: string | null
          notes: string | null
          paid_from_account_id: string | null
          po_id: string | null
          status: string
        }
        Insert: {
          amount?: number
          cost_date?: string
          cost_type?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          import_shipment_id?: string | null
          journal_id?: string | null
          notes?: string | null
          paid_from_account_id?: string | null
          po_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          cost_date?: string
          cost_type?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          import_shipment_id?: string | null
          journal_id?: string | null
          notes?: string | null
          paid_from_account_id?: string | null
          po_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "landed_costs_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landed_costs_paid_from_account_id_fkey"
            columns: ["paid_from_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landed_costs_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
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
      legacy_import_batches: {
        Row: {
          created_at: string | null
          created_by: string | null
          duplicate_count: number | null
          errors: Json | null
          failed_count: number | null
          file_name: string
          id: string
          imported_count: number | null
          status: string | null
          total_rows: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          duplicate_count?: number | null
          errors?: Json | null
          failed_count?: number | null
          file_name: string
          id?: string
          imported_count?: number | null
          status?: string | null
          total_rows?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          duplicate_count?: number | null
          errors?: Json | null
          failed_count?: number | null
          file_name?: string
          id?: string
          imported_count?: number | null
          status?: string | null
          total_rows?: number | null
        }
        Relationships: []
      }
      meta_ad_accounts: {
        Row: {
          access_token: string
          account_name: string
          created_at: string | null
          id: string
          is_active: boolean | null
          meta_account_id: string
        }
        Insert: {
          access_token: string
          account_name: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          meta_account_id: string
        }
        Update: {
          access_token?: string
          account_name?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          meta_account_id?: string
        }
        Relationships: []
      }
      meta_campaign_metrics: {
        Row: {
          campaign_id: string | null
          clicks: number | null
          cpc: number | null
          cpm: number | null
          cpo: number | null
          ctr: number | null
          id: string
          impressions: number | null
          meta_campaign_id: string
          metric_date: string
          purchase_value: number | null
          purchases: number | null
          reach: number | null
          roas: number | null
          spend_bdt: number | null
          spend_usd: number | null
          synced_at: string | null
          usd_rate: number | null
        }
        Insert: {
          campaign_id?: string | null
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          cpo?: number | null
          ctr?: number | null
          id?: string
          impressions?: number | null
          meta_campaign_id: string
          metric_date: string
          purchase_value?: number | null
          purchases?: number | null
          reach?: number | null
          roas?: number | null
          spend_bdt?: number | null
          spend_usd?: number | null
          synced_at?: string | null
          usd_rate?: number | null
        }
        Update: {
          campaign_id?: string | null
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          cpo?: number | null
          ctr?: number | null
          id?: string
          impressions?: number | null
          meta_campaign_id?: string
          metric_date?: string
          purchase_value?: number | null
          purchases?: number | null
          reach?: number | null
          roas?: number | null
          spend_bdt?: number | null
          spend_usd?: number | null
          synced_at?: string | null
          usd_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaign_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_campaigns: {
        Row: {
          campaign_name: string
          created_at: string | null
          daily_budget: number | null
          end_date: string | null
          id: string
          lifetime_budget: number | null
          meta_account_id: string
          meta_campaign_id: string
          objective: string | null
          start_date: string | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          campaign_name: string
          created_at?: string | null
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          lifetime_budget?: number | null
          meta_account_id: string
          meta_campaign_id: string
          objective?: string | null
          start_date?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          campaign_name?: string
          created_at?: string | null
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          lifetime_budget?: number | null
          meta_account_id?: string
          meta_campaign_id?: string
          objective?: string | null
          start_date?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: []
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
          unit_cost_at_delivery: number | null
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
          unit_cost_at_delivery?: number | null
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
          unit_cost_at_delivery?: number | null
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
          advance_amount: number | null
          advance_journal_id: string | null
          advance_method: string | null
          advance_posted: boolean | null
          assigned_to: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          channel: string
          cod_amount: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          cost_of_goods: number | null
          courier_additional_charge: number | null
          courier_charge: number | null
          courier_cod_fee: number | null
          courier_compensation_cost: number | null
          courier_delivery_fee: number | null
          courier_discount: number | null
          courier_final_status: string | null
          courier_last_sync_at: string | null
          courier_last_sync_error: string | null
          courier_mode: string | null
          courier_net_payable: number | null
          courier_promo_discount: number | null
          courier_return_cost: number | null
          courier_status: string | null
          courier_sync_status: string
          courier_total_cost: number | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_charge: number | null
          delivery_district: string | null
          delivery_thana: string | null
          discount: number | null
          exchange_applied: boolean | null
          exchange_applied_at: string | null
          exchange_reason: string | null
          gross_profit: number | null
          id: string
          inventory_mode: string | null
          invoice_id: string | null
          legacy_courier_name: string | null
          legacy_courier_status: string | null
          legacy_delivered_date: string | null
          legacy_finalized: boolean | null
          legacy_finalized_at: string | null
          legacy_import_batch_id: string | null
          legacy_invoice_no: string | null
          legacy_order_id: string | null
          legacy_returned_date: string | null
          legacy_status: string | null
          legacy_stock_synced: boolean | null
          legacy_tracking_id: string | null
          needs_address_review: boolean
          notes: string | null
          order_date: string | null
          order_number: string
          order_source: string | null
          parsed_address_confidence: number | null
          partial_confirmed: boolean | null
          partial_delivered_qty: number | null
          partial_returned_qty: number | null
          pathao_consignment_id: string | null
          pathao_tracking_code: string | null
          payment_method: string | null
          payment_status: string | null
          posting_mode: string | null
          preorder_flag: boolean
          return_condition: string | null
          settlement_batch_id: string | null
          settlement_journal_id: string | null
          settlement_posted: boolean | null
          settlement_posted_at: string | null
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
          advance_amount?: number | null
          advance_journal_id?: string | null
          advance_method?: string | null
          advance_posted?: boolean | null
          assigned_to?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          channel: string
          cod_amount?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          cost_of_goods?: number | null
          courier_additional_charge?: number | null
          courier_charge?: number | null
          courier_cod_fee?: number | null
          courier_compensation_cost?: number | null
          courier_delivery_fee?: number | null
          courier_discount?: number | null
          courier_final_status?: string | null
          courier_last_sync_at?: string | null
          courier_last_sync_error?: string | null
          courier_mode?: string | null
          courier_net_payable?: number | null
          courier_promo_discount?: number | null
          courier_return_cost?: number | null
          courier_status?: string | null
          courier_sync_status?: string
          courier_total_cost?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_charge?: number | null
          delivery_district?: string | null
          delivery_thana?: string | null
          discount?: number | null
          exchange_applied?: boolean | null
          exchange_applied_at?: string | null
          exchange_reason?: string | null
          gross_profit?: number | null
          id?: string
          inventory_mode?: string | null
          invoice_id?: string | null
          legacy_courier_name?: string | null
          legacy_courier_status?: string | null
          legacy_delivered_date?: string | null
          legacy_finalized?: boolean | null
          legacy_finalized_at?: string | null
          legacy_import_batch_id?: string | null
          legacy_invoice_no?: string | null
          legacy_order_id?: string | null
          legacy_returned_date?: string | null
          legacy_status?: string | null
          legacy_stock_synced?: boolean | null
          legacy_tracking_id?: string | null
          needs_address_review?: boolean
          notes?: string | null
          order_date?: string | null
          order_number: string
          order_source?: string | null
          parsed_address_confidence?: number | null
          partial_confirmed?: boolean | null
          partial_delivered_qty?: number | null
          partial_returned_qty?: number | null
          pathao_consignment_id?: string | null
          pathao_tracking_code?: string | null
          payment_method?: string | null
          payment_status?: string | null
          posting_mode?: string | null
          preorder_flag?: boolean
          return_condition?: string | null
          settlement_batch_id?: string | null
          settlement_journal_id?: string | null
          settlement_posted?: boolean | null
          settlement_posted_at?: string | null
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
          advance_amount?: number | null
          advance_journal_id?: string | null
          advance_method?: string | null
          advance_posted?: boolean | null
          assigned_to?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          channel?: string
          cod_amount?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          cost_of_goods?: number | null
          courier_additional_charge?: number | null
          courier_charge?: number | null
          courier_cod_fee?: number | null
          courier_compensation_cost?: number | null
          courier_delivery_fee?: number | null
          courier_discount?: number | null
          courier_final_status?: string | null
          courier_last_sync_at?: string | null
          courier_last_sync_error?: string | null
          courier_mode?: string | null
          courier_net_payable?: number | null
          courier_promo_discount?: number | null
          courier_return_cost?: number | null
          courier_status?: string | null
          courier_sync_status?: string
          courier_total_cost?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_charge?: number | null
          delivery_district?: string | null
          delivery_thana?: string | null
          discount?: number | null
          exchange_applied?: boolean | null
          exchange_applied_at?: string | null
          exchange_reason?: string | null
          gross_profit?: number | null
          id?: string
          inventory_mode?: string | null
          invoice_id?: string | null
          legacy_courier_name?: string | null
          legacy_courier_status?: string | null
          legacy_delivered_date?: string | null
          legacy_finalized?: boolean | null
          legacy_finalized_at?: string | null
          legacy_import_batch_id?: string | null
          legacy_invoice_no?: string | null
          legacy_order_id?: string | null
          legacy_returned_date?: string | null
          legacy_status?: string | null
          legacy_stock_synced?: boolean | null
          legacy_tracking_id?: string | null
          needs_address_review?: boolean
          notes?: string | null
          order_date?: string | null
          order_number?: string
          order_source?: string | null
          parsed_address_confidence?: number | null
          partial_confirmed?: boolean | null
          partial_delivered_qty?: number | null
          partial_returned_qty?: number | null
          pathao_consignment_id?: string | null
          pathao_tracking_code?: string | null
          payment_method?: string | null
          payment_status?: string | null
          posting_mode?: string | null
          preorder_flag?: boolean
          return_condition?: string | null
          settlement_batch_id?: string | null
          settlement_journal_id?: string | null
          settlement_posted?: boolean | null
          settlement_posted_at?: string | null
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
            foreignKeyName: "orders_advance_journal_id_fkey"
            columns: ["advance_journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "orders_settlement_journal_id_fkey"
            columns: ["settlement_journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
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
      posting_events: {
        Row: {
          amount: number
          blocked_reason: string | null
          created_at: string
          created_by: string | null
          credit_account_id: string | null
          credit_label: string | null
          debit_account_id: string | null
          debit_label: string | null
          event_date: string
          event_type: string
          id: string
          journal_id: string | null
          metadata: Json | null
          posted_at: string | null
          posted_by: string | null
          reference_id: string
          reference_label: string | null
          reference_type: string
          reversal_journal_id: string | null
          reversed_at: string | null
          reversed_by: string | null
          reversed_reason: string | null
          status: string
        }
        Insert: {
          amount?: number
          blocked_reason?: string | null
          created_at?: string
          created_by?: string | null
          credit_account_id?: string | null
          credit_label?: string | null
          debit_account_id?: string | null
          debit_label?: string | null
          event_date?: string
          event_type: string
          id?: string
          journal_id?: string | null
          metadata?: Json | null
          posted_at?: string | null
          posted_by?: string | null
          reference_id: string
          reference_label?: string | null
          reference_type: string
          reversal_journal_id?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          reversed_reason?: string | null
          status?: string
        }
        Update: {
          amount?: number
          blocked_reason?: string | null
          created_at?: string
          created_by?: string | null
          credit_account_id?: string | null
          credit_label?: string | null
          debit_account_id?: string | null
          debit_label?: string | null
          event_date?: string
          event_type?: string
          id?: string
          journal_id?: string | null
          metadata?: Json | null
          posted_at?: string | null
          posted_by?: string | null
          reference_id?: string
          reference_label?: string | null
          reference_type?: string
          reversal_journal_id?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          reversed_reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "posting_events_credit_account_id_fkey"
            columns: ["credit_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posting_events_debit_account_id_fkey"
            columns: ["debit_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posting_events_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posting_events_reversal_journal_id_fkey"
            columns: ["reversal_journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      preorder_batch_items: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          order_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          order_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preorder_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "preorder_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preorder_batch_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preorder_batch_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      preorder_batches: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          scheduled_date: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          scheduled_date?: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          scheduled_date?: string
          status?: string
        }
        Relationships: []
      }
      product_cost_buckets: {
        Row: {
          ads_cost: number
          external_marketing_cost: number
          id: string
          influencer_cost: number
          overhead_cost: number
          packaging_cost: number
          period_key: string
          sku: string
          updated_at: string
        }
        Insert: {
          ads_cost?: number
          external_marketing_cost?: number
          id?: string
          influencer_cost?: number
          overhead_cost?: number
          packaging_cost?: number
          period_key: string
          sku: string
          updated_at?: string
        }
        Update: {
          ads_cost?: number
          external_marketing_cost?: number
          id?: string
          influencer_cost?: number
          overhead_cost?: number
          packaging_cost?: number
          period_key?: string
          sku?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_costs: {
        Row: {
          amount: number
          amount_bdt: number
          cost_type: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          exchange_rate: number | null
          id: string
          note: string | null
          per_unit_cost: number | null
          period_end: string | null
          period_start: string | null
          product_id: string | null
          total_units: number | null
        }
        Insert: {
          amount: number
          amount_bdt: number
          cost_type: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          exchange_rate?: number | null
          id?: string
          note?: string | null
          per_unit_cost?: number | null
          period_end?: string | null
          period_start?: string | null
          product_id?: string | null
          total_units?: number | null
        }
        Update: {
          amount?: number
          amount_bdt?: number
          cost_type?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          exchange_rate?: number | null
          id?: string
          note?: string | null
          per_unit_cost?: number | null
          period_end?: string | null
          period_start?: string | null
          product_id?: string | null
          total_units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
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
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_financials"
            referencedColumns: ["supplier_id"]
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
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_financials"
            referencedColumns: ["supplier_id"]
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
      reconciliation_exceptions: {
        Row: {
          courier_id: string | null
          created_at: string
          id: string
          message: string
          resolve_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          shipment_id: string | null
          statement_line_id: string | null
          status: string
          type: string
        }
        Insert: {
          courier_id?: string | null
          created_at?: string
          id?: string
          message: string
          resolve_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          shipment_id?: string | null
          statement_line_id?: string | null
          status?: string
          type: string
        }
        Update: {
          courier_id?: string | null
          created_at?: string
          id?: string
          message?: string
          resolve_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          shipment_id?: string | null
          statement_line_id?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_exceptions_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_exceptions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "courier_shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_exceptions_statement_line_id_fkey"
            columns: ["statement_line_id"]
            isOneToOne: false
            referencedRelation: "courier_statement_lines"
            referencedColumns: ["id"]
          },
        ]
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
      security_permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          module: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      security_role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "security_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "security_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      security_user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "security_roles"
            referencedColumns: ["id"]
          },
        ]
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
      settlement_batch_lines: {
        Row: {
          batch_id: string
          courier_additional: number | null
          courier_cod_fee: number | null
          courier_compensation: number | null
          courier_delivery_fee: number | null
          courier_discount: number | null
          courier_order_id: string | null
          courier_total_cost: number | null
          created_at: string
          id: string
          ignore_reason: string | null
          ignored: boolean
          invoice_id: string | null
          journal_id: string | null
          match_status: string
          matched_courier_cost: number | null
          matched_customer_total: number | null
          matched_net_payable: number | null
          mismatch_amount: number | null
          mismatch_reason: string | null
          net_payable_statement: number | null
          order_id: string | null
          posted: boolean
          posted_at: string | null
          posted_by: string | null
          receiving_account_id: string | null
          row_index: number
          statement_amount: number
          tracking_id: string | null
        }
        Insert: {
          batch_id: string
          courier_additional?: number | null
          courier_cod_fee?: number | null
          courier_compensation?: number | null
          courier_delivery_fee?: number | null
          courier_discount?: number | null
          courier_order_id?: string | null
          courier_total_cost?: number | null
          created_at?: string
          id?: string
          ignore_reason?: string | null
          ignored?: boolean
          invoice_id?: string | null
          journal_id?: string | null
          match_status?: string
          matched_courier_cost?: number | null
          matched_customer_total?: number | null
          matched_net_payable?: number | null
          mismatch_amount?: number | null
          mismatch_reason?: string | null
          net_payable_statement?: number | null
          order_id?: string | null
          posted?: boolean
          posted_at?: string | null
          posted_by?: string | null
          receiving_account_id?: string | null
          row_index?: number
          statement_amount?: number
          tracking_id?: string | null
        }
        Update: {
          batch_id?: string
          courier_additional?: number | null
          courier_cod_fee?: number | null
          courier_compensation?: number | null
          courier_delivery_fee?: number | null
          courier_discount?: number | null
          courier_order_id?: string | null
          courier_total_cost?: number | null
          created_at?: string
          id?: string
          ignore_reason?: string | null
          ignored?: boolean
          invoice_id?: string | null
          journal_id?: string | null
          match_status?: string
          matched_courier_cost?: number | null
          matched_customer_total?: number | null
          matched_net_payable?: number | null
          mismatch_amount?: number | null
          mismatch_reason?: string | null
          net_payable_statement?: number | null
          order_id?: string | null
          posted?: boolean
          posted_at?: string | null
          posted_by?: string | null
          receiving_account_id?: string | null
          row_index?: number
          statement_amount?: number
          tracking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_batch_lines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "settlement_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_batch_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_batch_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_batch_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_batch_lines_receiving_account_id_fkey"
            columns: ["receiving_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_batches: {
        Row: {
          batch_ref: string | null
          closed_at: string | null
          courier_id: string
          courier_name: string
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          matched_count: number
          mismatch_count: number
          posted_count: number
          statement_date: string
          status: string
          total_amount: number
          total_rows: number
          unmatched_count: number
        }
        Insert: {
          batch_ref?: string | null
          closed_at?: string | null
          courier_id: string
          courier_name: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          matched_count?: number
          mismatch_count?: number
          posted_count?: number
          statement_date?: string
          status?: string
          total_amount?: number
          total_rows?: number
          unmatched_count?: number
        }
        Update: {
          batch_ref?: string | null
          closed_at?: string | null
          courier_id?: string
          courier_name?: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          matched_count?: number
          mismatch_count?: number
          posted_count?: number
          statement_date?: string
          status?: string
          total_amount?: number
          total_rows?: number
          unmatched_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "settlement_batches_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_exceptions: {
        Row: {
          created_at: string | null
          difference: number | null
          dispute_status: string | null
          exception_type: string
          expected_amount: number | null
          id: string
          invoice_id: string | null
          order_id: string | null
          received_amount: number | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          settlement_id: string | null
          settlement_line_id: string | null
        }
        Insert: {
          created_at?: string | null
          difference?: number | null
          dispute_status?: string | null
          exception_type: string
          expected_amount?: number | null
          id?: string
          invoice_id?: string | null
          order_id?: string | null
          received_amount?: number | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          settlement_id?: string | null
          settlement_line_id?: string | null
        }
        Update: {
          created_at?: string | null
          difference?: number | null
          dispute_status?: string | null
          exception_type?: string
          expected_amount?: number | null
          id?: string
          invoice_id?: string | null
          order_id?: string | null
          received_amount?: number | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          settlement_id?: string | null
          settlement_line_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_exceptions_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "cod_settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_exceptions_settlement_line_id_fkey"
            columns: ["settlement_line_id"]
            isOneToOne: false
            referencedRelation: "cod_settlement_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          cod_amount: number
          cod_fee: number
          courier_delivery_charge: number
          courier_name: string
          courier_return_charge: number | null
          courier_subsidy: number | null
          courier_zone: string | null
          created_at: string | null
          customer_return_paid: number | null
          customer_shipping_fee: number | null
          delivered_date: string | null
          id: string
          invoice_id: string | null
          is_partial: boolean | null
          is_settled: boolean | null
          net_receivable: number | null
          order_id: string | null
          partial_cod_fee_delivered: number | null
          partial_confirmed_at: string | null
          partial_confirmed_by: string | null
          partial_courier_charge_delivered: number | null
          partial_courier_charge_returned: number | null
          partial_delivered_qty: number | null
          partial_delivered_revenue: number | null
          partial_returned_qty: number | null
          product_price: number
          return_net: number | null
          return_type: string | null
          settled_amount: number | null
          settlement_difference: number | null
          settlement_id: string | null
          shipped_date: string | null
          status: string | null
          total_customer_paid: number
          tracking_id: string | null
          updated_at: string | null
        }
        Insert: {
          cod_amount?: number
          cod_fee?: number
          courier_delivery_charge?: number
          courier_name: string
          courier_return_charge?: number | null
          courier_subsidy?: number | null
          courier_zone?: string | null
          created_at?: string | null
          customer_return_paid?: number | null
          customer_shipping_fee?: number | null
          delivered_date?: string | null
          id?: string
          invoice_id?: string | null
          is_partial?: boolean | null
          is_settled?: boolean | null
          net_receivable?: number | null
          order_id?: string | null
          partial_cod_fee_delivered?: number | null
          partial_confirmed_at?: string | null
          partial_confirmed_by?: string | null
          partial_courier_charge_delivered?: number | null
          partial_courier_charge_returned?: number | null
          partial_delivered_qty?: number | null
          partial_delivered_revenue?: number | null
          partial_returned_qty?: number | null
          product_price?: number
          return_net?: number | null
          return_type?: string | null
          settled_amount?: number | null
          settlement_difference?: number | null
          settlement_id?: string | null
          shipped_date?: string | null
          status?: string | null
          total_customer_paid?: number
          tracking_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cod_amount?: number
          cod_fee?: number
          courier_delivery_charge?: number
          courier_name?: string
          courier_return_charge?: number | null
          courier_subsidy?: number | null
          courier_zone?: string | null
          created_at?: string | null
          customer_return_paid?: number | null
          customer_shipping_fee?: number | null
          delivered_date?: string | null
          id?: string
          invoice_id?: string | null
          is_partial?: boolean | null
          is_settled?: boolean | null
          net_receivable?: number | null
          order_id?: string | null
          partial_cod_fee_delivered?: number | null
          partial_confirmed_at?: string | null
          partial_confirmed_by?: string | null
          partial_courier_charge_delivered?: number | null
          partial_courier_charge_returned?: number | null
          partial_delivered_qty?: number | null
          partial_delivered_revenue?: number | null
          partial_returned_qty?: number | null
          product_price?: number
          return_net?: number | null
          return_type?: string | null
          settled_amount?: number | null
          settlement_difference?: number | null
          settlement_id?: string | null
          shipped_date?: string | null
          status?: string | null
          total_customer_paid?: number
          tracking_id?: string | null
          updated_at?: string | null
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
          {
            foreignKeyName: "shipments_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "cod_settlements"
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
      supplier_payment_allocations: {
        Row: {
          allocated_amount: number
          created_at: string | null
          id: string
          payable_id: string
          payable_type: string
          payment_id: string
        }
        Insert: {
          allocated_amount?: number
          created_at?: string | null
          id?: string
          payable_id: string
          payable_type?: string
          payment_id: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string | null
          id?: string
          payable_id?: string
          payable_type?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "supplier_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          journal_id: string | null
          notes: string | null
          paid_from_account_id: string | null
          payment_date: string
          payment_method: string
          payment_number: string
          reference: string | null
          status: string
          supplier_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          journal_id?: string | null
          notes?: string | null
          paid_from_account_id?: string | null
          payment_date?: string
          payment_method?: string
          payment_number: string
          reference?: string | null
          status?: string
          supplier_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          journal_id?: string | null
          notes?: string | null
          paid_from_account_id?: string | null
          payment_date?: string
          payment_method?: string
          payment_number?: string
          reference?: string | null
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_paid_from_account_id_fkey"
            columns: ["paid_from_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_financials"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          agent_id: string | null
          alipay_id: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          company_name: string | null
          contact_person: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          email: string | null
          id: string
          is_active: boolean | null
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
          updated_at: string | null
          usdt_network: string | null
          usdt_wallet: string | null
          wechat_id: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          agent_id?: string | null
          alipay_id?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
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
          updated_at?: string | null
          usdt_network?: string | null
          usdt_wallet?: string | null
          wechat_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          agent_id?: string | null
          alipay_id?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
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
          updated_at?: string | null
          usdt_network?: string | null
          usdt_wallet?: string | null
          wechat_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
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
      ugc_creators: {
        Row: {
          contact: string | null
          content_type: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          rate_per_video: number | null
          status: string
          updated_at: string
        }
        Insert: {
          contact?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          rate_per_video?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          rate_per_video?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ugc_orders: {
        Row: {
          amount_paid: number
          campaign_name: string | null
          created_at: string
          creator_id: string
          delivery_status: string
          id: string
          notes: string | null
          payment_method: string | null
          payment_status: string
          posting_event_id: string | null
          product_id: string | null
          proof_url: string | null
          total_cost: number
          updated_at: string
          video_count: number
        }
        Insert: {
          amount_paid?: number
          campaign_name?: string | null
          created_at?: string
          creator_id: string
          delivery_status?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          posting_event_id?: string | null
          product_id?: string | null
          proof_url?: string | null
          total_cost?: number
          updated_at?: string
          video_count?: number
        }
        Update: {
          amount_paid?: number
          campaign_name?: string | null
          created_at?: string
          creator_id?: string
          delivery_status?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          posting_event_id?: string | null
          product_id?: string | null
          proof_url?: string | null
          total_cost?: number
          updated_at?: string
          video_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ugc_orders_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "ugc_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_orders_posting_event_id_fkey"
            columns: ["posting_event_id"]
            isOneToOne: false
            referencedRelation: "posting_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
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
      v_stock_onhand: {
        Row: {
          available: number | null
          avg_unit_cost: number | null
          damaged: number | null
          in_transit: number | null
          last_movement: string | null
          product_id: string | null
          reserved: number | null
          sku: string | null
          total_physical: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profit_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_on_hand"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_supplier_financials: {
        Row: {
          open_po_count: number | null
          supplier_id: string | null
          total_due: number | null
          total_paid: number | null
          total_purchase_value: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_inventory: {
        Args: {
          p_product_id: string
          p_qty_change: number
          p_reason: string
          p_sku: string
          p_user_id: string
        }
        Returns: undefined
      }
      apply_scan_action: {
        Args: { p_action: string; p_order_id: string; p_reason?: string }
        Returns: Json
      }
      balance_snapshot_report: {
        Args: { p_as_of_date: string; p_include_zero?: boolean }
        Returns: Json
      }
      calc_cod_fee: {
        Args: { p_cod_amount: number; p_courier: string; p_zone: string }
        Returns: number
      }
      calc_weighted_avg_cost: {
        Args: { p_new_cost: number; p_new_qty: number; p_product_id: string }
        Returns: number
      }
      cashflow_drilldown: {
        Args: {
          p_account_codes?: string[]
          p_date_from: string
          p_date_to: string
          p_direction: string
          p_ref_type: string
        }
        Returns: Json
      }
      cashflow_report: {
        Args: {
          p_account_codes?: string[]
          p_date_from?: string
          p_date_to?: string
          p_include_transfers?: boolean
        }
        Returns: Json
      }
      close_accounting_period: {
        Args: { p_closed_by?: string; p_period_key: string }
        Returns: undefined
      }
      courier_performance_drilldown: {
        Args: { p_courier_id: string; p_date_from: string; p_date_to: string }
        Returns: Json
      }
      courier_performance_report: {
        Args: { p_date_from: string; p_date_to: string }
        Returns: Json
      }
      dashboard_14day_trend: { Args: never; Returns: Json }
      dashboard_alerts: { Args: never; Returns: Json }
      dashboard_cash_position: { Args: never; Returns: Json }
      dashboard_today_kpis: { Args: never; Returns: Json }
      dashboard_working_capital: { Args: never; Returns: Json }
      executive_report: {
        Args: { p_date_from: string; p_date_to: string }
        Returns: Json
      }
      expense_analytics_drilldown: {
        Args: { p_category: string; p_date_from: string; p_date_to: string }
        Returns: Json
      }
      expense_analytics_report: {
        Args: { p_date_from: string; p_date_to: string }
        Returns: Json
      }
      export_all_orders: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_search?: string
          p_source?: string[]
          p_status?: string[]
        }
        Returns: Json
      }
      finance_account_balances: { Args: never; Returns: Json }
      finance_account_transactions:
        | { Args: { p_account_id: string; p_limit?: number }; Returns: Json }
        | {
            Args: {
              p_account_id: string
              p_date_from?: string
              p_date_to?: string
              p_limit?: number
              p_reference_type?: string
              p_search?: string
            }
            Returns: Json
          }
      finance_adjust_opening: {
        Args: {
          p_account_id: string
          p_entry_date?: string
          p_new_balance: number
          p_note: string
        }
        Returns: string
      }
      finance_alerts: { Args: never; Returns: Json }
      finance_deposit: {
        Args: {
          p_account_id: string
          p_amount: number
          p_entry_date?: string
          p_note: string
        }
        Returns: string
      }
      finance_posting_queue_summary: { Args: never; Returns: Json }
      finance_settlement_summary: { Args: never; Returns: Json }
      finance_transfer: {
        Args: {
          p_amount: number
          p_entry_date?: string
          p_from_account_id: string
          p_note: string
          p_to_account_id: string
        }
        Returns: string
      }
      finance_withdraw: {
        Args: {
          p_account_id: string
          p_amount: number
          p_entry_date?: string
          p_note: string
        }
        Returns: string
      }
      find_order_by_scan: { Args: { p_scan_text: string }; Returns: Json }
      general_ledger_lines: {
        Args: {
          p_account_id?: string
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: Json
      }
      generate_invoice_id: { Args: never; Returns: string }
      get_exchange_rate: {
        Args: { p_currency: string; p_date: string }
        Returns: number
      }
      global_search: {
        Args: { p_limit?: number; p_query: string }
        Returns: Json
      }
      inventory_ledger_drilldown: {
        Args: { p_as_of_date?: string; p_product_id: string }
        Returns: Json
      }
      inventory_valuation_report: {
        Args: {
          p_active_only?: boolean
          p_as_of_date?: string
          p_include_zero_stock?: boolean
        }
        Returns: Json
      }
      journal_entry_detail: { Args: { p_journal_id: string }; Returns: Json }
      list_all_orders: {
        Args: {
          p_amount_max?: number
          p_amount_min?: number
          p_courier?: string[]
          p_date_from?: string
          p_date_to?: string
          p_delivered_from?: string
          p_delivered_to?: string
          p_exceptions_only?: boolean
          p_has_advance?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_settlement_status?: string
          p_source?: string[]
          p_status?: string[]
          p_sync_status?: string
        }
        Returns: Json
      }
      list_posting_events:
        | {
            Args: {
              p_event_type?: string
              p_limit?: number
              p_offset?: number
              p_search?: string
              p_status?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_date_from?: string
              p_date_to?: string
              p_event_type?: string
              p_limit?: number
              p_offset?: number
              p_search?: string
              p_status?: string
            }
            Returns: Json
          }
      marketing_dashboard_report: {
        Args: { p_date_from?: string; p_date_to?: string }
        Returns: Json
      }
      pnl_account_drilldown: {
        Args: { p_account_code: string; p_date_from: string; p_date_to: string }
        Returns: Json
      }
      post_cod_received: {
        Args: {
          p_amount: number
          p_cash_account?: string
          p_entry_date?: string
          p_order_id: string
        }
        Returns: string
      }
      post_event: { Args: { p_event_id: string }; Returns: string }
      post_expense_entry: {
        Args: {
          p_amount: number
          p_entry_date?: string
          p_expense_account_id?: string
          p_expense_id: string
          p_pay_account?: string
        }
        Returns: string
      }
      post_grn: {
        Args: { p_amount: number; p_entry_date?: string; p_grn_id: string }
        Returns: string
      }
      post_landed_cost: {
        Args: {
          p_amount: number
          p_entry_date?: string
          p_landed_cost_id: string
          p_pay_account_id: string
        }
        Returns: string
      }
      post_order_delivered: {
        Args: {
          p_cogs: number
          p_courier_receivable: number
          p_entry_date?: string
          p_order_id: string
          p_product_sales: number
          p_shipping_income: number
        }
        Returns: string
      }
      post_purchase_receive: {
        Args: { p_amount: number; p_entry_date?: string; p_grn_id: string }
        Returns: string
      }
      post_settlement_line: {
        Args: { p_line_id: string; p_receiving_account_id: string }
        Returns: string
      }
      post_supplier_payment: {
        Args: {
          p_amount: number
          p_entry_date?: string
          p_pay_account_id: string
          p_payment_id: string
        }
        Returns: string
      }
      posting_queue_counts: { Args: never; Returns: Json }
      preview_event_journal: { Args: { p_event_id: string }; Returns: Json }
      procurement_dashboard_report: {
        Args: { p_month_start?: string }
        Returns: Json
      }
      profit_loss_report: {
        Args: { p_date_from?: string; p_date_to?: string }
        Returns: Json
      }
      reopen_accounting_period: {
        Args: { p_period_key: string }
        Returns: undefined
      }
      reverse_event: {
        Args: { p_event_id: string; p_reason: string }
        Returns: string
      }
      reverse_journal_entry: {
        Args: { p_journal_id: string; p_reason?: string }
        Returns: string
      }
      reverse_ledger_entry: {
        Args: { p_entry_id: string; p_reason: string; p_user_id: string }
        Returns: string
      }
      settlement_auto_match: { Args: { p_batch_id: string }; Returns: Json }
      settlement_manual_match: {
        Args: { p_line_id: string; p_order_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sku_order_drilldown: {
        Args: { p_date_from?: string; p_date_to?: string; p_product_id: string }
        Returns: Json
      }
      sku_profitability_report: {
        Args: { p_date_from?: string; p_date_to?: string }
        Returns: Json
      }
      supplier_payable_detail: {
        Args: { p_supplier_id: string }
        Returns: Json
      }
      supplier_payables_aging: { Args: never; Returns: Json }
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
