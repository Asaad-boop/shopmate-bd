import { supabase } from "@/integrations/supabase/client";

interface FinalizeResult {
  success: boolean;
  journalIds: string[];
  exceptions: string[];
}

export async function finalizeLegacyOrder(orderId: string): Promise<FinalizeResult> {
  const journalIds: string[] = [];
  const exceptions: string[] = [];

  // Fetch order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*, order_items(id, product_id, quantity, unit_price, total_price, products(id, name, sku, cost_price))")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    return { success: false, journalIds: [], exceptions: ["Order not found"] };
  }

  if ((order as any).legacy_finalized) {
    return { success: false, journalIds: [], exceptions: ["Already finalized"] };
  }

  if ((order as any).order_source !== "LEGACY") {
    return { success: false, journalIds: [], exceptions: ["Not a legacy order"] };
  }

  const items = (order.order_items || []) as any[];
  const status = order.status || "pending";

  // Validate required data
  const totalAmount = order.total_amount || 0;
  const deliveryCharge = order.delivery_charge || 0;
  const subtotal = order.subtotal || totalAmount - deliveryCharge;

  // Calculate COGS
  let totalCogs = 0;
  for (const item of items) {
    const costPrice = item.products?.cost_price || item.unit_price || 0;
    totalCogs += costPrice * item.quantity;
  }

  if (totalAmount <= 0) {
    exceptions.push("Order total is zero or negative");
  }

  // Post GL entries based on status
  if (status === "delivered") {
    // Need COGS
    if (totalCogs <= 0) {
      exceptions.push("COGS is zero — product cost_price missing for one or more items");
    }

    // Post: Delivered journal
    try {
      const { data: jeData, error: jeErr } = await supabase.rpc("post_order_delivered", {
        p_order_id: orderId,
        p_product_sales: subtotal,
        p_shipping_income: deliveryCharge,
        p_cogs: totalCogs,
        p_courier_receivable: totalAmount,
        p_entry_date: (order as any).legacy_delivered_date || order.order_date || new Date().toISOString().slice(0, 10),
      });
      if (jeErr) throw jeErr;
      if (jeData) journalIds.push(jeData);
    } catch (err: any) {
      exceptions.push(`GL posting failed (delivered): ${err.message}`);
    }

    // Post: COD received (assume settled for legacy delivered orders)
    try {
      const { data: codJe, error: codErr } = await supabase.rpc("post_cod_received", {
        p_order_id: orderId,
        p_amount: totalAmount,
        p_entry_date: (order as any).legacy_delivered_date || order.order_date || new Date().toISOString().slice(0, 10),
        p_cash_account: "bank",
      });
      if (codErr) throw codErr;
      if (codJe) journalIds.push(codJe);
    } catch (err: any) {
      exceptions.push(`GL posting failed (COD received): ${err.message}`);
    }
  } else if (status === "returned" || status === "cancelled") {
    // No revenue posting needed for returned/cancelled
    // Could optionally post return cost — skip for legacy
  } else {
    exceptions.push(`Order status "${status}" is not final — cannot finalize. Must be delivered, returned, or cancelled.`);
  }

  // If there were exceptions, create them in exceptions table
  if (exceptions.length > 0 && journalIds.length === 0) {
    for (const exc of exceptions) {
      await supabase.from("exceptions").insert({
        code: "LEGACY_FINALIZE_INCOMPLETE",
        title: `Legacy finalize failed: ${order.order_number}`,
        description: exc,
        severity: "HIGH",
        status: "OPEN",
        source_module: "ORDERS",
        source_entity_type: "order",
        source_entity_id: orderId,
        detected_by: "SYSTEM",
        metadata: { legacy_order_id: (order as any).legacy_order_id, missing: exc },
      });
    }
    return { success: false, journalIds, exceptions };
  }

  // Mark as finalized
  await supabase
    .from("orders")
    .update({
      legacy_finalized: true,
      legacy_finalized_at: new Date().toISOString(),
      posting_mode: "ENABLED",
    } as any)
    .eq("id", orderId);

  return { success: true, journalIds, exceptions };
}
