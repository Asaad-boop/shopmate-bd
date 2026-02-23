import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format, subDays, differenceInDays, isAfter, isBefore, parseISO } from "date-fns";
import { toast } from "@/hooks/use-toast";

export type Period = "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";

export function usePeriod() {
  const [period, setPeriod] = useState<Period>("this_month");
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "this_month": return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last_month": return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
      case "this_quarter": return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case "this_year": return { start: startOfYear(now), end: endOfYear(now) };
      case "custom": return customRange;
    }
  }, [period, customRange]);

  const prevRange = useMemo(() => {
    const days = differenceInDays(dateRange.end, dateRange.start) + 1;
    return { start: subDays(dateRange.start, days), end: subDays(dateRange.start, 1) };
  }, [dateRange]);

  return { period, setPeriod, dateRange, prevRange, customRange, setCustomRange };
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

export function useFinanceStats(dateRange: { start: Date; end: Date }, prevRange: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ["finance-stats", fmt(dateRange.start), fmt(dateRange.end)],
    queryFn: async () => {
      const [incomeRes, expenseRes, prevIncomeRes, prevExpenseRes, cashRes] = await Promise.all([
        supabase.from("transactions").select("amount").eq("type", "income")
          .gte("transaction_date", fmt(dateRange.start)).lte("transaction_date", fmt(dateRange.end)),
        supabase.from("transactions").select("amount").eq("type", "expense")
          .gte("transaction_date", fmt(dateRange.start)).lte("transaction_date", fmt(dateRange.end)),
        supabase.from("transactions").select("amount").eq("type", "income")
          .gte("transaction_date", fmt(prevRange.start)).lte("transaction_date", fmt(prevRange.end)),
        supabase.from("transactions").select("amount").eq("type", "expense")
          .gte("transaction_date", fmt(prevRange.start)).lte("transaction_date", fmt(prevRange.end)),
        supabase.from("accounts").select("balance").eq("is_active", true),
      ]);

      const sum = (rows: any[] | null) => (rows || []).reduce((s, r) => s + Number(r.amount || 0), 0);
      const income = sum(incomeRes.data);
      const expense = sum(expenseRes.data);
      const prevIncome = sum(prevIncomeRes.data);
      const prevExpense = sum(prevExpenseRes.data);
      const cash = sum(cashRes.data?.map((a: any) => ({ amount: a.balance })) ? cashRes.data : []);
      const cashTotal = (cashRes.data || []).reduce((s: number, r: any) => s + Number(r.balance || 0), 0);

      const pctChange = (cur: number, prev: number) => prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100);

      return {
        income, expense, prevIncome, prevExpense,
        netProfit: income - expense,
        profitMargin: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
        cashInHand: cashTotal,
        incomeChange: pctChange(income, prevIncome),
        expenseChange: pctChange(expense, prevExpense),
      };
    },
  });
}

export function useDailyChart(dateRange: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ["finance-daily-chart", fmt(dateRange.start), fmt(dateRange.end)],
    queryFn: async () => {
      const { data } = await supabase.from("transactions")
        .select("transaction_date, type, amount")
        .gte("transaction_date", fmt(dateRange.start))
        .lte("transaction_date", fmt(dateRange.end))
        .order("transaction_date");

      const grouped: Record<string, { date: string; income: number; expense: number }> = {};
      (data || []).forEach((t) => {
        const d = t.transaction_date || "";
        if (!grouped[d]) grouped[d] = { date: d, income: 0, expense: 0 };
        if (t.type === "income") grouped[d].income += Number(t.amount);
        else grouped[d].expense += Number(t.amount);
      });
      return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}

export function useExpenseBreakdown(dateRange: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ["finance-expense-breakdown", fmt(dateRange.start), fmt(dateRange.end)],
    queryFn: async () => {
      const { data } = await supabase.from("transactions")
        .select("category, amount")
        .eq("type", "expense")
        .gte("transaction_date", fmt(dateRange.start))
        .lte("transaction_date", fmt(dateRange.end));

      const grouped: Record<string, number> = {};
      (data || []).forEach((t) => {
        const cat = t.category || "Other";
        grouped[cat] = (grouped[cat] || 0) + Number(t.amount);
      });
      return Object.entries(grouped)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
    },
  });
}

export function useRecentTransactions(limit = 15) {
  return useQuery({
    queryKey: ["finance-recent-transactions", limit],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useTransactions(filters: {
  search?: string; dateFrom?: string; dateTo?: string;
  category?: string; type?: string; account?: string;
  page: number; pageSize: number;
}) {
  return useQuery({
    queryKey: ["finance-transactions", filters],
    queryFn: async () => {
      let query = supabase.from("transactions").select("*", { count: "exact" });

      if (filters.search) query = query.or(`description.ilike.%${filters.search}%,reference_type.ilike.%${filters.search}%`);
      if (filters.dateFrom) query = query.gte("transaction_date", filters.dateFrom);
      if (filters.dateTo) query = query.lte("transaction_date", filters.dateTo);
      if (filters.category) query = query.eq("category", filters.category);
      if (filters.type && filters.type !== "all") query = query.eq("type", filters.type);
      if (filters.account && filters.account !== "all") query = query.eq("payment_method", filters.account);

      const from = filters.page * filters.pageSize;
      const to = from + filters.pageSize - 1;
      query = query.order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: ["finance-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePayables() {
  return useQuery({
    queryKey: ["finance-payables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payables").select("*").order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useReceivables() {
  return useQuery({
    queryKey: ["finance-receivables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("receivables").select("*").order("expected_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (txn: {
      type: string; amount: number; transaction_date: string; category: string;
      payment_method?: string; account_id?: string; description?: string;
      reference_type?: string; reference_id?: string; auto_generated?: boolean;
      source_module?: string; source_id?: string;
    }) => {
      const { error } = await supabase.from("transactions").insert(txn);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      qc.invalidateQueries({ queryKey: ["finance-stats"] });
      qc.invalidateQueries({ queryKey: ["finance-recent-transactions"] });
      qc.invalidateQueries({ queryKey: ["finance-transactions"] });
      qc.invalidateQueries({ queryKey: ["finance-daily-chart"] });
      qc.invalidateQueries({ queryKey: ["finance-expense-breakdown"] });
      toast({ title: "Transaction saved", description: "Transaction has been recorded." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      qc.invalidateQueries({ queryKey: ["finance-stats"] });
      qc.invalidateQueries({ queryKey: ["finance-recent-transactions"] });
      qc.invalidateQueries({ queryKey: ["finance-transactions"] });
      toast({ title: "Deleted", description: "Transaction removed." });
    },
  });
}

export function useAddPayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { party_name: string; category?: string; description?: string; total_amount: number; due_date?: string }) => {
      const { error } = await supabase.from("payables").insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-payables"] });
      toast({ title: "Payable added" });
    },
  });
}

export function useAddReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: { source: string; description?: string; amount: number; expected_date?: string; reference?: string }) => {
      const { error } = await supabase.from("receivables").insert(r);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-receivables"] });
      toast({ title: "Receivable added" });
    },
  });
}

export function useMarkReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: rec, error: fetchErr } = await supabase.from("receivables").select("*").eq("id", id).single();
      if (fetchErr) throw fetchErr;
      // Create income transaction
      await supabase.from("transactions").insert({
        type: "income",
        amount: rec.amount,
        transaction_date: format(new Date(), "yyyy-MM-dd"),
        category: "receivable_collection",
        description: `Received: ${rec.description || rec.source}`,
        auto_generated: true,
        source_module: "receivables",
        source_id: id,
      });
      // Update receivable status
      const { error } = await supabase.from("receivables").update({ status: "received" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-receivables"] });
      qc.invalidateQueries({ queryKey: ["finance-stats"] });
      qc.invalidateQueries({ queryKey: ["finance-recent-transactions"] });
      toast({ title: "Marked as received", description: "Income transaction created." });
    },
  });
}

export const INCOME_CATEGORIES = [
  "sales_revenue", "delivery_charge_collected", "advance_payment", "receivable_collection", "other_income",
];
export const EXPENSE_CATEGORIES = [
  "product_cost", "shipping", "salary", "facebook_ads", "google_ads", "rent", "utilities", "returns_refunds", "other_expense",
];
export const CATEGORY_LABELS: Record<string, string> = {
  sales_revenue: "Sales Revenue",
  delivery_charge_collected: "Delivery Charge",
  advance_payment: "Advance Payment",
  receivable_collection: "Receivable Collection",
  other_income: "Other Income",
  product_cost: "Product Cost (COGS)",
  shipping: "Shipping / Courier",
  salary: "Salary & Staff",
  facebook_ads: "Facebook Ads",
  google_ads: "Google Ads",
  rent: "Rent",
  utilities: "Utilities",
  returns_refunds: "Returns & Refunds",
  other_expense: "Other Expenses",
};
export const CATEGORY_ICONS: Record<string, string> = {
  sales_revenue: "💰",
  delivery_charge_collected: "🚚",
  advance_payment: "💳",
  receivable_collection: "📥",
  other_income: "📈",
  product_cost: "🛒",
  shipping: "🚚",
  salary: "👥",
  facebook_ads: "📘",
  google_ads: "🔍",
  rent: "🏠",
  utilities: "⚡",
  returns_refunds: "↩️",
  other_expense: "📋",
};
export const CATEGORY_COLORS: Record<string, string> = {
  sales_revenue: "bg-emerald-100",
  delivery_charge_collected: "bg-blue-100",
  advance_payment: "bg-cyan-100",
  receivable_collection: "bg-teal-100",
  other_income: "bg-lime-100",
  product_cost: "bg-orange-100",
  shipping: "bg-indigo-100",
  salary: "bg-purple-100",
  facebook_ads: "bg-blue-100",
  google_ads: "bg-red-100",
  rent: "bg-amber-100",
  utilities: "bg-yellow-100",
  returns_refunds: "bg-rose-100",
  other_expense: "bg-gray-100",
};
