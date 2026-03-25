import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CampaignWithDecision {
  id: string;
  campaign_name: string;
  amount_spent: number;
  revenue_attributed: number;
  orders_attributed: number;
  roas: number;
  decision: "kill" | "hold" | "scale";
  reason: string;
  override_decision?: string;
  override_note?: string;
  decision_id?: string;
}

export interface Thresholds {
  scale_roas: number;
  hold_roas_min: number;
  kill_min_orders: number;
  kill_spend_threshold: number;
}

const DEFAULT_THRESHOLDS: Thresholds = {
  scale_roas: 3.0,
  hold_roas_min: 1.5,
  kill_min_orders: 3,
  kill_spend_threshold: 5000,
};

function decide(
  spend: number, revenue: number, orders: number, t: Thresholds
): { decision: "kill" | "hold" | "scale"; reason: string } {
  const roas = spend > 0 ? revenue / spend : 0;
  if (roas >= t.scale_roas && orders >= 10) {
    return { decision: "scale", reason: `ROAS ${roas.toFixed(1)} ≥ ${t.scale_roas} and ${orders} orders — strong performer` };
  }
  if (roas >= t.hold_roas_min && roas < t.scale_roas) {
    return { decision: "hold", reason: `ROAS ${roas.toFixed(1)} is moderate (${t.hold_roas_min}–${t.scale_roas}) — monitor closely` };
  }
  if (roas < t.hold_roas_min) {
    return { decision: "kill", reason: `ROAS ${roas.toFixed(1)} < ${t.hold_roas_min} — underperforming` };
  }
  if (orders < t.kill_min_orders && spend > t.kill_spend_threshold) {
    return { decision: "kill", reason: `Only ${orders} orders with ৳${spend.toLocaleString()} spend — low conversion` };
  }
  return { decision: "hold", reason: "Needs more data for a confident decision" };
}

export function useThresholds() {
  return useQuery<Thresholds>({
    queryKey: ["marketing-thresholds"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["mkt_scale_roas", "mkt_hold_roas_min", "mkt_kill_min_orders", "mkt_kill_spend_threshold"]);
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.key] = s.value; });
      return {
        scale_roas: parseFloat(map["mkt_scale_roas"]) || DEFAULT_THRESHOLDS.scale_roas,
        hold_roas_min: parseFloat(map["mkt_hold_roas_min"]) || DEFAULT_THRESHOLDS.hold_roas_min,
        kill_min_orders: parseInt(map["mkt_kill_min_orders"]) || DEFAULT_THRESHOLDS.kill_min_orders,
        kill_spend_threshold: parseFloat(map["mkt_kill_spend_threshold"]) || DEFAULT_THRESHOLDS.kill_spend_threshold,
      };
    },
  });
}

export function useSaveThresholds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Thresholds) => {
      const pairs = [
        { key: "mkt_scale_roas", value: String(t.scale_roas) },
        { key: "mkt_hold_roas_min", value: String(t.hold_roas_min) },
        { key: "mkt_kill_min_orders", value: String(t.kill_min_orders) },
        { key: "mkt_kill_spend_threshold", value: String(t.kill_spend_threshold) },
      ];
      for (const p of pairs) {
        const { data: existing } = await supabase.from("settings").select("id").eq("key", p.key).maybeSingle();
        if (existing) {
          await supabase.from("settings").update({ value: p.value, updated_at: new Date().toISOString() }).eq("key", p.key);
        } else {
          await supabase.from("settings").insert(p);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-thresholds"] }),
  });
}

export function useCampaignDecisions() {
  const { data: thresholds } = useThresholds();
  const t = thresholds || DEFAULT_THRESHOLDS;

  return useQuery<CampaignWithDecision[]>({
    queryKey: ["campaign-decisions", t],
    queryFn: async () => {
      const { data: campaigns, error } = await supabase
        .from("ad_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: decisions } = await supabase
        .from("campaign_decisions")
        .select("*")
        .order("decided_at", { ascending: false });

      const decisionMap = new Map<string, any>();
      (decisions || []).forEach((d: any) => {
        if (!decisionMap.has(d.campaign_id)) decisionMap.set(d.campaign_id, d);
      });

      return (campaigns || []).map((c: any) => {
        const spend = c.amount_spent || 0;
        const revenue = c.revenue_attributed || 0;
        const orders = c.orders_attributed || 0;
        const roas = spend > 0 ? revenue / spend : 0;
        const { decision, reason } = decide(spend, revenue, orders, t);
        const existing = decisionMap.get(c.id);
        return {
          id: c.id,
          campaign_name: c.campaign_name || "Unnamed",
          amount_spent: spend,
          revenue_attributed: revenue,
          orders_attributed: orders,
          roas,
          decision: existing?.override_decision || decision,
          reason: existing?.override_note || reason,
          override_decision: existing?.override_decision,
          override_note: existing?.override_note,
          decision_id: existing?.id,
        };
      });
    },
  });
}

export function useOverrideDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, decision, note, roas, spend, revenue, orders }: {
      campaignId: string; decision: string; note: string;
      roas: number; spend: number; revenue: number; orders: number;
    }) => {
      const { error } = await supabase.from("campaign_decisions").insert({
        campaign_id: campaignId,
        decision,
        roas,
        total_spend: spend,
        total_revenue: revenue,
        total_orders: orders,
        reason: note,
        override_decision: decision,
        override_note: note,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign-decisions"] }),
  });
}
