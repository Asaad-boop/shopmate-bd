import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrdersBySource } from "@/hooks/use-dashboard-analytics";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatBDT, formatNumber } from "@/lib/format";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const SOURCE_COLORS: Record<string, string> = {
  shopify: "hsl(160, 84%, 39%)",
  website: "hsl(160, 84%, 39%)",
  web: "hsl(160, 84%, 39%)",
  facebook: "hsl(217, 91%, 60%)",
  whatsapp: "hsl(142, 70%, 45%)",
  manual: "hsl(215, 16%, 55%)",
  phone: "hsl(38, 92%, 50%)",
  instagram: "hsl(330, 80%, 55%)",
  direct: "hsl(262, 83%, 58%)",
};

function getColor(src: string, i: number) {
  return SOURCE_COLORS[src.toLowerCase()] || `hsl(${(i * 67 + 200) % 360}, 60%, 55%)`;
}

export function OrdersBySourcePanel({ from, to }: { from?: string; to?: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useOrdersBySource(from, to);

  if (isLoading) return <Card className="border-0 shadow-sm rounded-[18px]"><CardContent className="p-6"><Skeleton className="h-[260px] rounded-2xl" /></CardContent></Card>;

  const sources = data?.sources || [];
  const chartData = sources.map((s, i) => ({ ...s, fill: getColor(s.source, i) }));

  return (
    <Card className="border-0 shadow-sm rounded-[18px] hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Orders by Source
        </CardTitle>
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
                  dataKey="count"
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                >
                  {chartData.map((s, i) => (
                    <Cell
                      key={i} fill={s.fill}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`/orders?source=${s.source}`)}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold font-mono">{formatNumber(data?.total_orders)}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Orders</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 max-h-[180px] overflow-y-auto space-y-2 pr-1">
            {chartData.map((s, i) => (
              <button
                key={i}
                onClick={() => navigate(`/orders?source=${s.source}`)}
                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                  <span className="text-xs font-medium capitalize truncate">{s.source}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono font-semibold">{s.count}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{formatBDT(s.revenue)}</span>
                  <span className={`inline-flex items-center text-[10px] font-semibold ${s.growth_pct >= 0 ? "text-success" : "text-destructive"}`}>
                    {s.growth_pct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(s.growth_pct)}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>Total Value</span>
          <span className="font-mono font-semibold text-foreground">{formatBDT(data?.total_value)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
