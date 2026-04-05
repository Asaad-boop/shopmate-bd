/**
 * ShopMate BD — Shared Domain Types
 *
 * এই file থেকে সব component types import করবে।
 * Supabase generated types থেকে derive করা — তাই DB schema change হলে এখানেও আপডেট হবে।
 *
 * Usage:
 *   import type { Order, OrderItem, Product, Customer } from "@/types";
 */

import type { Database } from "@/integrations/supabase/types";

// ─── Supabase Row helpers ───────────────────────────────────────────────────

type Tables = Database["public"]["Tables"];

// ─── ORDER ──────────────────────────────────────────────────────────────────

/** Full order row from the `orders` table */
export type Order = Tables["orders"]["Row"];

/** Subset used in list views (lighter payload) */
export type OrderSummary = Pick<
  Order,
  | "id"
  | "order_number"
  | "status"
  | "total_amount"
  | "cod_amount"
  | "delivery_address"
  | "delivery_district"
  | "delivery_thana"
  | "channel"
  | "order_date"
  | "created_at"
  | "courier_status"
  | "courier_sync_status"
  | "payment_method"
  | "payment_status"
  | "customer_id"
  | "notes"
  | "tags"
  | "preorder_flag"
  | "return_pending"
  | "web_order_status"
  | "web_order_id"
  | "shopify_order_id"
  | "shopify_order_number"
  | "pathao_tracking_code"
  | "pathao_consignment_id"
  | "assigned_to"
>;

/**
 * Web orders are regular orders from Shopify channel.
 * They have a non-null `web_order_status` field.
 */
export type WebOrder = Order & {
  web_order_status: string;
  customers?: Partial<Customer> | null;
};

/** Status values for web/Shopify orders */
export type WebOrderStatus =
  | "processing"
  | "confirm"
  | "good_but_no_response"
  | "no_response"
  | "on_hold"
  | "advance_payment"
  | "cancel";

/** Order status values for fulfilment orders */
export type OrderStatus =
  | "pending"
  | "packed"
  | "ready_to_ship"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "delivery_failed"
  | "return_requested"
  | "return_in_transit"
  | "returned"
  | "partially_delivered"
  | "exchanged"
  | "completed"
  | "cancelled"
  | "damage_return"
  | "pending_return";

// ─── ORDER ITEM ─────────────────────────────────────────────────────────────

/** Full order item row */
export type OrderItem = Tables["order_items"]["Row"];

/**
 * Order item with joined product data.
 * Present when query includes `.select('*, products(*)')`.
 */
export type OrderItemWithProduct = OrderItem & {
  products: Product | null;
};

// ─── PRODUCT ────────────────────────────────────────────────────────────────

/** Full product row */
export type Product = Tables["products"]["Row"];

/** Lightweight product for dropdowns / search */
export type ProductOption = Pick<
  Product,
  "id" | "name" | "sku" | "selling_price" | "stock_quantity" | "avg_cost" | "unit"
>;

// ─── CUSTOMER ───────────────────────────────────────────────────────────────

/** Full customer row */
export type Customer = Tables["customers"]["Row"];

/** Computed segment label */
export type CustomerSegment =
  | "new"
  | "active"
  | "inactive"
  | "lost"
  | "silver"
  | "gold"
  | "diamond";

// ─── COURIER ────────────────────────────────────────────────────────────────

export type Courier = Tables["couriers"]["Row"];
export type CourierShipment = Tables["courier_shipments"]["Row"];
export type CourierHistoryEntry = Tables["courier_history"]["Row"];
export type CourierRateCard = Tables["courier_rate_cards"]["Row"];

// ─── GENERIC UTILITIES ───────────────────────────────────────────────────────

/**
 * Safe error message extractor — catch block এ use করো।
 * ❌ Bad:  } catch (err: any) { toast(err.message) }
 * ✅ Good: } catch (err) { toast(getErrorMessage(err)) }
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (
    err !== null &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as Record<string, unknown>).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "একটি error হয়েছে। আবার চেষ্টা করুন।";
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface SelectOption<T extends string = string> {
  label: string;
  value: T;
}

export interface QueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

// ─── WEB ORDER NOTE ──────────────────────────────────────────────────────────

export type WebOrderNote = Tables["web_order_notes"]["Row"];

// ─── FINANCE / ACCOUNTING ─────────────────────────────────────────────────

export type Transaction = Tables["transactions"]["Row"];
export type JournalEntry = Tables["journal_entries"]["Row"];
export type JournalLine = Tables["journal_lines"]["Row"];
export type Expense = Tables["expenses"]["Row"];
export type Payable = Tables["payables"]["Row"];

// ─── HRM ─────────────────────────────────────────────────────────────────────

export type Employee = Tables["employees"]["Row"];
export type Department = Tables["departments"]["Row"];
export type HrmPayroll = Tables["hrm_payroll"]["Row"];
export type HrmLeaveRequest = Tables["hrm_leave_requests"]["Row"];
export type HrmTask = Tables["hrm_tasks"]["Row"];

// ─── INVENTORY ────────────────────────────────────────────────────────────────

export type InventoryMovement = Tables["inventory_movements"]["Row"];
export type InventoryLedger = Tables["inventory_ledger"]["Row"];
export type PurchaseOrder = Tables["purchase_orders"]["Row"];
export type PurchaseOrderItem = Tables["purchase_order_items"]["Row"];
export type Supplier = Tables["suppliers"]["Row"];

// ─── CRM ─────────────────────────────────────────────────────────────────────

export type CustomerFollowup = Tables["customer_followups"]["Row"];
export type Lead = Tables["leads"]["Row"];
