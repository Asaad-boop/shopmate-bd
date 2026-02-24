import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ── Types ──
export interface MetaCampaign {
  id: string;
  meta_campaign_id: string;
  meta_account_id: string;
  campaign_name: string;
  objective: string | null;
  status: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  start_date: string | null;
  end_date: string | null;
  synced_at: string;
  created_at: string;
}

export interface MetaCampaignMetric {
  id: string;
  campaign_id: string;
  meta_campaign_id: string;
  metric_date: string;
  spend_usd: number;
  spend_bdt: number;
  usd_rate: number;
  impressions: number;
  clicks: number;
  reach: number;
  purchases: number;
  purchase_value: number;
  cpc: number;
  cpm: number;
  ctr: number;
  roas: number;
  cpo: number;
  synced_at: string;
}

export interface CampaignProduct {
  id: string;
  campaign_id: string;
  product_id: string;
  allocation_pct: number;
  note: string | null;
  created_at: string;
}

// ── Hooks ──

export function useMetaCampaigns() {
  return useQuery({
    queryKey: ["meta-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_campaigns")
        .select("*")
        .order("synced_at", { ascending: false });
      if (error) throw error;
      return data as MetaCampaign[];
    },
  });
}

export function useMetaCampaignMetrics(dateFrom?: string, dateTo?: string, campaignId?: string) {
  return useQuery({
    queryKey: ["meta-campaign-metrics", dateFrom, dateTo, campaignId],
    queryFn: async () => {
      let query = supabase
        .from("meta_campaign_metrics")
        .select("*")
        .order("metric_date", { ascending: true });

      if (dateFrom) query = query.gte("metric_date", dateFrom);
      if (dateTo) query = query.lte("metric_date", dateTo);
      if (campaignId) query = query.eq("campaign_id", campaignId);

      const { data, error } = await query;
      if (error) throw error;
      return data as MetaCampaignMetric[];
    },
  });
}

export function useCampaignProducts(campaignId?: string) {
  return useQuery({
    queryKey: ["campaign-products", campaignId],
    queryFn: async () => {
      let query = supabase.from("campaign_products").select("*");
      if (campaignId) query = query.eq("campaign_id", campaignId);
      const { data, error } = await query;
      if (error) throw error;
      return data as CampaignProduct[];
    },
    enabled: !!campaignId,
  });
}

export function useAllCampaignProducts() {
  return useQuery({
    queryKey: ["campaign-products-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaign_products").select("*");
      if (error) throw error;
      return data as CampaignProduct[];
    },
  });
}

export function useSaveCampaignProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ campaignId, products }: { campaignId: string; products: { product_id: string; allocation_pct: number; note?: string }[] }) => {
      // Delete existing links
      await supabase.from("campaign_products").delete().eq("campaign_id", campaignId);
      // Insert new
      if (products.length > 0) {
        const { error } = await supabase.from("campaign_products").insert(
          products.map((p) => ({ campaign_id: campaignId, ...p }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Product links saved" });
      queryClient.invalidateQueries({ queryKey: ["campaign-products"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-products-all"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

export function useSyncMetaAds() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-meta-ads", {
        body: { date_preset: "yesterday" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "✅ Meta Ads synced", description: `USD Rate: ৳${data?.usd_rate}` });
      queryClient.invalidateQueries({ queryKey: ["meta-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["meta-campaign-metrics"] });
    },
    onError: (err: any) => toast({ title: "Sync failed", description: err.message, variant: "destructive" }),
  });
}

export function useMetaAdAccounts() {
  return useQuery({
    queryKey: ["meta-ad-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_ad_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ── Summary computation ──
export function computeMetricsSummary(metrics: MetaCampaignMetric[]) {
  const totalSpendBdt = metrics.reduce((s, m) => s + (m.spend_bdt || 0), 0);
  const totalSpendUsd = metrics.reduce((s, m) => s + (m.spend_usd || 0), 0);
  const totalPurchaseValue = metrics.reduce((s, m) => s + (m.purchase_value || 0), 0);
  const totalOrders = metrics.reduce((s, m) => s + (m.purchases || 0), 0);
  const totalImpressions = metrics.reduce((s, m) => s + (m.impressions || 0), 0);
  const roas = totalSpendUsd > 0 ? totalPurchaseValue / totalSpendUsd : 0;
  const cpo = totalOrders > 0 ? totalSpendBdt / totalOrders : 0;

  return { totalSpendBdt, totalSpendUsd, roas, totalOrders, cpo, totalImpressions };
}
