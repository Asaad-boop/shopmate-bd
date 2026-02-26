import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useHourlyOrders } from "@/hooks/use-dashboard-analytics";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function HourlyOrdersPanel() {
  const [source, setSource] = useState<string>("all");
  const { data, isLoading } = useHourlyOrders(source === "all" ? undefined : source);

  if (isLoading) return <Card className="border-0 shadow-sm rounded-[18px]"><CardContent className="p-6"><Skeleton className="h-[280px] rounded-2xl" /></CardContent></Card>;

  return (
    <Card className="border-0 shadow-sm rounded-[18px] hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Hourly Orders
        </CardTitle>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[120px] h-8 text-xs bg-accent/30 border-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="shopify">Web Orders</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        <div className="flex items-center gap-4 mb-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-[2px] rounded" style={{ backgroundColor: "hsl(var(--primary))" }} />
            Today
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-[2px] rounded border-b border-dashed" style={{ borderColor: "hsl(215, 16%, 65%)" }} />
            Yesterday
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label" tick={{ fontSize: 9 }}
              interval={2}
            />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                borderRadius: 14, fontSize: 12,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 8px 24px -8px hsl(var(--foreground) / 0.08)",
              }}
            />
            <Line
              type="monotone" dataKey="today" name="Today"
              stroke="hsl(var(--primary))" strokeWidth={2.5}
              dot={false} activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
            />
            <Line
              type="monotone" dataKey="yesterday" name="Yesterday"
              stroke="hsl(215, 16%, 65%)" strokeWidth={1.5}
              strokeDasharray="6 3" dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
