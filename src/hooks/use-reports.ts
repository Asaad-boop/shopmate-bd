import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import {
  startOfMonth, endOfMonth, subMonths, format, differenceInDays, eachDayOfInterval,
} from "date-fns";

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

export function useReportPeriod() {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, i);
    return { label: format(d, "MMM yyyy"), start: startOfMonth(d), end: endOfMonth(d) };
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const current = months[selectedIndex];
  const prev = months[Math.min(selectedIndex + 1, months.length - 1)];

  return { months, selectedIndex, setSelectedIndex, current, prev };
}

// ── KPI Summary ──
export function useReportKPIs(dateRange: { start: Date; end: Date }, prevRange: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ["report-kpis", fmt(dateRange.start), fmt(dateRange.end)],
    queryFn: async () => {
      const [ordersRes, prevOrdersRes, deliveredRes, prevDeliveredRes, returnedRes, prevReturnedRes, cancelledRes] = await Promise.all([
        supabase.from("orders").select("id, total_amount, cost_of_goods, gross_profit, status")
          .gte("order_date", dateRange.start.toISOString()).lte("order_date", dateRange.end.toISOString()),
        supabase.from("orders").select("id, total_amount, cost_of_goods, gross_profit, status")
          .gte("order_date", prevRange.start.toISOString()).lte("order_date", prevRange.end.toISOString()),
        supabase.from("orders").select("id, total_amount, cost_of_goods, gross_profit")
          .in("status", ["delivered"]).gte("order_date", dateRange.start.toISOString()).lte("order_date", dateRange.end.toISOString()),
        supabase.from("orders").select("id, total_amount, cost_of_goods, gross_profit")
          .in("status", ["delivered"]).gte("order_date", prevRange.start.toISOString()).lte("order_date", prevRange.end.toISOString()),
        supabase.from("orders").select("id")
          .in("status", ["returned", "damage_return", "return_in_transit"]).gte("order_date", dateRange.start.toISOString()).lte("order_date", dateRange.end.toISOString()),
        supabase.from("orders").select("id")
          .in("status", ["returned", "damage_return", "return_in_transit"]).gte("order_date", prevRange.start.toISOString()).lte("order_date", prevRange.end.toISOString()),
        supabase.from("orders").select("id")
          .eq("status", "cancelled").gte("order_date", dateRange.start.toISOString()).lte("order_date", dateRange.end.toISOString()),
      ]);

      const orders = ordersRes.data || [];
      const prevOrders = prevOrdersRes.data || [];
      const delivered = deliveredRes.data || [];
      const prevDelivered = prevDeliveredRes.data || [];
      const returned = returnedRes.data || [];
      const prevReturned = prevReturnedRes.data || [];
      const cancelled = cancelledRes.data || [];

      const sum = (arr: any[], key: string) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);
      const pct = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);

      const totalOrders = orders.length;
      const prevTotalOrders = prevOrders.length;
      const revenue = sum(delivered, "total_amount");
      const prevRevenue = sum(prevDelivered, "total_amount");
      const cogs = sum(delivered, "cost_of_goods");
      const profit = revenue - cogs;
      const prevProfit = sum(prevDelivered, "total_amount") - sum(prevDelivered, "cost_of_goods");
      const returnRate = totalOrders > 0 ? Math.round((returned.length / totalOrders) * 100) : 0;
      const prevReturnRate = prevTotalOrders > 0 ? Math.round((prevReturned.length / prevTotalOrders) * 100) : 0;

      // Fetch expenses from both tables
      const [expRes, adExpRes] = await Promise.all([
        supabase.from("expenses").select("amount_bdt")
          .gte("expense_date", fmt(dateRange.start)).lte("expense_date", fmt(dateRange.end))
          .eq("is_reversed", false),
        supabase.from("ad_expenses").select("amount_bdt")
          .gte("expense_date", fmt(dateRange.start)).lte("expense_date", fmt(dateRange.end)),
      ]);
      const totalExpenses = sum(expRes.data || [], "amount_bdt") + sum(adExpRes.data || [], "amount_bdt");

      const [prevExpRes, prevAdExpRes] = await Promise.all([
        supabase.from("expenses").select("amount_bdt")
          .gte("expense_date", fmt(prevRange.start)).lte("expense_date", fmt(prevRange.end))
          .eq("is_reversed", false),
        supabase.from("ad_expenses").select("amount_bdt")
          .gte("expense_date", fmt(prevRange.start)).lte("expense_date", fmt(prevRange.end)),
      ]);
      const prevTotalExpenses = sum(prevExpRes.data || [], "amount_bdt") + sum(prevAdExpRes.data || [], "amount_bdt");

      return {
        totalOrders, prevTotalOrders, ordersChange: pct(totalOrders, prevTotalOrders),
        revenue, prevRevenue, revenueChange: pct(revenue, prevRevenue),
        profit, prevProfit, profitChange: pct(profit, prevProfit),
        cogs,
        totalExpenses, prevTotalExpenses, expensesChange: pct(totalExpenses, prevTotalExpenses),
        returnRate, prevReturnRate, returnRateChange: returnRate - prevReturnRate,
        deliveredCount: delivered.length,
        returnedCount: returned.length,
        cancelledCount: cancelled.length,
        profitMargin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
      };
    },
  });
}

// ── Daily Chart Data ──
export function useReportDailyChart(dateRange: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ["report-daily-chart", fmt(dateRange.start), fmt(dateRange.end)],
    queryFn: async () => {
      const { data } = await supabase.from("orders")
        .select("order_date, total_amount, cost_of_goods, status")
        .in("status", ["delivered"])
        .gte("order_date", dateRange.start.toISOString())
        .lte("order_date", dateRange.end.toISOString());

      const days = eachDayOfInterval({ start: dateRange.start, end: new Date() < dateRange.end ? new Date() : dateRange.end });
      const grouped: Record<string, { revenue: number; profit: number; orders: number }> = {};
      days.forEach(d => { grouped[fmt(d)] = { revenue: 0, profit: 0, orders: 0 }; });

      (data || []).forEach(o => {
        const d = o.order_date ? fmt(new Date(o.order_date)) : null;
        if (d && grouped[d]) {
          grouped[d].revenue += Number(o.total_amount) || 0;
          grouped[d].profit += (Number(o.total_amount) || 0) - (Number(o.cost_of_goods) || 0);
          grouped[d].orders += 1;
        }
      });

      return Object.entries(grouped)
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}

// ── Product Performance ──
export function useProductPerformance(dateRange: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ["report-product-perf", fmt(dateRange.start), fmt(dateRange.end)],
    queryFn: async () => {
      const { data: items } = await supabase.from("order_items")
        .select("product_id, quantity, unit_price, unit_cost, total_price, discount, orders!inner(status, order_date)")
        .gte("orders.order_date", dateRange.start.toISOString())
        .lte("orders.order_date", dateRange.end.toISOString())
        .in("orders.status", ["delivered"]);

      const { data: products } = await supabase.from("products")
        .select("id, name, sku, image_url, landed_cost_bdt");

      const productMap: Record<string, any> = {};
      (products || []).forEach(p => { productMap[p.id] = p; });

      const agg: Record<string, {
        product_id: string; name: string; sku: string; image_url: string | null;
        qty: number; revenue: number; cogs: number; profit: number; orders: Set<string>;
      }> = {};

      (items || []).forEach((item: any) => {
        const pid = item.product_id;
        if (!pid) return;
        if (!agg[pid]) {
          const p = productMap[pid];
          agg[pid] = {
            product_id: pid,
            name: p?.name || "Unknown",
            sku: p?.sku || "-",
            image_url: p?.image_url || null,
            qty: 0, revenue: 0, cogs: 0, profit: 0, orders: new Set(),
          };
        }
        const unitCost = Number(item.unit_cost) || Number(productMap[pid]?.landed_cost_bdt) || 0;
        const rev = Number(item.total_price) || 0;
        const cost = unitCost * item.quantity;
        agg[pid].qty += item.quantity;
        agg[pid].revenue += rev;
        agg[pid].cogs += cost;
        agg[pid].profit += rev - cost;
      });

      return Object.values(agg)
        .map(p => ({
          ...p,
          orders: p.orders.size || p.qty, // fallback
          unitProfit: p.qty > 0 ? Math.round(p.profit / p.qty) : 0,
          margin: p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);
    },
  });
}

// ── Courier Performance ──
export function useCourierPerformance(dateRange: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ["report-courier-perf", fmt(dateRange.start), fmt(dateRange.end)],
    queryFn: async () => {
      const { data } = await supabase.from("courier_history")
        .select("courier_name, status, order_id")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());

      const agg: Record<string, { total: number; delivered: number; returned: number; failed: number }> = {};
      (data || []).forEach(c => {
        const name = c.courier_name || "Unknown";
        if (!agg[name]) agg[name] = { total: 0, delivered: 0, returned: 0, failed: 0 };
        agg[name].total += 1;
        if (c.status === "delivered" || c.status === "Delivered") agg[name].delivered += 1;
        else if (c.status === "returned" || c.status === "Returned") agg[name].returned += 1;
        else if (c.status === "failed" || c.status === "delivery_failed") agg[name].failed += 1;
      });

      return Object.entries(agg).map(([name, v]) => ({
        name,
        ...v,
        successRate: v.total > 0 ? Math.round((v.delivered / v.total) * 100) : 0,
      })).sort((a, b) => b.total - a.total);
    },
  });
}

// ── Expense Breakdown ──
export function useExpenseBreakdownReport(dateRange: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ["report-expense-breakdown", fmt(dateRange.start), fmt(dateRange.end)],
    queryFn: async () => {
      const [expRes, adExpRes] = await Promise.all([
        supabase.from("expenses").select("category, amount_bdt")
          .gte("expense_date", fmt(dateRange.start)).lte("expense_date", fmt(dateRange.end))
          .eq("is_reversed", false),
        supabase.from("ad_expenses").select("category, amount_bdt")
          .gte("expense_date", fmt(dateRange.start)).lte("expense_date", fmt(dateRange.end)),
      ]);

      const grouped: Record<string, number> = {};
      [...(expRes.data || []), ...(adExpRes.data || [])].forEach(e => {
        const cat = e.category || "other";
        grouped[cat] = (grouped[cat] || 0) + Number(e.amount_bdt || 0);
      });

      return Object.entries(grouped)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
    },
  });
}
