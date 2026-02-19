import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

const COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899"];

export function DashboardCharts() {
  const { data: dailySales, isLoading: l1 } = useQuery({
    queryKey: ["dashboard-daily-sales"],
    queryFn: async () => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const { data, error } = await supabase
        .from("daily_sales_view")
        .select("*")
        .gte("date", d.toISOString().split("T")[0])
        .order("date");
      if (error) throw error;
      return (data || []).map((r) => ({
        date: new Date(r.date!).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        orders: Number(r.total_orders || 0),
        revenue: Number(r.total_revenue || 0),
      }));
    },
  });

  const { data: statusData, isLoading: l2 } = useQuery({
    queryKey: ["dashboard-order-status"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("status");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((o) => {
        const s = o.status || "pending";
        counts[s] = (counts[s] || 0) + 1;
      });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
  });

  const { data: topProducts, isLoading: l3 } = useQuery({
    queryKey: ["dashboard-top-products"],
    queryFn: async () => {
      const start = new Date();
      start.setDate(1);
      const { data, error } = await supabase
        .from("order_items")
        .select("product_id, quantity, total_price, products(name)")
        .gte("order_id", "");
      if (error) throw error;
      const map: Record<string, { name: string; qty: number; revenue: number }> = {};
      data.forEach((i: any) => {
        const id = i.product_id || "unknown";
        if (!map[id]) map[id] = { name: i.products?.name || "Unknown", qty: 0, revenue: 0 };
        map[id].qty += i.quantity || 0;
        map[id].revenue += i.total_price || 0;
      });
      return Object.values(map)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Sales Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Last 7 Days Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {l1 ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Order Status Pie */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Order Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {l2 ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  fontSize={11}
                >
                  {statusData?.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Top Selling Products</CardTitle>
        </CardHeader>
        <CardContent>
          {l3 ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" fontSize={12} />
                <YAxis dataKey="name" type="category" width={150} fontSize={12} />
                <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name="Revenue (৳)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
