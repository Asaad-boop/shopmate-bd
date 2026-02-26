import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderFlowTrend } from "@/hooks/use-dashboard-analytics";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatNumber } from "@/lib/format";

export function OrderFlowTrendPanel() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const { data, isLoading } = useOrderFlowTrend(days);

  if (isLoading) return <Card className="border-0 shadow-sm rounded-[18px]"><CardContent className="p-6"><Skeleton className="h-[280px] rounded-2xl" /></CardContent></Card>;

  const chartDays = data?.days || [];

  return (
    <Card className="border-0 shadow-sm rounded-[18px] hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Order Flow
        </CardTitle>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "hsl(var(--primary))" }} />
              Created: <b className="font-mono">{formatNumber(data?.total_created)}</b>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "hsl(160, 84%, 39%)" }} />
              Sent: <b className="font-mono">{formatNumber(data?.total_sent)}</b>
            </span>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[80px] h-8 text-xs bg-accent/30 border-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7d</SelectItem>
              <SelectItem value="30">30d</SelectItem>
              <SelectItem value="90">90d</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartDays} barGap={2} barSize={days > 30 ? 4 : 8}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="day" tick={{ fontSize: 10 }}
              interval={days > 30 ? Math.floor(days / 10) : days > 14 ? 2 : 0}
            />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                borderRadius: 14, fontSize: 12,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 8px 24px -8px hsl(var(--foreground) / 0.08)",
              }}
              cursor={{ fill: "hsl(var(--accent))", radius: 4 }}
            />
            <Bar
              dataKey="created" name="Created" fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]} opacity={0.85}
              onClick={(d: any) => navigate(`/orders?date=${d.date}`)}
              className="cursor-pointer"
            />
            <Bar
              dataKey="sent" name="Sent to Courier" fill="hsl(160, 84%, 39%)"
              radius={[4, 4, 0, 0]} opacity={0.85}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
