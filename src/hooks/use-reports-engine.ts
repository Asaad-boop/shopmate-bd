import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const fmt = (d: Date) => format(d, "yyyy-MM-dd");
const sum = (arr: any[], key: string) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);

// ── GL-based P&L from posted journals ──
export function useGLProfitLoss(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["gl-pnl", dateFrom, dateTo],
    queryFn: async () => {
      const { data: lines } = await supabase
        .from("journal_lines")
        .select("debit, credit, account_id, description, journal_entries!inner(entry_date, status)")
        .eq("journal_entries.status", "posted")
        .gte("journal_entries.entry_date", dateFrom)
        .lte("journal_entries.entry_date", dateTo);

      const { data: accounts } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type, normal_balance");

      const acctMap: Record<string, any> = {};
      (accounts || []).forEach((a) => { acctMap[a.id] = a; });

      const grouped: Record<string, { name: string; code: string; type: string; debit: number; credit: number; net: number }> = {};

      (lines || []).forEach((l: any) => {
        const acct = acctMap[l.account_id];
        if (!acct) return;
        if (!grouped[l.account_id]) {
          grouped[l.account_id] = { name: acct.name, code: acct.code, type: acct.account_type, debit: 0, credit: 0, net: 0 };
        }
        grouped[l.account_id].debit += Number(l.debit) || 0;
        grouped[l.account_id].credit += Number(l.credit) || 0;
      });

      // Calculate net balances
      Object.values(grouped).forEach((g) => {
        if (g.type === "income") g.net = g.credit - g.debit;
        else g.net = g.debit - g.credit;
      });

      const byType = (type: string) => Object.values(grouped).filter((g) => g.type === type);
      const sumNet = (items: any[]) => items.reduce((s, i) => s + i.net, 0);

      const income = byType("income");
      const cogs = byType("cogs");
      const expense = byType("expense");

      const totalRevenue = sumNet(income);
      const totalCogs = sumNet(cogs);
      const grossProfit = totalRevenue - totalCogs;
      const totalExpenses = sumNet(expense);
      const netProfit = grossProfit - totalExpenses;

      return {
        income, cogs, expense,
        totalRevenue, totalCogs, grossProfit, totalExpenses, netProfit,
        netMargin: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0,
      };
    },
  });
}

// ── Balance Snapshot ──
export function useBalanceSnapshot(asOfDate: string) {
  return useQuery({
    queryKey: ["balance-snapshot", asOfDate],
    queryFn: async () => {
      const { data: lines } = await supabase
        .from("journal_lines")
        .select("debit, credit, account_id, journal_entries!inner(entry_date, status)")
        .eq("journal_entries.status", "posted")
        .lte("journal_entries.entry_date", asOfDate);

      const { data: accounts } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type, normal_balance");

      const acctMap: Record<string, any> = {};
      (accounts || []).forEach((a) => { acctMap[a.id] = a; });

      const balances: Record<string, { name: string; code: string; type: string; balance: number }> = {};
      (lines || []).forEach((l: any) => {
        const acct = acctMap[l.account_id];
        if (!acct) return;
        if (!balances[l.account_id]) {
          balances[l.account_id] = { name: acct.name, code: acct.code, type: acct.account_type, balance: 0 };
        }
        if (acct.account_type === "asset" || acct.account_type === "cogs" || acct.account_type === "expense") {
          balances[l.account_id].balance += (Number(l.debit) || 0) - (Number(l.credit) || 0);
        } else {
          balances[l.account_id].balance += (Number(l.credit) || 0) - (Number(l.debit) || 0);
        }
      });

      const assets = Object.values(balances).filter((b) => b.type === "asset");
      const liabilities = Object.values(balances).filter((b) => b.type === "liability");
      const totalAssets = sum(assets, "balance");
      const totalLiabilities = sum(liabilities, "balance");
      const totalIncome = sum(Object.values(balances).filter((b) => b.type === "income"), "balance");
      const totalExpense = sum(Object.values(balances).filter((b) => b.type === "expense" || b.type === "cogs"), "balance");
      const retainedEarnings = totalIncome - totalExpense;
      const equity = retainedEarnings;

      return { assets, liabilities, totalAssets, totalLiabilities, retainedEarnings, equity, balanced: Math.abs(totalAssets - totalLiabilities - equity) < 1 };
    },
  });
}

// ── Cashflow (Direct Method from GL cash/bank accounts) ──
export function useCashflowStatement(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["cashflow", dateFrom, dateTo],
    queryFn: async () => {
      // Get cash/bank account IDs
      const { data: cashAccts } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name")
        .in("code", ["1100", "1110"]);

      const cashIds = (cashAccts || []).map((a) => a.id);
      if (cashIds.length === 0) return { items: [], netCashflow: 0 };

      const { data: lines } = await supabase
        .from("journal_lines")
        .select("debit, credit, account_id, description, journal_entries!inner(entry_date, status, reference_type, description)")
        .eq("journal_entries.status", "posted")
        .gte("journal_entries.entry_date", dateFrom)
        .lte("journal_entries.entry_date", dateTo)
        .in("account_id", cashIds);

      const items: { label: string; amount: number; type: string }[] = [];
      const byRefType: Record<string, number> = {};

      (lines || []).forEach((l: any) => {
        const refType = l.journal_entries?.reference_type || "other";
        const net = (Number(l.debit) || 0) - (Number(l.credit) || 0);
        byRefType[refType] = (byRefType[refType] || 0) + net;
      });

      const refLabels: Record<string, string> = {
        courier: "Cash from Courier Settlements",
        order: "Cash from Orders",
        purchase: "Cash Paid to Suppliers",
        expense: "Cash Paid for Expenses",
        import: "Cash Paid for Imports",
        payroll: "Cash Paid for Payroll",
        other: "Other Cash Movements",
        manual: "Manual Adjustments",
      };

      Object.entries(byRefType).forEach(([ref, amount]) => {
        items.push({ label: refLabels[ref] || ref, amount, type: amount >= 0 ? "inflow" : "outflow" });
      });

      items.sort((a, b) => b.amount - a.amount);
      const netCashflow = items.reduce((s, i) => s + i.amount, 0);

      return { items, netCashflow };
    },
  });
}

// ── SKU Profitability ──
export function useSKUProfitability(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["sku-profitability", dateFrom, dateTo],
    queryFn: async () => {
      // Get delivered order items
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, quantity, unit_price, unit_cost, total_price, orders!inner(id, status, order_date, delivery_charge, total_amount)")
        .gte("orders.order_date", dateFrom + "T00:00:00")
        .lte("orders.order_date", dateTo + "T23:59:59")
        .in("orders.status", ["delivered"]);

      // Get returned items
      const { data: returnedItems } = await supabase
        .from("order_items")
        .select("product_id, quantity, orders!inner(status, order_date)")
        .gte("orders.order_date", dateFrom + "T00:00:00")
        .lte("orders.order_date", dateTo + "T23:59:59")
        .in("orders.status", ["returned", "damage_return"]);

      const { data: products } = await supabase.from("products").select("id, name, sku, image_url, landed_cost_bdt");

      // Get courier costs
      const { data: shipments } = await supabase
        .from("courier_shipments")
        .select("order_id, courier_delivery_fee, courier_cod_fee, courier_return_cost, courier_total_cost")
        .gte("created_at", dateFrom + "T00:00:00")
        .lte("created_at", dateTo + "T23:59:59");

      // Get expense allocations
      const { data: allocations } = await supabase
        .from("expense_allocation_lines")
        .select("product_id, allocated_amount, expense_allocations!inner(status, allocation_date)")
        .eq("expense_allocations.status", "posted")
        .gte("expense_allocations.allocation_date", dateFrom)
        .lte("expense_allocations.allocation_date", dateTo);

      const productMap: Record<string, any> = {};
      (products || []).forEach((p) => { productMap[p.id] = p; });

      const shipmentByOrder: Record<string, any> = {};
      (shipments || []).forEach((s: any) => { shipmentByOrder[s.order_id] = s; });

      const agg: Record<string, any> = {};

      (items || []).forEach((item: any) => {
        const pid = item.product_id;
        if (!pid) return;
        const p = productMap[pid];
        if (!agg[pid]) {
          agg[pid] = {
            product_id: pid, name: p?.name || "Unknown", sku: p?.sku || "-", image_url: p?.image_url,
            delivered_qty: 0, returned_qty: 0, revenue: 0, cogs: 0,
            delivery_cost: 0, cod_fee: 0, return_cost: 0, allocated_cost: 0,
            orders: new Set(),
          };
        }
        const unitCost = Number(item.unit_cost) || Number(p?.landed_cost_bdt) || 0;
        agg[pid].delivered_qty += item.quantity;
        agg[pid].revenue += Number(item.total_price) || 0;
        agg[pid].cogs += unitCost * item.quantity;
        agg[pid].orders.add(item.orders?.id);

        const ship = shipmentByOrder[item.orders?.id];
        if (ship) {
          // Allocate courier costs proportionally (simplified: split evenly by line)
          agg[pid].delivery_cost += (Number(ship.courier_delivery_fee) || 0) / ((items || []).filter((i: any) => i.orders?.id === item.orders?.id).length || 1);
          agg[pid].cod_fee += (Number(ship.courier_cod_fee) || 0) / ((items || []).filter((i: any) => i.orders?.id === item.orders?.id).length || 1);
        }
      });

      (returnedItems || []).forEach((item: any) => {
        if (agg[item.product_id]) agg[item.product_id].returned_qty += item.quantity;
      });

      (allocations || []).forEach((a: any) => {
        if (agg[a.product_id]) agg[a.product_id].allocated_cost += Number(a.allocated_amount) || 0;
      });

      return Object.values(agg).map((s: any) => {
        const grossProfit = s.revenue - s.cogs;
        const contribution = grossProfit - s.delivery_cost - s.cod_fee - s.return_cost;
        const netProfit = contribution - s.allocated_cost;
        const margin = s.revenue > 0 ? Math.round((netProfit / s.revenue) * 100) : 0;
        return {
          ...s,
          orders: s.orders.size,
          grossProfit, contribution, netProfit, margin,
          avg_sell_price: s.delivered_qty > 0 ? Math.round(s.revenue / s.delivered_qty) : 0,
        };
      }).sort((a: any, b: any) => b.revenue - a.revenue);
    },
  });
}

// ── Courier Performance (enhanced) ──
export function useCourierPerformanceReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["courier-performance-report", dateFrom, dateTo],
    queryFn: async () => {
      const { data: shipments } = await supabase
        .from("courier_shipments")
        .select("id, courier_id, booking_status, courier_delivery_fee, courier_cod_fee, courier_total_cost, courier_net_payable, couriers!inner(name)")
        .gte("created_at", dateFrom + "T00:00:00")
        .lte("created_at", dateTo + "T23:59:59");

      const agg: Record<string, any> = {};
      (shipments || []).forEach((s: any) => {
        const name = s.couriers?.name || "Unknown";
        if (!agg[name]) agg[name] = { name, total: 0, delivered: 0, returned: 0, totalCost: 0, totalCodFee: 0, netPayable: 0 };
        agg[name].total += 1;
        if (s.booking_status === "delivered") agg[name].delivered += 1;
        if (s.booking_status === "returned") agg[name].returned += 1;
        agg[name].totalCost += Number(s.courier_delivery_fee) || 0;
        agg[name].totalCodFee += Number(s.courier_cod_fee) || 0;
        agg[name].netPayable += Number(s.courier_net_payable) || 0;
      });

      return Object.values(agg).map((c: any) => ({
        ...c,
        deliveredPct: c.total > 0 ? Math.round((c.delivered / c.total) * 100) : 0,
        rtoPct: c.total > 0 ? Math.round((c.returned / c.total) * 100) : 0,
        avgCost: c.delivered > 0 ? Math.round(c.totalCost / c.delivered) : 0,
      })).sort((a: any, b: any) => b.total - a.total);
    },
  });
}

// ── Inventory Valuation ──
export function useInventoryValuation() {
  return useQuery({
    queryKey: ["inventory-valuation"],
    queryFn: async () => {
      const { data: stocks } = await supabase.from("v_stock_on_hand").select("*");
      const { data: products } = await supabase.from("products").select("id, name, sku, landed_cost_bdt");

      const productMap: Record<string, any> = {};
      (products || []).forEach((p) => { productMap[p.id] = p; });

      const items = (stocks || []).map((s: any) => {
        const p = productMap[s.product_id] || {};
        const avgCost = Number(s.avg_cost) || Number(p.landed_cost_bdt) || 0;
        const onHand = Number(s.on_hand) || 0;
        const reserved = Number(s.reserved) || 0;
        return {
          product_id: s.product_id, sku: s.sku || p.sku, name: p.name || s.sku,
          on_hand: onHand, reserved, available: onHand - reserved,
          avg_cost: avgCost, total_value: onHand * avgCost,
        };
      });

      const totalValue = items.reduce((s, i) => s + i.total_value, 0);
      const totalUnits = items.reduce((s, i) => s + i.on_hand, 0);

      return { items: items.sort((a, b) => b.total_value - a.total_value), totalValue, totalUnits };
    },
  });
}

// ── Supplier & Payable Report ──
export function useSupplierPayableReport() {
  return useQuery({
    queryKey: ["supplier-payable-report"],
    queryFn: async () => {
      const { data: suppliers } = await supabase.from("suppliers").select("id, name, country");

      const { data: grns } = await supabase
        .from("goods_receipts")
        .select("id, supplier_id, total_product_cost, status, receipt_date")
        .eq("status", "posted");

      const { data: payments } = await supabase
        .from("supplier_payments")
        .select("id, supplier_id, amount, status")
        .eq("status", "posted");

      const supplierMap: Record<string, any> = {};
      (suppliers || []).forEach((s) => {
        supplierMap[s.id] = { ...s, totalPurchase: 0, totalPaid: 0, outstanding: 0 };
      });

      (grns || []).forEach((g: any) => {
        if (supplierMap[g.supplier_id]) supplierMap[g.supplier_id].totalPurchase += Number(g.total_product_cost) || 0;
      });

      (payments || []).forEach((p: any) => {
        if (supplierMap[p.supplier_id]) supplierMap[p.supplier_id].totalPaid += Number(p.amount) || 0;
      });

      return Object.values(supplierMap).map((s: any) => ({
        ...s, outstanding: s.totalPurchase - s.totalPaid,
      })).sort((a: any, b: any) => b.outstanding - a.outstanding);
    },
  });
}

// ── Expense Analytics ──
export function useExpenseAnalytics(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["expense-analytics", dateFrom, dateTo],
    queryFn: async () => {
      const { data: expenses } = await supabase
        .from("expenses")
        .select("category, amount_bdt, expense_date")
        .gte("expense_date", dateFrom)
        .lte("expense_date", dateTo)
        .eq("is_reversed", false);

      const { data: adExpenses } = await supabase
        .from("ad_expenses")
        .select("category, amount_bdt, expense_date")
        .gte("expense_date", dateFrom)
        .lte("expense_date", dateTo);

      const all = [...(expenses || []), ...(adExpenses || [])];
      const byCategory: Record<string, number> = {};
      const byMonth: Record<string, number> = {};

      all.forEach((e) => {
        byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount_bdt);
        const m = e.expense_date?.slice(0, 7) || "unknown";
        byMonth[m] = (byMonth[m] || 0) + Number(e.amount_bdt);
      });

      const total = Object.values(byCategory).reduce((s, v) => s + v, 0);

      return {
        byCategory: Object.entries(byCategory)
          .map(([category, amount]) => ({ category, amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 }))
          .sort((a, b) => b.amount - a.amount),
        byMonth: Object.entries(byMonth)
          .map(([month, amount]) => ({ month, amount }))
          .sort((a, b) => a.month.localeCompare(b.month)),
        total,
      };
    },
  });
}

// ── Executive Dashboard ──
export function useExecutiveDashboard() {
  return useQuery({
    queryKey: ["executive-dashboard"],
    queryFn: async () => {
      const today = fmt(new Date());
      const monthStart = fmt(startOfMonth(new Date()));

      // Today's orders
      const { data: todayOrders } = await supabase
        .from("orders")
        .select("id, total_amount, cost_of_goods, status")
        .gte("order_date", today + "T00:00:00")
        .lte("order_date", today + "T23:59:59");

      const delivered = (todayOrders || []).filter((o: any) => o.status === "delivered");
      const todayRevenue = sum(delivered, "total_amount");
      const todayCogs = sum(delivered, "cost_of_goods");

      // Get GL balances for cash position
      const { data: cashLines } = await supabase
        .from("journal_lines")
        .select("debit, credit, account_id, journal_entries!inner(status)")
        .eq("journal_entries.status", "posted");

      const { data: cashAccts } = await supabase
        .from("chart_of_accounts")
        .select("id, code")
        .in("code", ["1100", "1110"]);

      const cashIds = new Set((cashAccts || []).map((a) => a.id));
      let cashPosition = 0;
      (cashLines || []).forEach((l: any) => {
        if (cashIds.has(l.account_id)) cashPosition += (Number(l.debit) || 0) - (Number(l.credit) || 0);
      });

      // Inventory value
      const { data: stocks } = await supabase.from("v_stock_on_hand").select("on_hand, avg_cost");
      const inventoryValue = (stocks || []).reduce((s, st: any) => s + ((Number(st.on_hand) || 0) * (Number(st.avg_cost) || 0)), 0);

      // Monthly revenue trend
      const trendData: { month: string; revenue: number; profit: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const ms = fmt(startOfMonth(d));
        const me = fmt(endOfMonth(d));
        const { data: monthOrders } = await supabase
          .from("orders")
          .select("total_amount, cost_of_goods")
          .eq("status", "delivered")
          .gte("order_date", ms + "T00:00:00")
          .lte("order_date", me + "T23:59:59");
        const rev = sum(monthOrders || [], "total_amount");
        const cogs = sum(monthOrders || [], "cost_of_goods");
        trendData.push({ month: format(d, "MMM"), revenue: rev, profit: rev - cogs });
      }

      return {
        todayRevenue,
        todayProfit: todayRevenue - todayCogs,
        todayOrders: (todayOrders || []).length,
        cashPosition,
        inventoryValue,
        trendData,
      };
    },
  });
}
