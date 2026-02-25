import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TodayKpis {
  orders_created: number;
  orders_delivered: number;
  returns_today: number;
  today_revenue: number;
  today_cogs: number;
  today_courier_cost: number;
}

interface CashPosition {
  cash: number;
  bank: number;
  bkash: number;
  nagad: number;
}

interface WorkingCapital {
  inventory_value: number;
  courier_receivable: number;
  supplier_payable: number;
  customer_advances: number;
}

interface TrendDay {
  date: string;
  revenue: number;
  profit: number;
}

interface Alerts {
  not_synced: number;
  settlement_pending: number;
  negative_stock: number;
  advance_not_posted: number;
  supplier_overdue: number;
  unposted_journals: number;
}

export function useTodayKpis() {
  return useQuery<TodayKpis>({
    queryKey: ["dashboard-today-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_today_kpis");
      if (error) throw error;
      return data as unknown as TodayKpis;
    },
    refetchInterval: 60_000,
  });
}

export function useCashPosition() {
  return useQuery<CashPosition>({
    queryKey: ["dashboard-cash-position"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_cash_position");
      if (error) throw error;
      return data as unknown as CashPosition;
    },
    refetchInterval: 120_000,
  });
}

export function useWorkingCapital() {
  return useQuery<WorkingCapital>({
    queryKey: ["dashboard-working-capital"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_working_capital");
      if (error) throw error;
      return data as unknown as WorkingCapital;
    },
    refetchInterval: 120_000,
  });
}

export function use14DayTrend() {
  return useQuery<TrendDay[]>({
    queryKey: ["dashboard-14day-trend"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_14day_trend");
      if (error) throw error;
      return (data as unknown as TrendDay[]) || [];
    },
    refetchInterval: 300_000,
  });
}

export function useDashboardAlerts() {
  return useQuery<Alerts>({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_alerts");
      if (error) throw error;
      return data as unknown as Alerts;
    },
    refetchInterval: 60_000,
  });
}

export function useRefreshDashboard() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["dashboard-today-kpis"] });
    qc.invalidateQueries({ queryKey: ["dashboard-cash-position"] });
    qc.invalidateQueries({ queryKey: ["dashboard-working-capital"] });
    qc.invalidateQueries({ queryKey: ["dashboard-14day-trend"] });
    qc.invalidateQueries({ queryKey: ["dashboard-alerts"] });
  };
}
