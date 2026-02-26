import { supabase } from "@/integrations/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   ORDER STATUS ENGINE — Bangladesh COD ERP
   Handles: validation → inventory → shipments → accounting
   ═══════════════════════════════════════════════════════════════ */

// ────────── Strict transition map ──────────
const TRANSITIONS: Record<string, string[]> = {
  pending:           ["packed", "cancelled"],
  packed:            ["ready_to_ship", "pending", "cancelled"],
  ready_to_ship:     ["shipped", "packed", "cancelled"],
  shipped:           ["in_transit", "delivered", "delivery_failed"],
  in_transit:        ["delivered", "delivery_failed"],
  delivered:         ["return_requested", "partially_delivered", "completed"],
  delivery_failed:   ["return_in_transit", "shipped"],
  return_requested:  ["return_in_transit"],
  return_in_transit: ["returned", "damage_return"],
  returned:          [],
  partially_delivered: ["completed"],
  exchanged:         [],
  completed:         [],
  cancelled:         [],
  damage_return:     [],
  pending_return:    ["returned", "damage_return"],
};

export function isTransitionAllowed(from: string, to: string): boolean {
  return (TRANSITIONS[from] || []).includes(to);
}

export function getAllowedTransitions(from: string): string[] {
  return TRANSITIONS[from] || [];
}

// ────────── Inventory Impact ──────────

export interface StockImpact {
  productId: string;
  productName: string;
  quantity: number;
  currentStock: number;
  newStock: number;
  action: "decrease" | "increase" | "none";
  detail: string;
}

/*
  Inventory rules by status:
  - pending → packed:          reserve stock (decrease available)
  - packed → pending:          unreserve (increase available)
  - cancelled (from pending/packed/rts): release reserved (increase)
  - returned:                  return to stock (increase)
  - delivered:                 no stock move (already deducted at packed)
  - damage_return:             no stock increase (damaged goods)
*/
const STOCK_DECREASE_ON = ["packed"];       // reserve on pack
const STOCK_INCREASE_ON = ["cancelled", "returned"]; // release on cancel/return
const STOCK_RELEASE_FROM = ["pending", "packed", "ready_to_ship"]; // cancel only releases if was reserved

export async function getStockImpact(
  orderId: string,
  newStatus: string,
  oldStatus?: string
): Promise<StockImpact[]> {
  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, quantity, products(id, name, sku, stock_quantity)")
    .eq("order_id", orderId);

  if (!items) return [];

  return items.map((item: any) => {
    const product = item.products;
    const currentStock = product?.stock_quantity || 0;
    let action: "decrease" | "increase" | "none" = "none";
    let newStock = currentStock;
    let detail = "No stock change";

    if (STOCK_DECREASE_ON.includes(newStatus)) {
      action = "decrease";
      newStock = currentStock - item.quantity;
      detail = "Stock reserved (packed)";
    } else if (newStatus === "cancelled" && oldStatus && STOCK_RELEASE_FROM.includes(oldStatus)) {
      // Only release if stock was actually reserved
      if (oldStatus !== "pending") {
        action = "increase";
        newStock = currentStock + item.quantity;
        detail = "Stock released (cancelled)";
      } else {
        detail = "No stock reserved yet";
      }
    } else if (newStatus === "returned") {
      action = "increase";
      newStock = currentStock + item.quantity;
      detail = "Stock returned to available";
    } else if (newStatus === "damage_return") {
      detail = "Damaged — no stock increase";
    } else if (newStatus === "delivered") {
      detail = "Revenue recognition triggered";
    }

    return {
      productId: product?.id || item.product_id,
      productName: product?.name || "Unknown",
      quantity: item.quantity,
      currentStock,
      newStock,
      action,
      detail,
    };
  });
}

// ────────── Ledger entries for delivery ──────────

interface LedgerPreview {
  account: string;
  debit: number;
  credit: number;
}

export function getDeliveryLedgerPreview(
  totalAmount: number,
  shippingAmount: number,
  cogsEstimate: number
): LedgerPreview[] {
  const productRevenue = totalAmount - shippingAmount;
  return [
    { account: "Courier Receivable", debit: totalAmount, credit: 0 },
    { account: "Product Sales Revenue", debit: 0, credit: productRevenue },
    { account: "Shipping Income", debit: 0, credit: shippingAmount },
    { account: "COGS", debit: cogsEstimate, credit: 0 },
    { account: "Inventory Asset", debit: 0, credit: cogsEstimate },
  ];
}

// ────────── Apply status change ──────────

export async function applyStatusChange(
  orderId: string,
  newStatus: string,
  oldStatus: string | null
) {
  const from = oldStatus || "pending";

  // 1. Validate transition
  if (!isTransitionAllowed(from, newStatus)) {
    throw new Error(`Invalid transition: ${from} → ${newStatus}`);
  }

  // 2. Update order
  const updatePayload: Record<string, any> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  // Set timestamps for key milestones
  if (newStatus === "packed") updatePayload.packed_at = new Date().toISOString();
  if (newStatus === "shipped") updatePayload.shipped_at = new Date().toISOString();
  if (newStatus === "delivered") updatePayload.delivered_at = new Date().toISOString();

  await supabase.from("orders").update(updatePayload).eq("id", orderId);

  // 3. Handle inventory
  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, quantity, unit_price, products(id, name, stock_quantity, cost_price)")
    .eq("order_id", orderId);

  if (items) {
    for (const item of items as any[]) {
      const product = item.products;
      if (!product?.id) continue;

      let stockChange = 0;
      let movementType = `order_${newStatus}`;
      let notes = `Status: ${from} → ${newStatus}`;

      if (newStatus === "packed") {
        stockChange = -item.quantity;
        notes = "Stock reserved for packing";
      } else if (newStatus === "cancelled" && from !== "pending" && STOCK_RELEASE_FROM.includes(from)) {
        stockChange = item.quantity;
        notes = "Stock released — order cancelled";
      } else if (newStatus === "returned") {
        stockChange = item.quantity;
        notes = "Stock returned to available";
      }

      if (stockChange !== 0) {
        // Update product stock
        await supabase
          .from("products")
          .update({
            stock_quantity: (product.stock_quantity || 0) + stockChange,
            updated_at: new Date().toISOString(),
          })
          .eq("id", product.id);

        // Create inventory movement
        await supabase.from("inventory_movements").insert({
          product_id: product.id,
          movement_type: movementType,
          quantity: stockChange,
          reference_type: "order",
          reference_id: orderId,
          notes,
        });
      }
    }

    // 4. Accounting: create posting event for delivered orders
    if (newStatus === "delivered") {
      const { data: order } = await supabase
        .from("orders")
        .select("total_amount, invoice_id")
        .eq("id", orderId)
        .single();

      if (order) {
        let totalCogs = 0;
        for (const item of items as any[]) {
          const costPrice = item.products?.cost_price || 0;
          totalCogs += costPrice * item.quantity;
        }

        // Insert posting queue event (to be reviewed & posted by Finance)
        try {
          await supabase.from("posting_queue" as any).insert({
            event_type: "delivery",
            reference_type: "order",
            reference_id: orderId,
            reference_label: order.invoice_id || orderId,
            amount: order.total_amount || 0,
            status: "pending",
            payload: {
              total_amount: order.total_amount,
              shipping_charge: 0,
              cogs: totalCogs,
            },
          });
        } catch {
          // Posting queue may not exist — silently skip
        }
      }
    }
  }

  // 5. Courier sync placeholder for shipped
  if (newStatus === "shipped") {
    // Future: auto-book with Pathao/Steadfast/RedX API
    console.log(`[CourierSync] Order ${orderId} ready for courier booking`);
  }
}

// ────────── Damage return ──────────

export async function applyDamageReturn(
  orderId: string,
  damageItems: { productId: string; quantity: number; condition: string; description: string }[]
) {
  await supabase
    .from("orders")
    .update({ status: "damage_return", updated_at: new Date().toISOString() })
    .eq("id", orderId);

  for (const item of damageItems) {
    await supabase.from("damage_log" as any).insert({
      order_id: orderId,
      product_id: item.productId,
      quantity: item.quantity,
      condition: item.condition,
      description: item.description,
    });

    await supabase.from("inventory_movements").insert({
      product_id: item.productId,
      movement_type: "damage_return",
      quantity: 0,
      reference_type: "order",
      reference_id: orderId,
      notes: `Damage return: ${item.condition} — ${item.description}`,
    });
  }
}

// ────────── Courier sync placeholder ──────────

export async function syncWithCourier(orderId: string, courierName: string): Promise<{ success: boolean; trackingId?: string; error?: string }> {
  // Placeholder for courier API integration
  // Future: call Pathao/Steadfast/RedX edge function
  console.log(`[CourierSync] Booking order ${orderId} with ${courierName}`);
  return {
    success: false,
    error: `${courierName} API integration pending`,
  };
}

// ────────── Bulk status engine ──────────

export interface BulkResult {
  success: number;
  skipped: number;
  errors: string[];
}

export async function applyBulkStatusChange(
  orderIds: string[],
  newStatus: string,
  orders: any[]
): Promise<BulkResult> {
  const result: BulkResult = { success: 0, skipped: 0, errors: [] };

  for (const id of orderIds) {
    const order = orders.find((o) => o.id === id);
    if (!order) { result.skipped++; continue; }

    const from = order.status || "pending";
    if (!isTransitionAllowed(from, newStatus)) {
      result.skipped++;
      result.errors.push(`#${order.invoice_id || order.order_number}: ${from} → ${newStatus} not allowed`);
      continue;
    }

    try {
      await applyStatusChange(id, newStatus, from);
      result.success++;
    } catch (e: any) {
      result.errors.push(`#${order.invoice_id || order.order_number}: ${e.message}`);
    }
  }

  return result;
}
