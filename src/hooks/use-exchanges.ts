import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ExchangeRequest {
  id: string;
  order_id: string;
  exchange_number: string;
  status: string;
  reason: string;
  exchange_type: string;
  customer_phone: string | null;
  customer_name: string | null;
  price_difference: number;
  courier_cost_total: number;
  damaged_loss: number;
  net_exchange_cost: number;
  notes: string | null;
  approved_at: string | null;
  reverse_received_at: string | null;
  replacement_sent_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  // joined
  exchange_items?: ExchangeItem[];
  exchange_shipments?: ExchangeShipment[];
  orders?: { order_number: string; invoice_id: string | null; total_amount: number | null } | null;
}

export interface ExchangeItem {
  id: string;
  exchange_id: string;
  direction: string;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  condition: string;
  created_at: string;
}

export interface ExchangeShipment {
  id: string;
  exchange_id: string;
  shipment_type: string;
  courier_name: string | null;
  tracking_id: string | null;
  cod_amount: number;
  courier_cost: number;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
}

export const EXCHANGE_STATUS_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800", emoji: "🕐" },
  approved: { label: "Approved", color: "bg-blue-100 text-blue-800", emoji: "✅" },
  reverse_in_transit: { label: "Reverse In Transit", color: "bg-orange-100 text-orange-800", emoji: "🔙" },
  reverse_received: { label: "Reverse Received", color: "bg-cyan-100 text-cyan-800", emoji: "📥" },
  replacement_sent: { label: "Replacement Sent", color: "bg-indigo-100 text-indigo-800", emoji: "📤" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800", emoji: "🏁" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800", emoji: "❌" },
};

export const EXCHANGE_TRANSITIONS: Record<string, string[]> = {
  pending: ["approved", "cancelled"],
  approved: ["reverse_in_transit", "cancelled"],
  reverse_in_transit: ["reverse_received"],
  reverse_received: ["replacement_sent"],
  replacement_sent: ["completed"],
  completed: [],
  cancelled: [],
};

/** Fetch all exchanges with items & shipments */
export function useExchanges(statusFilter?: string) {
  return useQuery({
    queryKey: ["exchanges", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("exchange_requests")
        .select("*, exchange_items(*), exchange_shipments(*), orders(order_number, invoice_id, total_amount)")
        .order("created_at", { ascending: false });
      if (statusFilter && statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ExchangeRequest[];
    },
  });
}

/** Fetch exchanges for a specific order */
export function useOrderExchanges(orderId?: string) {
  return useQuery({
    queryKey: ["order-exchanges", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_requests")
        .select("*, exchange_items(*), exchange_shipments(*)")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ExchangeRequest[];
    },
  });
}

/** Create exchange request */
export function useCreateExchange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      order_id: string;
      reason: string;
      exchange_type: string;
      customer_phone?: string;
      customer_name?: string;
      notes?: string;
      return_items: { product_id: string; product_name: string; sku: string; quantity: number; unit_price: number; condition: string }[];
      replacement_items: { product_id: string; product_name: string; sku: string; quantity: number; unit_price: number }[];
    }) => {
      const returnTotal = params.return_items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const replaceTotal = params.replacement_items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const priceDiff = replaceTotal - returnTotal;

      // Create exchange request
      const { data: exReq, error: exErr } = await supabase
        .from("exchange_requests")
        .insert({
          order_id: params.order_id,
          reason: params.reason,
          exchange_type: params.exchange_type,
          customer_phone: params.customer_phone,
          customer_name: params.customer_name,
          price_difference: priceDiff,
          notes: params.notes,
        })
        .select()
        .single();
      if (exErr) throw exErr;

      // Insert return items
      const returnInserts = params.return_items.map((i) => ({
        exchange_id: exReq.id,
        direction: "return" as const,
        product_id: i.product_id,
        product_name: i.product_name,
        sku: i.sku,
        quantity: i.quantity,
        unit_price: i.unit_price,
        condition: i.condition,
      }));

      // Insert replacement items
      const replaceInserts = params.replacement_items.map((i) => ({
        exchange_id: exReq.id,
        direction: "replacement" as const,
        product_id: i.product_id,
        product_name: i.product_name,
        sku: i.sku,
        quantity: i.quantity,
        unit_price: i.unit_price,
      }));

      const allItems = [...returnInserts, ...replaceInserts];
      if (allItems.length > 0) {
        const { error: itemErr } = await supabase.from("exchange_items").insert(allItems);
        if (itemErr) throw itemErr;
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        entity_type: "exchange",
        entity_id: exReq.id,
        action: "exchange_created",
        after_json: { exchange_number: exReq.exchange_number, reason: params.reason, price_difference: priceDiff },
      });

      return exReq;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exchanges"] });
      qc.invalidateQueries({ queryKey: ["order-exchanges"] });
      toast({ title: "Exchange request created" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
}

/** Transition exchange status with business logic */
export function useExchangeTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { exchangeId: string; newStatus: string; notes?: string }) => {
      const { exchangeId, newStatus, notes } = params;

      const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === "approved") updates.approved_at = new Date().toISOString();
      if (newStatus === "reverse_received") updates.reverse_received_at = new Date().toISOString();
      if (newStatus === "replacement_sent") updates.replacement_sent_at = new Date().toISOString();
      if (newStatus === "completed") updates.completed_at = new Date().toISOString();
      if (newStatus === "cancelled") {
        updates.cancelled_at = new Date().toISOString();
        updates.cancel_reason = notes;
      }

      const { error } = await supabase.from("exchange_requests").update(updates).eq("id", exchangeId);
      if (error) throw error;

      // Fetch items for inventory logic
      const { data: items } = await supabase.from("exchange_items").select("*").eq("exchange_id", exchangeId);

      // REVERSE RECEIVED → stock IN for returned (sellable) items
      if (newStatus === "reverse_received" && items) {
        for (const item of items) {
          if (item.direction === "return" && item.product_id && item.condition === "good") {
            await supabase.from("inventory_ledger").insert({
              product_id: item.product_id,
              sku: item.sku || "",
              txn_type: "return_good",
              qty_in: item.quantity,
              reference_type: "exchange",
              reference_id: exchangeId,
              note: `Exchange return received: ${item.product_name}`,
            });
          }
        }
      }

      // REPLACEMENT SENT → stock OUT for replacement items
      if (newStatus === "replacement_sent" && items) {
        for (const item of items) {
          if (item.direction === "replacement" && item.product_id) {
            await supabase.from("inventory_ledger").insert({
              product_id: item.product_id,
              sku: item.sku || "",
              txn_type: "reserve",
              qty_out: item.quantity,
              reference_type: "exchange",
              reference_id: exchangeId,
              note: `Exchange replacement issued: ${item.product_name}`,
            });
          }
        }
      }

      // Audit
      await supabase.from("audit_logs").insert({
        entity_type: "exchange",
        entity_id: exchangeId,
        action: `exchange_${newStatus}`,
        after_json: { status: newStatus, notes },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exchanges"] });
      qc.invalidateQueries({ queryKey: ["order-exchanges"] });
      qc.invalidateQueries({ queryKey: ["stock-on-hand"] });
      toast({ title: "Exchange status updated" });
    },
    onError: (e: any) => toast({ title: "Transition failed", description: e.message, variant: "destructive" }),
  });
}

/** Exchange report KPIs */
export function useExchangeReport() {
  return useQuery({
    queryKey: ["exchange-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_requests")
        .select("*, exchange_items(*), exchange_shipments(*)");
      if (error) throw error;
      const all = (data || []) as ExchangeRequest[];

      const totalOrders = new Set(all.map((e) => e.order_id)).size;
      const totalExchanges = all.length;
      const completed = all.filter((e) => e.status === "completed").length;
      const courierCostLoss = all.reduce((s, e) => s + (e.courier_cost_total || 0), 0);
      const damagedLoss = all.reduce((s, e) => s + (e.damaged_loss || 0), 0);
      const priceDiffTotal = all.reduce((s, e) => s + (e.price_difference || 0), 0);
      const netCost = courierCostLoss + damagedLoss - priceDiffTotal;

      // Top reasons
      const reasonMap: Record<string, number> = {};
      for (const e of all) {
        const r = e.reason || "Unknown";
        reasonMap[r] = (reasonMap[r] || 0) + 1;
      }
      const topReasons = Object.entries(reasonMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }));

      // Product-wise
      const productMap: Record<string, { name: string; count: number }> = {};
      for (const e of all) {
        for (const item of e.exchange_items || []) {
          if (item.direction === "return") {
            const key = item.product_id || item.product_name;
            if (!productMap[key]) productMap[key] = { name: item.product_name, count: 0 };
            productMap[key].count += item.quantity;
          }
        }
      }
      const topProducts = Object.values(productMap).sort((a, b) => b.count - a.count).slice(0, 10);

      return {
        totalExchanges,
        totalOrders,
        completed,
        courierCostLoss,
        damagedLoss,
        priceDiffTotal,
        netCost,
        topReasons,
        topProducts,
        exchangeRate: totalOrders > 0 ? ((totalExchanges / totalOrders) * 100) : 0,
      };
    },
  });
}
