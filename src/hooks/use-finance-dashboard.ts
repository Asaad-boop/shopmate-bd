import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

interface PostingQueue {
  pending_advances: number;
  pending_delivered: number;
  pending_settlements: number;
  pending_expenses: number;
}

interface SettlementSummary {
  statements_this_week: number;
  orders_matched: number;
  orders_posted: number;
  mismatch_count: number;
}

interface FinanceAlerts {
  settlement_pending_5d: number;
  duplicate_posting_blocked: number;
  unmapped_methods: number;
  negative_stock_finance: number;
}

export function useFinanceCashPosition() {
  return useQuery<CashPosition>({
    queryKey: ["finance-cash-position"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_cash_position");
      if (error) throw error;
      return data as unknown as CashPosition;
    },
    refetchInterval: 120_000,
  });
}

export function useFinanceWorkingCapital() {
  return useQuery<WorkingCapital>({
    queryKey: ["finance-working-capital"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_working_capital");
      if (error) throw error;
      return data as unknown as WorkingCapital;
    },
    refetchInterval: 120_000,
  });
}

export function useFinancePostingQueue() {
  return useQuery<PostingQueue>({
    queryKey: ["finance-posting-queue"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_posting_queue_summary");
      if (error) throw error;
      return data as unknown as PostingQueue;
    },
    refetchInterval: 60_000,
  });
}

export function useFinanceSettlementSummary() {
  return useQuery<SettlementSummary>({
    queryKey: ["finance-settlement-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_settlement_summary");
      if (error) throw error;
      return data as unknown as SettlementSummary;
    },
    refetchInterval: 120_000,
  });
}

export function useFinanceAlerts() {
  return useQuery<FinanceAlerts>({
    queryKey: ["finance-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_alerts");
      if (error) throw error;
      return data as unknown as FinanceAlerts;
    },
    refetchInterval: 60_000,
  });
}
