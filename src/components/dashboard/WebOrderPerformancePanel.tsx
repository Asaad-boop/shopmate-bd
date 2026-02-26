import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useWebOrderPerformance, type WebOrderPerformance } from "@/hooks/use-dashboard-analytics";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { formatNumber } from "@/lib/format";

const COLORS = [
  "hsl(160, 84%, 39%)",  // complete - teal/success
  "hsl(215, 16%, 65%)",  // no response - muted
  "hsl(38, 92%, 50%)",   // good but no response - orange/warning
  "hsl(0, 84%, 60%)",    // cancel - red
];

const LABELS = ["Complete", "No Response", "Good (No Response)", "Cancel"];

export function WebOrderPerformancePanel() {
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const { data, isLoading } = useWebOrderPerformance(days);

  const chartData = data ? [
    { name: "Complete", value: data.complete, key: "delivered" },
    { name: "No Response", value: data.no_response, key: "pending" },
    { name: "Good (No Response)", value: data.good_no_response, key: "in_transit" },
    { name: "Cancel", value: data.cancel, key: "cancelled" },
  ].filter(d => d.value > 0) : [];

  const total = data?.total ?? 0;

  if (isLoading) return <Card className="border-0 shadow-sm rounded-[18px]"><CardContent className="p-6"><Skeleton className="h-[260px] rounded-2xl" /></CardContent></Card>;

  return (
    <Card className="border-0 shadow-sm rounded-[18px] hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Web Order Performance
        </CardTitle>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[110px] h-8 text-xs bg-accent/30 border-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Today</SelectItem>
            <SelectItem value="2">Yesterday</SelectItem>
            <SelectItem value="7">7 Days</SelectItem>
            <SelectItem value="30">30 Days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        <div className="flex items-center gap-6">
          {/* Donut */}
          <div className="relative w-[160px] h-[160px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%" cy="50%"
                  innerRadius={48} outerRadius={72}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                >
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[["Complete", "No Response", "Good (No Response)", "Cancel"].indexOf(chartData[i]?.name) % COLORS.length]}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`/web-orders?status=${chartData[i]?.key}`)}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold font-mono">{formatNumber(total)}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2.5">
            {[
              { label: "Complete", value: data?.complete ?? 0, color: COLORS[0] },
              { label: "No Response", value: data?.no_response ?? 0, color: COLORS[1] },
              { label: "Good (No Response)", value: data?.good_no_response ?? 0, color: COLORS[2] },
              { label: "Cancel", value: data?.cancel ?? 0, color: COLORS[3] },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold">{formatNumber(item.value)}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
