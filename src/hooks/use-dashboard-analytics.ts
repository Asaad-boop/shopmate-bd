import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WebOrderPerformance {
  total: number;
  complete: number;
  no_response: number;
  good_no_response: number;
  cancel: number;
}

export interface SourceEntry {
  source: string;
  count: number;
  revenue: number;
  prev_count: number;
  growth_pct: number;
}

export interface OrdersBySource {
  total_orders: number;
  total_value: number;
  sources: SourceEntry[];
}

export interface OrderFlowDay {
  day: string;
  date: string;
  created: number;
  sent: number;
}

export interface OrderFlowTrend {
  total_created: number;
  total_sent: number;
  days: OrderFlowDay[];
}

export interface HourlyEntry {
  hour: number;
  label: string;
  today: number;
  yesterday: number;
}

export interface TopProduct {
  name: string;
  sku: string;
  thumbnail: string | null;
  sales_count: number;
  revenue: number;
}

export function useWebOrderPerformance(days = 7) {
  return useQuery<WebOrderPerformance>({
    queryKey: ["dash-web-perf", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dash_web_order_performance", { p_days: days });
      if (error) throw error;
      return data as unknown as WebOrderPerformance;
    },
    staleTime: 60_000,
  });
}

export function useOrdersBySource(from?: string, to?: string) {
  return useQuery<OrdersBySource>({
    queryKey: ["dash-orders-source", from, to],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (from) params.p_from = from;
      if (to) params.p_to = to;
      const { data, error } = await supabase.rpc("dash_orders_by_source", params as any);
      if (error) throw error;
      return data as unknown as OrdersBySource;
    },
    staleTime: 60_000,
  });
}

export function useOrderFlowTrend(days = 30) {
  return useQuery<OrderFlowTrend>({
    queryKey: ["dash-order-flow", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dash_order_flow_trend", { p_days: days });
      if (error) throw error;
      return data as unknown as OrderFlowTrend;
    },
    staleTime: 60_000,
  });
}

export function useHourlyOrders(source?: string) {
  return useQuery<HourlyEntry[]>({
    queryKey: ["dash-hourly", source],
    queryFn: async () => {
      const params: Record<string, string | null> = { p_source: source || null };
      const { data, error } = await supabase.rpc("dash_hourly_orders", params as any);
      if (error) throw error;
      return (data as unknown as HourlyEntry[]) || [];
    },
    staleTime: 60_000,
  });
}

export function useTopProducts(from?: string, to?: string) {
  return useQuery<TopProduct[]>({
    queryKey: ["dash-top-products", from, to],
    queryFn: async () => {
      const params: Record<string, any> = { p_limit: 5 };
      if (from) params.p_from = from;
      if (to) params.p_to = to;
      const { data, error } = await supabase.rpc("dash_top_products", params as any);
      if (error) throw error;
      return (data as unknown as TopProduct[]) || [];
    },
    staleTime: 60_000,
  });
}
