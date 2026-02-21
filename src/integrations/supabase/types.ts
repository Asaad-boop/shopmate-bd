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
      accounts: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          name: string
          type: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          name: string
          type?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
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
          last_order_date: string | null
          notes: string | null
          phone: string
          phone2: string | null
          segment: string | null
          source: string | null
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
          last_order_date?: string | null
          notes?: string | null
          phone: string
          phone2?: string | null
          segment?: string | null
          source?: string | null
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
          last_order_date?: string | null
          notes?: string | null
          phone?: string
          phone2?: string | null
          segment?: string | null
          source?: string | null
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
          quantity: number
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
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
        ]
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
      order_items: {
        Row: {
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
        ]
      }
      orders: {
        Row: {
          assigned_to: string | null
          channel: string
          cod_amount: number | null
          cost_of_goods: number | null
          courier_charge: number | null
          courier_status: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivery_address: string | null
          delivery_charge: number | null
          delivery_district: string | null
          delivery_thana: string | null
          discount: number | null
          gross_profit: number | null
          id: string
          notes: string | null
          order_date: string | null
          order_number: string
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
          assigned_to?: string | null
          channel: string
          cod_amount?: number | null
          cost_of_goods?: number | null
          courier_charge?: number | null
          courier_status?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivery_address?: string | null
          delivery_charge?: number | null
          delivery_district?: string | null
          delivery_thana?: string | null
          discount?: number | null
          gross_profit?: number | null
          id?: string
          notes?: string | null
          order_date?: string | null
          order_number: string
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
          assigned_to?: string | null
          channel?: string
          cod_amount?: number | null
          cost_of_goods?: number | null
          courier_charge?: number | null
          courier_status?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivery_address?: string | null
          delivery_charge?: number | null
          delivery_district?: string | null
          delivery_thana?: string | null
          discount?: number | null
          gross_profit?: number | null
          id?: string
          notes?: string | null
          order_date?: string | null
          order_number?: string
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
      products: {
        Row: {
          available_quantity: number | null
          category_id: string | null
          cbm: number | null
          china_price_cny: number | null
          china_price_usd: number | null
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
          category_id?: string | null
          cbm?: number | null
          china_price_cny?: number | null
          china_price_usd?: number | null
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
          category_id?: string | null
          cbm?: number | null
          china_price_cny?: number | null
          china_price_usd?: number | null
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
          defective_quantity: number | null
          id: string
          notes: string | null
          product_id: string | null
          purchase_order_id: string | null
          quantity: number
          received_quantity: number | null
          total_price_usd: number | null
          unit_price_cny: number | null
          unit_price_usd: number | null
        }
        Insert: {
          defective_quantity?: number | null
          id?: string
          notes?: string | null
          product_id?: string | null
          purchase_order_id?: string | null
          quantity: number
          received_quantity?: number | null
          total_price_usd?: number | null
          unit_price_cny?: number | null
          unit_price_usd?: number | null
        }
        Update: {
          defective_quantity?: number | null
          id?: string
          notes?: string | null
          product_id?: string | null
          purchase_order_id?: string | null
          quantity?: number
          received_quantity?: number | null
          total_price_usd?: number | null
          unit_price_cny?: number | null
          unit_price_usd?: number | null
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
          advance_paid_bdt: number | null
          bl_number: string | null
          c_and_f_charge_bdt: number | null
          container_number: string | null
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
          id: string
          local_transport_bdt: number | null
          notes: string | null
          order_date: string
          other_charges_bdt: number | null
          payment_status: string | null
          po_number: string
          port_of_discharge: string | null
          port_of_loading: string | null
          remaining_payment_bdt: number | null
          shipping_method: string | null
          status: string | null
          supplier_id: string | null
          total_landed_cost_bdt: number | null
          total_product_cost_cny: number | null
          total_product_cost_usd: number | null
          updated_at: string | null
        }
        Insert: {
          actual_arrival_date?: string | null
          actual_shipment_date?: string | null
          advance_paid_bdt?: number | null
          bl_number?: string | null
          c_and_f_charge_bdt?: number | null
          container_number?: string | null
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
          id?: string
          local_transport_bdt?: number | null
          notes?: string | null
          order_date: string
          other_charges_bdt?: number | null
          payment_status?: string | null
          po_number: string
          port_of_discharge?: string | null
          port_of_loading?: string | null
          remaining_payment_bdt?: number | null
          shipping_method?: string | null
          status?: string | null
          supplier_id?: string | null
          total_landed_cost_bdt?: number | null
          total_product_cost_cny?: number | null
          total_product_cost_usd?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_arrival_date?: string | null
          actual_shipment_date?: string | null
          advance_paid_bdt?: number | null
          bl_number?: string | null
          c_and_f_charge_bdt?: number | null
          container_number?: string | null
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
          id?: string
          local_transport_bdt?: number | null
          notes?: string | null
          order_date?: string
          other_charges_bdt?: number | null
          payment_status?: string | null
          po_number?: string
          port_of_discharge?: string | null
          port_of_loading?: string | null
          remaining_payment_bdt?: number | null
          shipping_method?: string | null
          status?: string | null
          supplier_id?: string | null
          total_landed_cost_bdt?: number | null
          total_product_cost_cny?: number | null
          total_product_cost_usd?: number | null
          updated_at?: string | null
        }
        Relationships: [
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
          rating: number | null
          status: string | null
          total_amount: number | null
          total_orders: number | null
          wechat_id: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
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
          rating?: number | null
          status?: string | null
          total_amount?: number | null
          total_orders?: number | null
          wechat_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
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
          rating?: number | null
          status?: string | null
          total_amount?: number | null
          total_orders?: number | null
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
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          transaction_date: string | null
          type: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string | null
          type: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
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
