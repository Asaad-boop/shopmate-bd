import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name, country, wechat_id), purchase_order_items(id, qty_ordered:quantity, qty_received:received_quantity, product_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["purchase-order", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function usePOItems(poId: string | undefined) {
  return useQuery({
    queryKey: ["po-items", poId],
    enabled: !!poId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("*, products(name, sku, image_url)")
        .eq("purchase_order_id", poId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function usePOPayments(poId: string | undefined) {
  return useQuery({
    queryKey: ["po-payments", poId],
    enabled: !!poId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_payments")
        .select("*")
        .eq("po_id", poId!)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePOAdditionalCosts(poId: string | undefined) {
  return useQuery({
    queryKey: ["po-additional-costs", poId],
    enabled: !!poId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_additional_costs")
        .select("*")
        .eq("po_id", poId!);
      if (error) throw error;
      return data;
    },
  });
}

export function usePOTimeline(poId: string | undefined) {
  return useQuery({
    queryKey: ["po-timeline", poId],
    enabled: !!poId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_timeline")
        .select("*")
        .eq("po_id", poId!)
        .order("stage", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function usePOStats() {
  return useQuery({
    queryKey: ["po-stats"],
    queryFn: async () => {
      const { data: pos, error } = await supabase
        .from("purchase_orders")
        .select("id, status, payment_status, total_landed_cost_bdt, advance_paid_bdt, remaining_payment_bdt, actual_arrival_date, created_at");
      if (error) throw error;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const total = pos?.length || 0;
      const inTransit = pos?.filter(p => p.status === 'shipped' || p.status === 'in_transit').length || 0;
      const pendingPayment = pos?.filter(p => (p.remaining_payment_bdt || 0) > 0).reduce((s, p) => s + (p.remaining_payment_bdt || 0), 0) || 0;
      const receivedThisMonth = pos?.filter(p => p.status === 'received' && p.actual_arrival_date && p.actual_arrival_date >= monthStart.slice(0, 10)).length || 0;
      const totalInvested = pos?.reduce((s, p) => s + (p.total_landed_cost_bdt || 0), 0) || 0;

      return { total, inTransit, pendingPayment, receivedThisMonth, totalInvested };
    },
  });
}
