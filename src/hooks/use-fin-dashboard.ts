import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FinKpis {
  liquid_cash: number;
  courier_receivable: number;
  settlements_posted: number;
  supplier_payables: number;
  period_expenses: number;
  unposted_events: number;
}

export interface SettlementAging {
  bucket_0_3: number;
  bucket_4_7: number;
  bucket_8_15: number;
  bucket_15_plus: number;
  total_unsettled_amount: number;
  total_unsettled_count: number;
}

export interface SupplierDue {
  supplier_name: string;
  due_amount: number;
  po_count: number;
}

export interface ExpenseCategory {
  category: string;
  total: number;
  entries: number;
}

export interface CashflowDay {
  day: string;
  inflow: number;
  outflow: number;
}

export function useFinKpis(from?: string, to?: string) {
  return useQuery<FinKpis>({
    queryKey: ["fin-kpis", from, to],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (from) params.p_from = from;
      if (to) params.p_to = to;
      const { data, error } = await supabase.rpc("fin_dashboard_kpis", params as any);
      if (error) throw error;
      return data as unknown as FinKpis;
    },
    staleTime: 60_000,
  });
}

export function useSettlementAging() {
  return useQuery<SettlementAging>({
    queryKey: ["fin-settlement-aging"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fin_settlement_aging");
      if (error) throw error;
      return data as unknown as SettlementAging;
    },
    staleTime: 60_000,
  });
}

export function useSupplierPayablesSnapshot() {
  return useQuery<SupplierDue[]>({
    queryKey: ["fin-supplier-payables"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fin_supplier_payables_snapshot");
      if (error) throw error;
      return (data as unknown as SupplierDue[]) || [];
    },
    staleTime: 120_000,
  });
}

export function useExpenseBreakdown(from?: string, to?: string) {
  return useQuery<ExpenseCategory[]>({
    queryKey: ["fin-expense-breakdown", from, to],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (from) params.p_from = from;
      if (to) params.p_to = to;
      const { data, error } = await supabase.rpc("fin_expense_breakdown", params as any);
      if (error) throw error;
      return (data as unknown as ExpenseCategory[]) || [];
    },
    staleTime: 120_000,
  });
}

export function useCashflowTrend(days = 14) {
  return useQuery<CashflowDay[]>({
    queryKey: ["fin-cashflow-trend", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fin_cashflow_trend", { p_days: days });
      if (error) throw error;
      return (data as unknown as CashflowDay[]) || [];
    },
    staleTime: 120_000,
  });
}
