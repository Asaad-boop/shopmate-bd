import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useHourlyOrders } from "@/hooks/use-dashboard-analytics";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

export function HourlyOrdersPanel() {
  const [source, setSource] = useState<string>("all");
  const { data, isLoading } = useHourlyOrders(source === "all" ? undefined : source);
  const currentHour = new Date().getHours();

  return (
    <Card className="border-border rounded-xl">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Hourly Orders Today
        </CardTitle>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[120px] h-8 text-xs border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="shopify">Web Orders</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-[220px] rounded-xl" /> : (!data || data.length === 0) ? (
          <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">No hourly data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12, fontSize: 12,
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Bar dataKey="today" name="Today" radius={[3, 3, 0, 0]}>
                {(data || []).map((entry, i) => (
                  <Cell key={i}
                    fill={entry.hour === currentHour ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
