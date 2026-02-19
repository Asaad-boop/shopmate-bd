import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Stock adjustment logic per status change
const STOCK_INCREASE_STATUSES = ["cancelled", "returned"];
const STOCK_DECREASE_STATUSES = ["pending"];
const NO_STOCK_STATUSES = ["packed", "shipped", "delivered", "pending_return", "damage_return"];

export interface StockImpact {
  productId: string;
  productName: string;
  quantity: number;
  currentStock: number;
  newStock: number;
  action: "decrease" | "increase" | "none";
}

export async function getStockImpact(
  orderId: string,
  newStatus: string
): Promise<StockImpact[]> {
  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, quantity, products(id, name, stock_quantity)")
    .eq("order_id", orderId);

  if (!items) return [];

  return items.map((item: any) => {
    const product = item.products;
    const currentStock = product?.stock_quantity || 0;
    let action: "decrease" | "increase" | "none" = "none";
    let newStock = currentStock;

    if (STOCK_DECREASE_STATUSES.includes(newStatus)) {
      action = "decrease";
      newStock = currentStock - item.quantity;
    } else if (STOCK_INCREASE_STATUSES.includes(newStatus)) {
      action = "increase";
      newStock = currentStock + item.quantity;
    }

    return {
      productId: product?.id || item.product_id,
      productName: product?.name || "Unknown",
      quantity: item.quantity,
      currentStock,
      newStock,
      action,
    };
  });
}

export async function applyStatusChange(
  orderId: string,
  newStatus: string,
  oldStatus: string | null
) {
  // Update order status
  await supabase
    .from("orders")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  // Get order items
  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, quantity, products(id, name, stock_quantity)")
    .eq("order_id", orderId);

  if (!items) return;

  const movementType = `order_${newStatus}`;

  for (const item of items) {
    const product = item.products as any;
    if (!product?.id) continue;

    let stockChange = 0;
    if (STOCK_DECREASE_STATUSES.includes(newStatus)) {
      stockChange = -item.quantity;
    } else if (STOCK_INCREASE_STATUSES.includes(newStatus)) {
      stockChange = item.quantity;
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
        notes: `Status changed: ${oldStatus || "none"} → ${newStatus}`,
      });
    }
  }
}

export async function applyDamageReturn(
  orderId: string,
  damageItems: { productId: string; quantity: number; condition: string; description: string }[]
) {
  // Update order status
  await supabase
    .from("orders")
    .update({ status: "damage_return", updated_at: new Date().toISOString() })
    .eq("id", orderId);

  // Insert damage log entries (no stock change)
  for (const item of damageItems) {
    await supabase.from("damage_log" as any).insert({
      order_id: orderId,
      product_id: item.productId,
      quantity: item.quantity,
      condition: item.condition,
      description: item.description,
    });

    // Create inventory movement for tracking (0 stock change)
    await supabase.from("inventory_movements").insert({
      product_id: item.productId,
      movement_type: "damage_return",
      quantity: 0,
      reference_type: "order",
      reference_id: orderId,
      notes: `Damage return: ${item.condition} - ${item.description}`,
    });
  }
}
