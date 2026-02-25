import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ── Dashboard ── */
export function useMarketingDashboard(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["marketing-dashboard", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("marketing_dashboard_report", {
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw error;
      return data as any;
    },
  });
}

/* ══════════════ INFLUENCERS ══════════════ */
export function useInfluencers() {
  return useQuery({
    queryKey: ["influencers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("influencers").select("*").order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateInfluencer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { name: string; platform: string; page_link?: string; contact_info?: string; niche?: string }) => {
      const { error } = await supabase.from("influencers").insert(p);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["influencers"] }); toast.success("Influencer added"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateInfluencer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...u }: { id: string; [k: string]: any }) => {
      const { error } = await supabase.from("influencers").update({ ...u, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["influencers"] }); toast.success("Updated"); },
    onError: (e: any) => toast.error(e.message),
  });
}

/* ── Influencer Deals ── */
export function useInfluencerDeals(influencerId?: string) {
  return useQuery({
    queryKey: ["influencer-deals", influencerId],
    queryFn: async () => {
      let q = supabase.from("influencer_deals").select("*, influencers(name), influencer_deal_skus(product_id, allocation_pct, products:product_id(name, sku))").order("start_date", { ascending: false });
      if (influencerId) q = q.eq("influencer_id", influencerId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      influencer_id: string; campaign_name: string; start_date: string; end_date?: string;
      total_cost: number; payment_method: string; notes?: string;
      sku_ids?: { product_id: string; allocation_pct: number }[];
    }) => {
      const { sku_ids, ...dealData } = p;
      const { data, error } = await supabase.from("influencer_deals").insert(dealData).select("id").single();
      if (error) throw error;
      if (sku_ids?.length) {
        const rows = sku_ids.map(s => ({ deal_id: data.id, product_id: s.product_id, allocation_pct: s.allocation_pct }));
        const { error: skuErr } = await supabase.from("influencer_deal_skus").insert(rows);
        if (skuErr) throw skuErr;
      }
      return data.id;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["influencer-deals"] }); toast.success("Deal created"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useRecordDealPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deal, paymentAmount, paymentAccountId }: { deal: any; paymentAmount: number; paymentAccountId: string }) => {
      // Get marketing expense account
      const { data: mapping } = await supabase.from("account_mappings").select("account_id").eq("mapping_key", "marketing_expense").single();
      const debitAccountId = mapping?.account_id;
      if (!debitAccountId) throw new Error("Marketing Expense account not mapped. Go to Settings → Account Mappings.");

      // Create posting event
      const { data: pe, error: peErr } = await supabase.from("posting_events").insert({
        event_type: "MARKETING_PAYMENT",
        reference_type: "influencer_deal",
        reference_id: deal.id,
        reference_label: `Influencer: ${deal.influencers?.name || 'N/A'} – ${deal.campaign_name}`,
        event_date: new Date().toISOString().slice(0, 10),
        amount: paymentAmount,
        debit_account_id: debitAccountId,
        debit_label: "Marketing Expense",
        credit_account_id: paymentAccountId,
        credit_label: "Payment Account",
        status: "pending",
      }).select("id").single();
      if (peErr) throw peErr;

      // Update deal
      const newPaid = Number(deal.amount_paid || 0) + paymentAmount;
      const newStatus = newPaid >= Number(deal.total_cost) ? "paid" : "partial";
      const { error: upErr } = await supabase.from("influencer_deals").update({
        amount_paid: newPaid, payment_status: newStatus, posting_event_id: pe.id, updated_at: new Date().toISOString(),
      }).eq("id", deal.id);
      if (upErr) throw upErr;

      // Audit
      await supabase.from("audit_logs").insert({
        entity_type: "influencer_deal", entity_id: deal.id, action: "payment",
        after_json: { amount: paymentAmount, posting_event_id: pe.id },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["influencer-deals"] }); qc.invalidateQueries({ queryKey: ["posting-events"] }); toast.success("Payment recorded → sent to Posting Queue"); },
    onError: (e: any) => toast.error(e.message),
  });
}

/* ══════════════ UGC CREATORS ══════════════ */
export function useUGCCreators() {
  return useQuery({
    queryKey: ["ugc-creators"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ugc_creators").select("*").order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateUGCCreator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { name: string; contact?: string; content_type?: string; rate_per_video?: number }) => {
      const { error } = await supabase.from("ugc_creators").insert(p);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ugc-creators"] }); toast.success("Creator added"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUGCOrders(creatorId?: string) {
  return useQuery({
    queryKey: ["ugc-orders", creatorId],
    queryFn: async () => {
      let q = supabase.from("ugc_orders").select("*, ugc_creators(name), products:product_id(name, sku)").order("created_at", { ascending: false });
      if (creatorId) q = q.eq("creator_id", creatorId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateUGCOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { creator_id: string; product_id?: string; campaign_name?: string; video_count: number; total_cost: number; payment_method: string }) => {
      const { error } = await supabase.from("ugc_orders").insert(p);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ugc-orders"] }); toast.success("Video order created"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useRecordUGCPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ order, paymentAmount, paymentAccountId }: { order: any; paymentAmount: number; paymentAccountId: string }) => {
      const { data: mapping } = await supabase.from("account_mappings").select("account_id").eq("mapping_key", "marketing_expense").single();
      const debitAccountId = mapping?.account_id;
      if (!debitAccountId) throw new Error("Marketing Expense account not mapped.");

      const { data: pe, error: peErr } = await supabase.from("posting_events").insert({
        event_type: "MARKETING_PAYMENT",
        reference_type: "ugc_order",
        reference_id: order.id,
        reference_label: `UGC: ${order.ugc_creators?.name || 'N/A'} – ${order.video_count} videos`,
        event_date: new Date().toISOString().slice(0, 10),
        amount: paymentAmount,
        debit_account_id: debitAccountId,
        debit_label: "Marketing Expense",
        credit_account_id: paymentAccountId,
        credit_label: "Payment Account",
        status: "pending",
      }).select("id").single();
      if (peErr) throw peErr;

      const newPaid = Number(order.amount_paid || 0) + paymentAmount;
      const { error: upErr } = await supabase.from("ugc_orders").update({
        amount_paid: newPaid, payment_status: newPaid >= Number(order.total_cost) ? "paid" : "unpaid",
        posting_event_id: pe.id, updated_at: new Date().toISOString(),
      }).eq("id", order.id);
      if (upErr) throw upErr;

      await supabase.from("audit_logs").insert({
        entity_type: "ugc_order", entity_id: order.id, action: "payment",
        after_json: { amount: paymentAmount },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ugc-orders"] }); qc.invalidateQueries({ queryKey: ["posting-events"] }); toast.success("UGC payment recorded → Posting Queue"); },
    onError: (e: any) => toast.error(e.message),
  });
}

/* ══════════════ EXTERNAL MARKETING ══════════════ */
export function useExternalMarketing() {
  return useQuery({
    queryKey: ["external-marketing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("external_marketing").select("*, products:product_id(name, sku)").order("spend_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateExternalMarketing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { channel: string; spend_date: string; amount: number; payment_method: string; product_id?: string; campaign_name?: string; notes?: string; paymentAccountId: string }) => {
      const { paymentAccountId, ...row } = p;

      const { data: mapping } = await supabase.from("account_mappings").select("account_id").eq("mapping_key", "marketing_expense").single();
      const debitAccountId = mapping?.account_id;
      if (!debitAccountId) throw new Error("Marketing Expense account not mapped.");

      const { data: em, error: emErr } = await supabase.from("external_marketing").insert(row).select("id").single();
      if (emErr) throw emErr;

      const { data: pe, error: peErr } = await supabase.from("posting_events").insert({
        event_type: "MARKETING_PAYMENT",
        reference_type: "external_marketing",
        reference_id: em.id,
        reference_label: `External: ${p.channel} – ৳${p.amount}`,
        event_date: p.spend_date,
        amount: p.amount,
        debit_account_id: debitAccountId,
        debit_label: "Marketing Expense",
        credit_account_id: paymentAccountId,
        credit_label: "Payment Account",
        status: "pending",
      }).select("id").single();
      if (peErr) throw peErr;

      await supabase.from("external_marketing").update({ posting_event_id: pe.id }).eq("id", em.id);

      await supabase.from("audit_logs").insert({
        entity_type: "external_marketing", entity_id: em.id, action: "create",
        after_json: { amount: p.amount, channel: p.channel },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["external-marketing"] }); qc.invalidateQueries({ queryKey: ["posting-events"] }); toast.success("External spend recorded → Posting Queue"); },
    onError: (e: any) => toast.error(e.message),
  });
}

/* ── Payment Accounts helper ── */
export function usePaymentAccounts() {
  return useQuery({
    queryKey: ["payment-accounts-marketing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chart_of_accounts")
        .select("id, code, name")
        .in("account_type", ["asset"])
        .ilike("name", "%cash%,%bank%,%bkash%,%nagad%")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      // Fallback: also fetch by code pattern
      if (!data?.length) {
        const { data: d2 } = await supabase.from("chart_of_accounts")
          .select("id, code, name")
          .eq("account_type", "asset")
          .eq("is_active", true)
          .order("code");
        return d2 || [];
      }
      return data || [];
    },
  });
}

/* ── Products for linking ── */
export function useProductsForLinking() {
  return useQuery({
    queryKey: ["products-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, sku").order("name").limit(500);
      if (error) throw error;
      return data || [];
    },
  });
}
