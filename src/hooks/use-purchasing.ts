import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ─── Goods Receipts ───
export function useGoodsReceipts() {
  return useQuery({
    queryKey: ["goods-receipts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goods_receipts")
        .select("*, suppliers(name), purchase_orders(po_number), goods_receipt_items(id, qty_received, unit_cost, line_total, sku, product_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useGoodsReceipt(id: string | undefined) {
  return useQuery({
    queryKey: ["goods-receipt", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goods_receipts")
        .select("*, suppliers(name), purchase_orders(po_number)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useGRNItems(grnId: string | undefined) {
  return useQuery({
    queryKey: ["grn-items", grnId],
    enabled: !!grnId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goods_receipt_items")
        .select("*, products(name, sku, image_url)")
        .eq("grn_id", grnId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateGRN() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      supplier_id: string;
      po_id?: string;
      receipt_date: string;
      receipt_type: string;
      notes?: string;
      items: { product_id?: string; sku: string; product_name: string; qty_received: number; unit_cost: number }[];
    }) => {
      const yr = new Date().getFullYear();
      const mo = String(new Date().getMonth() + 1).padStart(2, "0");
      const { data: seqData } = await supabase.rpc("nextval" as any, { seq_name: "grn_seq" } as any).single();
      const seq = String(seqData || Math.floor(Math.random() * 9999)).padStart(4, "0");
      const grnNumber = `GRN-${yr}${mo}-${seq}`;

      const totalCost = payload.items.reduce((s, i) => s + i.qty_received * i.unit_cost, 0);

      const { data: grn, error } = await supabase
        .from("goods_receipts")
        .insert({
          grn_number: grnNumber,
          supplier_id: payload.supplier_id,
          po_id: payload.po_id || null,
          receipt_date: payload.receipt_date,
          receipt_type: payload.receipt_type,
          notes: payload.notes || null,
          total_product_cost: totalCost,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw error;

      const itemRows = payload.items.map((i) => ({
        grn_id: grn.id,
        product_id: i.product_id || null,
        sku: i.sku,
        product_name: i.product_name,
        qty_received: i.qty_received,
        unit_cost: i.unit_cost,
        line_total: i.qty_received * i.unit_cost,
      }));
      const { error: itemErr } = await supabase.from("goods_receipt_items").insert(itemRows);
      if (itemErr) throw itemErr;

      return grn;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goods-receipts"] });
      toast({ title: "GRN created successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error creating GRN", description: err.message, variant: "destructive" });
    },
  });
}

export function usePostGRN() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (grnId: string) => {
      // Get GRN details
      const { data: grn, error: grnErr } = await supabase
        .from("goods_receipts")
        .select("*, goods_receipt_items(*)")
        .eq("id", grnId)
        .single();
      if (grnErr) throw grnErr;
      if (grn.status === "posted") throw new Error("GRN already posted");

      // Post GL entry via function
      const { data: jeId, error: postErr } = await supabase.rpc("post_grn", {
        p_grn_id: grnId,
        p_amount: grn.total_product_cost || 0,
        p_entry_date: grn.receipt_date,
      });
      if (postErr) throw postErr;

      // Update inventory ledger for each item
      const items = (grn as any).goods_receipt_items || [];
      for (const item of items) {
        if (!item.product_id || item.qty_received <= 0) continue;

        // Calculate WAC
        const newAvgCost = await supabase.rpc("calc_weighted_avg_cost", {
          p_product_id: item.product_id,
          p_new_qty: Math.round(item.qty_received),
          p_new_cost: item.unit_cost || 0,
        });

        await supabase.from("inventory_ledger").insert({
          product_id: item.product_id,
          sku: item.sku,
          txn_type: "stock_in",
          qty_in: Math.round(item.qty_received),
          unit_cost: item.unit_cost || 0,
          running_avg_cost: newAvgCost.data || item.unit_cost || 0,
          reference_type: "grn",
          reference_id: grnId,
          note: `GRN: ${grn.grn_number}`,
        });

        // Update PO received qty if linked
        if (grn.po_id) {
          const { data: poItems } = await supabase
            .from("purchase_order_items")
            .select("id, received_quantity")
            .eq("purchase_order_id", grn.po_id)
            .eq("product_id", item.product_id);
          if (poItems && poItems.length > 0) {
            await supabase
              .from("purchase_order_items")
              .update({ received_quantity: (poItems[0].received_quantity || 0) + item.qty_received })
              .eq("id", poItems[0].id);
          }
        }
      }

      return jeId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goods-receipts"] });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast({ title: "GRN posted — inventory & GL updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error posting GRN", description: err.message, variant: "destructive" });
    },
  });
}

// ─── Supplier Payments ───
export function useSupplierPayments() {
  return useQuery({
    queryKey: ["supplier-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_payments")
        .select("*, suppliers(name), chart_of_accounts:paid_from_account_id(name, code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateSupplierPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      supplier_id: string;
      payment_date: string;
      payment_method: string;
      paid_from_account_id: string;
      amount: number;
      reference?: string;
      notes?: string;
      allocations?: { payable_type: string; payable_id: string; allocated_amount: number }[];
    }) => {
      const yr = new Date().getFullYear();
      const mo = String(new Date().getMonth() + 1).padStart(2, "0");
      const seq = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
      const paymentNumber = `SP-${yr}${mo}-${seq}`;

      const { data: payment, error } = await supabase
        .from("supplier_payments")
        .insert({
          payment_number: paymentNumber,
          supplier_id: payload.supplier_id,
          payment_date: payload.payment_date,
          payment_method: payload.payment_method,
          paid_from_account_id: payload.paid_from_account_id,
          amount: payload.amount,
          reference: payload.reference || null,
          notes: payload.notes || null,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw error;

      // Save allocations
      if (payload.allocations && payload.allocations.length > 0) {
        await supabase.from("supplier_payment_allocations").insert(
          payload.allocations.map((a) => ({
            payment_id: payment.id,
            payable_type: a.payable_type,
            payable_id: a.payable_id,
            allocated_amount: a.allocated_amount,
          }))
        );
      }

      return payment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-payments"] });
      toast({ title: "Payment created" });
    },
    onError: (err: any) => {
      toast({ title: "Error creating payment", description: err.message, variant: "destructive" });
    },
  });
}

export function usePostSupplierPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { data: payment, error: fetchErr } = await supabase
        .from("supplier_payments")
        .select("*")
        .eq("id", paymentId)
        .single();
      if (fetchErr) throw fetchErr;
      if (payment.status === "posted") throw new Error("Already posted");

      const { data: jeId, error: postErr } = await supabase.rpc("post_supplier_payment", {
        p_payment_id: paymentId,
        p_amount: payment.amount,
        p_pay_account_id: payment.paid_from_account_id,
        p_entry_date: payment.payment_date,
      });
      if (postErr) throw postErr;
      return jeId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-payments"] });
      qc.invalidateQueries({ queryKey: ["goods-receipts"] });
      toast({ title: "Payment posted to GL" });
    },
    onError: (err: any) => {
      toast({ title: "Error posting payment", description: err.message, variant: "destructive" });
    },
  });
}

// ─── Payables & Aging ───
export function useSupplierPayables() {
  return useQuery({
    queryKey: ["supplier-payables"],
    queryFn: async () => {
      // Get all posted GRNs
      const { data: grns, error: grnErr } = await supabase
        .from("goods_receipts")
        .select("id, grn_number, supplier_id, receipt_date, total_product_cost, status, suppliers(name)")
        .eq("status", "posted")
        .order("receipt_date", { ascending: false });
      if (grnErr) throw grnErr;

      // Get all payment allocations
      const { data: allocs, error: allocErr } = await supabase
        .from("supplier_payment_allocations")
        .select("payable_id, allocated_amount, supplier_payments!inner(status)")
        .eq("supplier_payments.status", "posted");
      if (allocErr) throw allocErr;

      const allocMap = new Map<string, number>();
      (allocs || []).forEach((a) => {
        allocMap.set(a.payable_id, (allocMap.get(a.payable_id) || 0) + (a.allocated_amount || 0));
      });

      const now = new Date();
      return (grns || []).map((g) => {
        const paid = allocMap.get(g.id) || 0;
        const outstanding = (g.total_product_cost || 0) - paid;
        const daysSince = Math.floor((now.getTime() - new Date(g.receipt_date).getTime()) / 86400000);
        let bucket = "0-7";
        if (daysSince > 60) bucket = "60+";
        else if (daysSince > 30) bucket = "31-60";
        else if (daysSince > 15) bucket = "16-30";
        else if (daysSince > 7) bucket = "8-15";
        return { ...g, paid, outstanding, daysSince, bucket };
      }).filter((g) => g.outstanding > 0.01);
    },
  });
}

// ─── Landed Costs ───
export function useLandedCosts(poId?: string) {
  return useQuery({
    queryKey: ["landed-costs", poId],
    queryFn: async () => {
      let q = supabase
        .from("landed_costs")
        .select("*, purchase_orders(po_number), chart_of_accounts:paid_from_account_id(name, code)")
        .order("created_at", { ascending: false });
      if (poId) q = q.eq("po_id", poId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateLandedCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      po_id?: string;
      import_shipment_id?: string;
      cost_date: string;
      cost_type: string;
      amount: number;
      paid_from_account_id?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("landed_costs")
        .insert({
          po_id: payload.po_id || null,
          import_shipment_id: payload.import_shipment_id || null,
          cost_date: payload.cost_date,
          cost_type: payload.cost_type,
          amount: payload.amount,
          paid_from_account_id: payload.paid_from_account_id || null,
          notes: payload.notes || null,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landed-costs"] });
      toast({ title: "Landed cost added" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function usePostLandedCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (costId: string) => {
      const { data: cost, error: fetchErr } = await supabase
        .from("landed_costs")
        .select("*")
        .eq("id", costId)
        .single();
      if (fetchErr) throw fetchErr;
      if (cost.status === "posted") throw new Error("Already posted");
      if (!cost.paid_from_account_id) throw new Error("Paid from account required");

      const { data: jeId, error: postErr } = await supabase.rpc("post_landed_cost", {
        p_landed_cost_id: costId,
        p_amount: cost.amount,
        p_pay_account_id: cost.paid_from_account_id,
        p_entry_date: cost.cost_date,
      });
      if (postErr) throw postErr;
      return jeId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landed-costs"] });
      toast({ title: "Landed cost posted to GL" });
    },
    onError: (err: any) => {
      toast({ title: "Error posting landed cost", description: err.message, variant: "destructive" });
    },
  });
}

// ─── Chart of Accounts (for paid_from selects) ───
export function useCashBankAccounts() {
  return useQuery({
    queryKey: ["cash-bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, name, code, account_type")
        .eq("account_type", "asset")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data;
    },
  });
}

// ─── Purchasing Stats ───
export function usePurchasingStats() {
  return useQuery({
    queryKey: ["purchasing-stats"],
    queryFn: async () => {
      const [{ data: grns }, { data: payments }, { data: payables }] = await Promise.all([
        supabase.from("goods_receipts").select("id, status, total_product_cost").eq("status", "posted"),
        supabase.from("supplier_payments").select("id, status, amount").eq("status", "posted"),
        supabase.from("goods_receipts").select("id, total_product_cost, status").eq("status", "posted"),
      ]);

      const totalGRNs = grns?.length || 0;
      const totalPurchaseValue = grns?.reduce((s, g) => s + (g.total_product_cost || 0), 0) || 0;
      const totalPaid = payments?.reduce((s, p) => s + (p.amount || 0), 0) || 0;
      const totalOutstanding = totalPurchaseValue - totalPaid;

      return { totalGRNs, totalPurchaseValue, totalPaid, totalOutstanding: Math.max(0, totalOutstanding) };
    },
  });
}
