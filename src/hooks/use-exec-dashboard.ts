import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExecKpis {
  total_orders: number;
  delivered: number;
  in_transit: number;
  returned: number;
  return_rate: number;
  delivered_revenue: number;
  avg_order_value: number;
  gross_profit: number;
  prev_total_orders: number;
  prev_delivered: number;
  prev_delivered_revenue: number;
  prev_avg_order_value: number;
  prev_gross_profit: number;
  prev_return_rate: number;
}

export interface PipelineStage {
  status: string;
  count: number;
  total_amount: number;
}

export interface ExecAlerts {
  pending_24h: number;
  intransit_5d: number;
  delivered_unsettled: number;
  delivered_unsettled_amt: number;
  missing_courier_cost: number;
  missing_sku_cost: number;
  negative_stock: number;
  unposted_2d: number;
  exceptions_open: number;
}

export interface ExecInventory {
  total_value: number;
  low_stock: number;
  dead_stock: number;
  top_by_qty: { name: string; sku: string; qty: number }[];
  top_by_profit: { name: string; sku: string; profit: number }[];
}

export interface ExecFinance {
  cash: number;
  bank: number;
  bkash: number;
  nagad: number;
  total_liquid: number;
  courier_receivable: number;
  settlements_posted: number;
}

export interface ChartDay {
  day: string;
  revenue: number;
  profit: number;
  returns: number;
  delivered: number;
}

export interface ExecMarketing {
  meta_spend: number;
  influencer_spend: number;
  total_marketing: number;
  revenue: number;
  marketing_pct: number;
}

export function useExecKpis(from?: string, to?: string) {
  return useQuery<ExecKpis>({
    queryKey: ["exec-kpis", from, to],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (from) params.p_from = from;
      if (to) params.p_to = to;
      const { data, error } = await supabase.rpc("exec_dashboard_kpis", params as any);
      if (error) throw error;
      return data as unknown as ExecKpis;
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
    retry: 1,
  });
}

export function useExecPipeline(from?: string, to?: string) {
  return useQuery<PipelineStage[]>({
    queryKey: ["exec-pipeline", from, to],
    queryFn: async () => {
      const params: Record<string, string | null> = { p_from: from || null, p_to: to || null };
      const { data, error } = await supabase.rpc("exec_dashboard_pipeline", params as any);
      if (error) throw error;
      return (data as unknown as PipelineStage[]) || [];
    },
    staleTime: 60_000,
  });
}

export function useExecAlerts() {
  return useQuery<ExecAlerts>({
    queryKey: ["exec-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("exec_dashboard_alerts");
      if (error) throw error;
      return data as unknown as ExecAlerts;
    },
    staleTime: 60_000,
  });
}

export function useExecInventory() {
  return useQuery<ExecInventory>({
    queryKey: ["exec-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("exec_dashboard_inventory");
      if (error) throw error;
      return data as unknown as ExecInventory;
    },
    staleTime: 120_000,
  });
}

export function useExecFinance() {
  return useQuery<ExecFinance>({
    queryKey: ["exec-finance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("exec_dashboard_finance");
      if (error) throw error;
      return data as unknown as ExecFinance;
    },
    staleTime: 120_000,
  });
}

export function useExecCharts(days = 14) {
  return useQuery<ChartDay[]>({
    queryKey: ["exec-charts", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("exec_dashboard_charts", { p_days: days });
      if (error) throw error;
      return (data as unknown as ChartDay[]) || [];
    },
    staleTime: 120_000,
    refetchInterval: 300_000,
    retry: 1,
  });
}

export function useExecMarketing(from?: string, to?: string) {
  return useQuery<ExecMarketing>({
    queryKey: ["exec-marketing", from, to],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (from) params.p_from = from;
      if (to) params.p_to = to;
      const { data, error } = await supabase.rpc("exec_dashboard_marketing", params as any);
      if (error) throw error;
      return data as unknown as ExecMarketing;
    },
    staleTime: 300_000,
  });
}
