import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, formatNumber } from "@/lib/format";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  ShoppingCart,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  Clock,
  AlertTriangle,
  Bug,
} from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { RecentOrdersTable } from "@/components/dashboard/RecentOrdersTable";
import { GettingStartedChecklist } from "@/components/dashboard/GettingStartedChecklist";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: openIssues, isLoading: l6 } = useQuery({
    queryKey: ["dashboard-open-issues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_issues")
        .select("severity")
        .in("status", ["open", "in_progress"])
        .in("severity", ["critical", "high"]);
      if (error) throw error;
      return data.length;
    },
  });

  const { data: todayOrders, isLoading: l1 } = useQuery({
    queryKey: ["dashboard-today-orders"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("orders")
        .select("id, total_amount")
        .gte("order_date", today);
      if (error) throw error;
      return { count: data.length, revenue: data.reduce((s, o) => s + (o.total_amount || 0), 0) };
    },
  });

  const { data: monthStats, isLoading: l2 } = useQuery({
    queryKey: ["dashboard-month-stats"],
    queryFn: async () => {
      const start = new Date();
      start.setDate(1);
      const { data, error } = await supabase
        .from("orders")
        .select("total_amount, gross_profit, status")
        .gte("order_date", start.toISOString().split("T")[0]);
      if (error) throw error;
      const revenue = data.reduce((s, o) => s + (o.total_amount || 0), 0);
      const profit = data.reduce((s, o) => s + (o.gross_profit || 0), 0);
      return { revenue, profit };
    },
  });

  const { data: pendingCount, isLoading: l3 } = useQuery({
    queryKey: ["dashboard-pending"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: lowStockCount, isLoading: l4 } = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, stock_quantity, reorder_point")
        .eq("status", "active");
      if (error) throw error;
      return data.filter((p) => (p.stock_quantity || 0) <= (p.reorder_point || 10)).length;
    },
  });

  const { data: shopifyToday, isLoading: l5 } = useQuery({
    queryKey: ["dashboard-shopify-today"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("orders")
        .select("id, total_amount")
        .eq("channel", "shopify")
        .gte("order_date", today);
      if (error) throw error;
      return { count: data.length, revenue: data.reduce((s, o) => s + (o.total_amount || 0), 0) };
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Welcome back! Here's your business overview.</p>
      </div>

      {/* Getting Started Checklist */}
      <GettingStartedChecklist />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
        <KpiCard
          title="Today's Orders"
          value={formatNumber(todayOrders?.count)}
          subtitle={formatBDT(todayOrders?.revenue)}
          icon={<ShoppingCart className="w-5 h-5" />}
          loading={l1}
        />
        <KpiCard
          title="Shopify Today"
          value={formatNumber(shopifyToday?.count)}
          subtitle={formatBDT(shopifyToday?.revenue)}
          icon={<ShoppingBag className="w-5 h-5" />}
          loading={l5}
        />
        <KpiCard
          title="Monthly Revenue"
          value={formatBDT(monthStats?.revenue)}
          subtitle="This month"
          icon={<TrendingUp className="w-5 h-5" />}
          loading={l2}
        />
        <KpiCard
          title="Net Profit"
          value={formatBDT(monthStats?.profit)}
          subtitle="This month"
          icon={<DollarSign className="w-5 h-5" />}
          loading={l2}
        />
        <KpiCard
          title="Pending Orders"
          value={formatNumber(pendingCount)}
          subtitle="Needs action"
          icon={<Clock className="w-5 h-5" />}
          loading={l3}
        />
        <KpiCard
          title="Low Stock"
          value={formatNumber(lowStockCount)}
          subtitle="Products below reorder point"
          icon={<AlertTriangle className="w-5 h-5" />}
          loading={l4}
        />
        <div onClick={() => navigate("/system-health")} className="cursor-pointer">
          <KpiCard
            title="Open Bugs"
            value={formatNumber(openIssues)}
            subtitle="Critical & High severity"
            icon={<Bug className="w-5 h-5" />}
            loading={l6}
          />
        </div>
      </div>

      {/* Charts */}
      <DashboardCharts />

      {/* Recent Orders */}
      <RecentOrdersTable />
    </div>
  );
}
