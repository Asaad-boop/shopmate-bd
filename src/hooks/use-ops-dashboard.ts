import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OpsKpis {
  pending_orders: number;
  ready_to_dispatch: number;
  in_transit: number;
  delivered_today: number;
  returned_today: number;
  courier_sync_errors: number;
}

export interface CourierPerf {
  courier_name: string;
  delivered: number;
  total: number;
  success_rate: number;
  avg_cost: number;
  avg_days: number;
}

export interface OpsActivity {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_name: string | null;
  created_at: string;
  reason: string;
}

export function useOpsKpis(from?: string, to?: string) {
  return useQuery<OpsKpis>({
    queryKey: ["ops-kpis", from, to],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (from) params.p_from = from;
      if (to) params.p_to = to;
      const { data, error } = await supabase.rpc("ops_dashboard_kpis", params as any);
      if (error) throw error;
      return data as unknown as OpsKpis;
    },
    staleTime: 60_000,
  });
}

export function useOpsCourierPerformance() {
  return useQuery<CourierPerf[]>({
    queryKey: ["ops-courier-perf"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ops_courier_performance");
      if (error) throw error;
      return (data as unknown as CourierPerf[]) || [];
    },
    staleTime: 120_000,
  });
}

export function useOpsRecentActivity() {
  return useQuery<OpsActivity[]>({
    queryKey: ["ops-recent-activity"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ops_recent_activity", { p_limit: 8 });
      if (error) throw error;
      return (data as unknown as OpsActivity[]) || [];
    },
    staleTime: 60_000,
  });
}
