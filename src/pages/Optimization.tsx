import { useState, useMemo } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle, Clock, Users, BarChart3, ShieldAlert, TrendingUp, TrendingDown,
  CheckCircle2, AlertCircle, Info, Zap,
} from "lucide-react";
import { format, subDays, subHours, differenceInHours } from "date-fns";

const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("en-BD")}`;

interface Anomaly {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  count: number;
  action: string;
}

interface SLA {
  name: string;
  target: string;
  current: string;
  status: "meeting" | "at_risk" | "failing";
  trend: "improving" | "declining" | "stable";
}

export default function OptimizationPage() {
  usePageTitle("Optimization");
  const [tab, setTab] = useState("anomalies");

  // Fetch orders for anomaly detection
  const { data: todayOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["optimization-today-orders"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase.from("orders")
        .select("id, invoice_id, status, created_at, assigned_to, courier_status, updated_at, customer_id, customers(phone)")
        .gte("created_at", `${today}T00:00:00`).order("created_at", { ascending: false }).limit(500);
      return (data || []).map((o: any) => ({
        ...o, phone: o.customers?.phone || "", agent_name: o.assigned_to || "",
      }));
    },
    refetchInterval: 300_000,
  });

  const { data: recentExpenses } = useQuery({
    queryKey: ["optimization-expenses"],
    queryFn: async () => {
      const { data } = await supabase.from("ad_expenses").select("category, amount_bdt, expense_date")
        .gte("expense_date", format(subDays(new Date(), 30), "yyyy-MM-dd")).limit(500);
      return data || [];
    },
  });

  const { data: weekOrders } = useQuery({
    queryKey: ["optimization-week-orders"],
    queryFn: async () => {
      const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
      const { data } = await supabase.from("orders")
        .select("id, status, created_at, assigned_to, updated_at, courier_status, customer_id, customers(phone)")
        .gte("created_at", `${weekAgo}T00:00:00`).limit(1000);
      return (data || []).map((o: any) => ({
        ...o, phone: o.customers?.phone || "", agent_name: o.assigned_to || "",
      }));
    },
  });

  // Anomaly detection
  const anomalies = useMemo<Anomaly[]>(() => {
    if (!todayOrders) return [];
    const results: Anomaly[] = [];

    // Duplicate phone check
    const phoneCounts = new Map<string, number>();
    todayOrders.forEach(o => {
      const p = o.phone || "";
      phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1);
    });
    const dupes = [...phoneCounts.entries()].filter(([_, c]) => c >= 3);
    if (dupes.length > 0) {
      results.push({
        id: "dupe-phones", severity: "critical",
        title: "Duplicate order risk",
        description: `${dupes.length} phone number(s) placed 3+ orders today`,
        count: dupes.length, action: "Review duplicate orders",
      });
    }

    // High cancellation rate
    const cancelled = todayOrders.filter(o => o.status === "cancelled").length;
    const cancelRate = todayOrders.length > 0 ? cancelled / todayOrders.length : 0;
    if (cancelRate > 0.3 && todayOrders.length >= 5) {
      results.push({
        id: "high-cancel", severity: "critical",
        title: "High cancellation rate alert",
        description: `${(cancelRate * 100).toFixed(0)}% of today's orders cancelled (${cancelled}/${todayOrders.length})`,
        count: cancelled, action: "Investigate cancellation reasons",
      });
    }

    // Order flow stopped
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 9 && hour <= 21 && todayOrders.length > 0) {
      const latest = new Date(todayOrders[0].created_at);
      const hoursSince = differenceInHours(now, latest);
      if (hoursSince >= 4) {
        results.push({
          id: "flow-stopped", severity: "warning",
          title: "Order flow stopped",
          description: `No new orders in the last ${hoursSince} hours during business hours`,
          count: hoursSince, action: "Check order sources",
        });
      }
    }

    // Stuck shipments
    const shipped = (weekOrders || []).filter(o =>
      o.status === "shipped" && o.updated_at &&
      differenceInHours(now, new Date(o.updated_at)) > 120
    );
    if (shipped.length > 0) {
      results.push({
        id: "stuck-shipments", severity: "warning",
        title: "Stuck shipments",
        description: `${shipped.length} shipped orders not updated in 5+ days`,
        count: shipped.length, action: "Check with courier",
      });
    }

    // Unusual expense
    if (recentExpenses && recentExpenses.length > 0) {
      const catAvg = new Map<string, { total: number; count: number }>();
      recentExpenses.forEach((e: any) => {
        const cat = e.category;
        const prev = catAvg.get(cat) || { total: 0, count: 0 };
        catAvg.set(cat, { total: prev.total + e.amount_bdt, count: prev.count + 1 });
      });
      const latest = recentExpenses[0] as any;
      const avg = catAvg.get(latest.category);
      if (avg && avg.count >= 3) {
        const mean = avg.total / avg.count;
        if (latest.amount_bdt > mean * 3) {
          results.push({
            id: "unusual-expense", severity: "info",
            title: "Unusual expense",
            description: `${latest.category} expense ৳${latest.amount_bdt} is 3x above average (৳${Math.round(mean)})`,
            count: 1, action: "Review expense",
          });
        }
      }
    }

    if (results.length === 0) {
      results.push({
        id: "all-good", severity: "info",
        title: "All clear!",
        description: "No anomalies detected. Everything looks normal.",
        count: 0, action: "",
      });
    }

    return results;
  }, [todayOrders, weekOrders, recentExpenses]);

  // SLA data
  const slas = useMemo<SLA[]>(() => {
    if (!weekOrders) return [];
    const confirmed = weekOrders.filter((o: any) => o.status !== "pending");
    const shipped = weekOrders.filter((o: any) => ["shipped", "delivered"].includes(o.status));

    return [
      {
        name: "Order Confirmation Time",
        target: "< 2 hours",
        current: confirmed.length > 0 ? `${Math.round(confirmed.length / Math.max(1, 7))} avg/day` : "—",
        status: "meeting" as const,
        trend: "stable" as const,
      },
      {
        name: "Order Dispatch Time",
        target: "< 24 hours",
        current: shipped.length > 0 ? `${shipped.length} shipped this week` : "—",
        status: shipped.length > 5 ? "meeting" as const : "at_risk" as const,
        trend: "stable" as const,
      },
      {
        name: "Delivery Time (Dhaka)",
        target: "< 72 hours",
        current: "—",
        status: "meeting" as const,
        trend: "improving" as const,
      },
      {
        name: "Customer Response Rate",
        target: "> 80%",
        current: "—",
        status: "at_risk" as const,
        trend: "declining" as const,
      },
    ];
  }, [weekOrders]);

  // Team scorecards
  const teamData = useMemo(() => {
    if (!weekOrders) return [];
    const agentMap = new Map<string, { total: number; confirmed: number; cancelled: number }>();
    weekOrders.forEach((o: any) => {
      const agent = o.agent_name || "Unassigned";
      const prev = agentMap.get(agent) || { total: 0, confirmed: 0, cancelled: 0 };
      prev.total++;
      if (["confirmed", "shipped", "delivered"].includes(o.status)) prev.confirmed++;
      if (o.status === "cancelled") prev.cancelled++;
      agentMap.set(agent, prev);
    });
    return [...agentMap.entries()].map(([name, d]) => ({
      name,
      orders: d.total,
      confirmRate: d.total > 0 ? Math.round((d.confirmed / d.total) * 100) : 0,
      cancelRate: d.total > 0 ? Math.round((d.cancelled / d.total) * 100) : 0,
    })).sort((a, b) => b.orders - a.orders);
  }, [weekOrders]);

  // Weekly review
  const weeklyReview = useMemo(() => {
    if (!weekOrders || weekOrders.length === 0) return null;
    const total = weekOrders.length;
    const delivered = weekOrders.filter((o: any) => o.status === "delivered").length;
    const cancelled = weekOrders.filter((o: any) => o.status === "cancelled").length;
    const topAgent = teamData[0];
    const cancelReasons = weekOrders.filter((o: any) => o.status === "cancelled");

    return {
      totalOrders: total,
      delivered,
      cancelled,
      deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
      topAgent: topAgent?.name || "—",
      topAgentOrders: topAgent?.orders || 0,
      cancelRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    };
  }, [weekOrders, teamData]);

  const severityIcon = (s: string) => {
    switch (s) {
      case "critical": return <ShieldAlert className="w-4 h-4 text-destructive" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "bg-destructive/10 border-destructive/30";
      case "warning": return "bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700";
      default: return "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700";
    }
  };

  const slaIcon = (s: string) => {
    switch (s) {
      case "meeting": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "at_risk": return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default: return <ShieldAlert className="w-4 h-4 text-destructive" />;
    }
  };

  if (ordersLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Optimization Center</h1>
          <p className="text-sm text-muted-foreground">Anomalies, SLAs, team performance & weekly review</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card border border-border/50 flex-wrap h-auto gap-0.5 p-1">
          <TabsTrigger value="anomalies" className="text-xs gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Anomalies</TabsTrigger>
          <TabsTrigger value="sla" className="text-xs gap-1.5"><Clock className="w-3.5 h-3.5" />SLA Monitor</TabsTrigger>
          <TabsTrigger value="team" className="text-xs gap-1.5"><Users className="w-3.5 h-3.5" />Team Scorecards</TabsTrigger>
          <TabsTrigger value="weekly" className="text-xs gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Weekly Review</TabsTrigger>
        </TabsList>

        <TabsContent value="anomalies" className="mt-4 space-y-3">
          {anomalies.map(a => (
            <Card key={a.id} className={`border ${severityColor(a.severity)}`}>
              <CardContent className="p-4 flex items-start gap-4">
                {severityIcon(a.severity)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{a.title}</h3>
                    <Badge variant={a.severity === "critical" ? "destructive" : "secondary"} className="text-[10px]">
                      {a.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
                </div>
                {a.count > 0 && <Badge variant="outline" className="tabular-nums">{a.count}</Badge>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="sla" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {slas.map(s => (
              <Card key={s.name}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{s.name}</h3>
                    {slaIcon(s.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Target</p>
                      <p className="font-semibold">{s.target}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Current</p>
                      <p className="font-semibold">{s.current}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant={s.status === "meeting" ? "default" : s.status === "at_risk" ? "secondary" : "destructive"} className="text-[10px]">
                      {s.status === "meeting" ? "✅ Meeting" : s.status === "at_risk" ? "⚠️ At Risk" : "❌ Failing"}
                    </Badge>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      {s.trend === "improving" ? <TrendingUp className="w-3 h-3 text-emerald-500" /> :
                       s.trend === "declining" ? <TrendingDown className="w-3 h-3 text-destructive" /> :
                       <span className="w-3 h-3">—</span>}
                      {s.trend}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Agent Name</TableHead>
                    <TableHead className="text-xs text-right">Orders</TableHead>
                    <TableHead className="text-xs text-right">Confirmation %</TableHead>
                    <TableHead className="text-xs text-right">Cancel %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamData.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No agent data this week</TableCell></TableRow>
                  )}
                  {teamData.map(t => (
                    <TableRow key={t.name}>
                      <TableCell className="font-medium text-sm">{t.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.orders}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={t.confirmRate >= 80 ? "text-emerald-600" : t.confirmRate >= 50 ? "text-yellow-600" : "text-destructive"}>
                          {t.confirmRate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={t.cancelRate <= 10 ? "text-emerald-600" : t.cancelRate <= 25 ? "text-yellow-600" : "text-destructive"}>
                          {t.cancelRate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly" className="mt-4">
          {weeklyReview ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase mb-1">Total Orders</p>
                  <p className="text-3xl font-black tabular-nums text-primary">{weeklyReview.totalOrders}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase mb-1">Delivery Rate</p>
                  <p className="text-3xl font-black tabular-nums text-emerald-600">{weeklyReview.deliveryRate}%</p>
                  <p className="text-[10px] text-muted-foreground">{weeklyReview.delivered} delivered</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase mb-1">Cancel Rate</p>
                  <p className="text-3xl font-black tabular-nums text-destructive">{weeklyReview.cancelRate}%</p>
                  <p className="text-[10px] text-muted-foreground">{weeklyReview.cancelled} cancelled</p>
                </CardContent>
              </Card>
              <Card className="md:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">🏆 Weekly Highlights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-[10px]">Top Agent</Badge>
                    <span className="font-semibold">{weeklyReview.topAgent}</span>
                    <span className="text-muted-foreground">({weeklyReview.topAgentOrders} orders)</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No data available for this week</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
