import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useExecutiveDashboard } from "@/hooks/use-reports-engine";
import { formatBDT } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { DollarSign, TrendingUp, Wallet, Boxes, Truck, Package } from "lucide-react";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

function MetricCard({ title, value, icon: Icon, color }: { title: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <Card className="border-border/50 hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-xl font-bold" style={mono}>{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExecutiveDashboardTab() {
  const { data, isLoading } = useExecutiveDashboard();

  if (isLoading) return <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricCard title="Today Revenue" value={formatBDT(data?.todayRevenue || 0)} icon={DollarSign} color="bg-emerald-50 text-emerald-600" />
        <MetricCard title="Today Net Profit" value={formatBDT(data?.todayProfit || 0)} icon={TrendingUp} color="bg-blue-50 text-blue-600" />
        <MetricCard title="Today Orders" value={String(data?.todayOrders || 0)} icon={Package} color="bg-violet-50 text-violet-600" />
        <MetricCard title="Cash Position" value={formatBDT(data?.cashPosition || 0)} icon={Wallet} color="bg-amber-50 text-amber-600" />
        <MetricCard title="Inventory Value" value={formatBDT(data?.inventoryValue || 0)} icon={Boxes} color="bg-cyan-50 text-cyan-600" />
        <MetricCard title="Courier Outstanding" value="—" icon={Truck} color="bg-pink-50 text-pink-600" />
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2"><CardTitle style={heading}>Revenue & Profit Trend (6 Months)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.trendData || []} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatBDT(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" name="Profit" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
