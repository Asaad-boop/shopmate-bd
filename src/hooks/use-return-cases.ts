import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ReturnCase {
  id: string;
  parent_order_id: string;
  exchange_case_id: string | null;
  status: string;
  expected_items: ExpectedItem[];
  received_items: ReceivedItem[];
  return_type: string | null;
  condition: string | null;
  warehouse_location: string | null;
  received_at: string | null;
  received_by: string | null;
  notes: string | null;
  evidence_urls: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ExpectedItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
}

export interface ReceivedItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  condition: string; // good | damaged | unusable
}

/** Fetch return cases for an order */
export function useOrderReturnCases(orderId?: string) {
  return useQuery({
    queryKey: ["return-cases", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("return_cases")
        .select("*")
        .eq("parent_order_id", orderId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        expected_items: (d.expected_items || []) as ExpectedItem[],
        received_items: (d.received_items || []) as ReceivedItem[],
      })) as ReturnCase[];
    },
  });
}

/** Create a return case (called when exchange initiated or courier returns) */
export function useCreateReturnCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      parent_order_id: string;
      exchange_case_id?: string;
      expected_items: ExpectedItem[];
      notes?: string;
    }) => {
      // Create return case
      const { data, error } = await supabase
        .from("return_cases")
        .insert({
          parent_order_id: params.parent_order_id,
          exchange_case_id: params.exchange_case_id || null,
          expected_items: params.expected_items as any,
          notes: params.notes,
        })
        .select()
        .single();
      if (error) throw error;

      // Set return_pending on order
      await supabase
        .from("orders")
        .update({
          return_pending: true,
          return_case_id: data.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.parent_order_id);

      // If exchange case, mark on exchange
      if (params.exchange_case_id) {
        // The exchange already tracks return pending via reverse_received_at being null
      }

      // Audit log
      await supabase.from("audit_logs").insert([{
        entity_type: "return_case",
        entity_id: data.id,
        action: "return_case_created",
        after_json: {
          order_id: params.parent_order_id,
          exchange_case_id: params.exchange_case_id,
          expected_items: params.expected_items,
        } as any,
      }]);

      // Activity log
      await supabase.from("order_activity_log").insert({
        order_id: params.parent_order_id,
        action: "Return pending created",
        done_by: "Staff",
      });

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["return-cases"] });
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Return case created" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
}

/** Confirm receipt of returned items — triggers inventory posting */
export function useConfirmReturnReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      return_case_id: string;
      parent_order_id: string;
      exchange_case_id?: string | null;
      return_type: string;
      received_items: ReceivedItem[];
      condition: string;
      warehouse_location?: string;
      notes?: string;
    }) => {
      // 1. Update return case
      const { error } = await supabase
        .from("return_cases")
        .update({
          status: "received",
          received_items: params.received_items as any,
          return_type: params.return_type,
          condition: params.condition,
          warehouse_location: params.warehouse_location,
          received_at: new Date().toISOString(),
          notes: params.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.return_case_id);
      if (error) throw error;

      // 2. Stock IN per received item — conditional on item condition
      for (const item of params.received_items) {
        if (item.quantity <= 0) continue;

        const txnType = item.condition === "good" ? "return_good" : "return_damaged";
        const note =
          item.condition === "good"
            ? `Return received (good): ${item.product_name}`
            : `Return received (${item.condition}): ${item.product_name} — not sellable`;

        await supabase.from("inventory_ledger").insert({
          product_id: item.product_id,
          sku: item.sku || "",
          txn_type: txnType,
          qty_in: item.quantity,
          reference_type: "return_case",
          reference_id: params.return_case_id,
          note,
        });
      }

      // 3. Clear return_pending on order
      await supabase
        .from("orders")
        .update({
          return_pending: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.parent_order_id);

      // 4. If linked to exchange, mark reverse_received
      if (params.exchange_case_id) {
        await supabase
          .from("exchange_requests")
          .update({
            reverse_received_at: new Date().toISOString(),
            status: "reverse_received",
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.exchange_case_id);
      }

      // 5. Audit
      await supabase.from("audit_logs").insert([{
        entity_type: "return_case",
        entity_id: params.return_case_id,
        action: "return_received",
        after_json: {
          return_type: params.return_type,
          condition: params.condition,
          received_items: params.received_items,
        } as any,
      }]);

      await supabase.from("order_activity_log").insert({
        order_id: params.parent_order_id,
        action: `Return received (${params.condition}) — ${params.received_items.length} SKU(s)`,
        done_by: "Staff",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["return-cases"] });
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order-exchanges"] });
      qc.invalidateQueries({ queryKey: ["exchanges"] });
      qc.invalidateQueries({ queryKey: ["stock-on-hand"] });
      qc.invalidateQueries({ queryKey: ["order-activity-log"] });
      toast({ title: "Return received & inventory updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
}
