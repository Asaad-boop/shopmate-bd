import { useState, useMemo, useEffect, useCallback } from "react";
import { format, subDays, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, DollarSign, TrendingUp, ShoppingCart, Eye, Target, ArrowRight, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  useMetaCampaigns,
  useMetaCampaignMetrics,
  useSyncMetaAds,
  computeMetricsSummary,
  type MetaCampaign,
} from "@/hooks/use-meta-ads";

const DHAKA_TZ = "Asia/Dhaka";

type DatePreset = "today" | "yesterday" | "last7" | "last30" | "this_month" | "custom";

function getDhakaDate(offset = 0): Date {
  const now = new Date();
  const dhakaNow = toZonedTime(now, DHAKA_TZ);
  return subDays(dhakaNow, -offset);
}

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const dhakaNow = toZonedTime(new Date(), DHAKA_TZ);
  switch (preset) {
    case "today":
      return { from: format(dhakaNow, "yyyy-MM-dd"), to: format(dhakaNow, "yyyy-MM-dd") };
    case "yesterday": {
      const y = subDays(dhakaNow, 1);
      return { from: format(y, "yyyy-MM-dd"), to: format(y, "yyyy-MM-dd") };
    }
    case "last7":
      return { from: format(subDays(dhakaNow, 6), "yyyy-MM-dd"), to: format(dhakaNow, "yyyy-MM-dd") };
    case "last30":
      return { from: format(subDays(dhakaNow, 29), "yyyy-MM-dd"), to: format(dhakaNow, "yyyy-MM-dd") };
    case "this_month":
      return { from: format(startOfMonth(dhakaNow), "yyyy-MM-dd"), to: format(dhakaNow, "yyyy-MM-dd") };
    default:
      return { from: format(dhakaNow, "yyyy-MM-dd"), to: format(dhakaNow, "yyyy-MM-dd") };
  }
}

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
  { key: "this_month", label: "This Month" },
  { key: "custom", label: "Custom Range" },
];

export default function MetaAdsReport() {
  const [activePreset, setActivePreset] = useState<DatePreset>("today");
  const initialRange = getDateRange("today");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<MetaCampaign | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { data: campaigns, isLoading: campsLoading, refetch: refetchCampaigns } = useMetaCampaigns();
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useMetaCampaignMetrics(dateFrom, dateTo);
  const { data: detailMetrics } = useMetaCampaignMetrics(dateFrom, dateTo, selectedCampaign?.id);
  const syncMutation = useSyncMetaAds();

  const isLoading = campsLoading || metricsLoading;

  // Handle preset selection
  const handlePresetChange = useCallback((preset: DatePreset) => {
    setActivePreset(preset);
    if (preset !== "custom") {
      const range = getDateRange(preset);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  }, []);

  // Handle custom date changes
  const handleCustomDateFrom = useCallback((val: string) => {
    setActivePreset("custom");
    setDateFrom(val);
  }, []);
  const handleCustomDateTo = useCallback((val: string) => {
    setActivePreset("custom");
    setDateTo(val);
  }, []);

  // Auto-refresh every 30 mins, only when preset is "today"
  useEffect(() => {
    if (activePreset !== "today") return;

    const refresh = () => {
      refetchCampaigns();
      refetchMetrics();
      setLastUpdated(new Date());
    };

    const interval = setInterval(refresh, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activePreset, refetchCampaigns, refetchMetrics]);

  // Update lastUpdated when data loads
  useEffect(() => {
    if (!metricsLoading && metrics) {
      setLastUpdated(new Date());
    }
  }, [metrics, metricsLoading]);

  const handleManualSync = useCallback(() => {
    syncMutation.mutate(undefined, {
      onSuccess: () => {
        refetchCampaigns();
        refetchMetrics();
        setLastUpdated(new Date());
      },
    });
  }, [syncMutation, refetchCampaigns, refetchMetrics]);

  // Summary
  const summary = useMemo(() => computeMetricsSummary(metrics || []), [metrics]);

  // Daily chart data
  const dailyData = useMemo(() => {
    if (!metrics) return [];
    const grouped: Record<string, { date: string; spend_bdt: number; spend_usd: number }> = {};
    for (const m of metrics) {
      if (!grouped[m.metric_date]) {
        grouped[m.metric_date] = { date: m.metric_date, spend_bdt: 0, spend_usd: 0 };
      }
      grouped[m.metric_date].spend_bdt += m.spend_bdt || 0;
      grouped[m.metric_date].spend_usd += m.spend_usd || 0;
    }
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics]);

  // Campaign table data
  const campaignTableData = useMemo(() => {
    if (!campaigns || !metrics) return [];
    return campaigns
      .filter((c) => statusFilter === "all" || c.status === statusFilter)
      .map((c) => {
        const campMetrics = metrics.filter((m) => m.campaign_id === c.id);
        const agg = computeMetricsSummary(campMetrics);
        return { ...c, ...agg, lastSynced: c.synced_at };
      });
  }, [campaigns, metrics, statusFilter]);

  const fmt = (n: number) => n.toLocaleString("en-BD", { maximumFractionDigits: 0 });
  const fmtDec = (n: number) => n.toLocaleString("en-BD", { maximumFractionDigits: 2 });

  const statusColor = (s: string | null) => {
    if (s === "ACTIVE") return "bg-emerald-100 text-emerald-700";
    if (s === "PAUSED") return "bg-yellow-100 text-yellow-700";
    return "bg-muted text-muted-foreground";
  };

  const lastUpdatedStr = format(toZonedTime(lastUpdated, DHAKA_TZ), "h:mm a");

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with last updated */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meta Ads Report</h1>
          <p className="text-sm text-muted-foreground">Campaign performance & spend tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            🔄 Last updated: {lastUpdatedStr}
            {activePreset === "today" && (
              <span className="text-[10px] text-muted-foreground/60 ml-1">(auto-refresh 30m)</span>
            )}
          </span>
          <Button onClick={handleManualSync} disabled={syncMutation.isPending} size="sm">
            {syncMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Sync Now
          </Button>
        </div>
      </div>

      {/* Date Filter Pills + Custom Range + Status */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={activePreset === p.key ? "default" : "outline"}
              size="sm"
              onClick={() => handlePresetChange(p.key)}
              className="h-8 text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>
        {activePreset === "custom" && (
          <div className="flex gap-2 items-center">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40 h-8 text-xs" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40 h-8 text-xs" />
          </div>
        )}
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="PAUSED">Paused</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <SummaryCard icon={DollarSign} label="Total Spend BDT" value={`৳${fmt(summary.totalSpendBdt)}`} />
        <SummaryCard icon={DollarSign} label="Total Spend USD" value={`$${fmtDec(summary.totalSpendUsd)}`} />
        <SummaryCard icon={TrendingUp} label="ROAS" value={`${fmtDec(summary.roas)}x`} />
        <SummaryCard icon={ShoppingCart} label="Total Orders" value={fmt(summary.totalOrders)} />
        <SummaryCard icon={Target} label="CPO (BDT)" value={`৳${fmt(summary.cpo)}`} />
        <SummaryCard icon={Eye} label="Impressions" value={fmt(summary.totalImpressions)} />
      </div>

      {/* Daily Spend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Ad Spend (BDT)</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data for selected period</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "spend_bdt" ? [`৳${fmt(value)}`, "Spend BDT"] : [`$${fmtDec(value)}`, "Spend USD"]
                  }
                />
                <Bar dataKey="spend_bdt" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Campaign Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Spend BDT</TableHead>
                <TableHead className="text-right">Spend USD</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">CPO</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">CTR%</TableHead>
                <TableHead>Last Synced</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignTableData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    No campaigns found. Add a Meta Ad Account in Settings and sync.
                  </TableCell>
                </TableRow>
              ) : (
                campaignTableData.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCampaign(c)}>
                    <TableCell className="font-medium max-w-[200px] truncate">{c.campaign_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColor(c.status)}>{c.status || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">৳{fmt(c.totalSpendBdt)}</TableCell>
                    <TableCell className="text-right">${fmtDec(c.totalSpendUsd)}</TableCell>
                    <TableCell className="text-right">{fmtDec(c.roas)}x</TableCell>
                    <TableCell className="text-right">{c.totalOrders}</TableCell>
                    <TableCell className="text-right">৳{fmt(c.cpo)}</TableCell>
                    <TableCell className="text-right">{fmt(c.totalImpressions)}</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.lastSynced ? format(new Date(c.lastSynced), "dd MMM HH:mm") : "—"}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Campaign Detail Drawer */}
      <Sheet open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedCampaign?.campaign_name}</SheetTitle>
          </SheetHeader>
          {detailMetrics && (
            <div className="mt-4 space-y-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={detailMetrics}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="metric_date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`৳${fmt(v)}`, "Spend"]} />
                  <Bar dataKey="spend_bdt" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Spend BDT</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead className="text-right">CPO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailMetrics.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.metric_date}</TableCell>
                      <TableCell className="text-right">৳{fmt(m.spend_bdt)}</TableCell>
                      <TableCell className="text-right">{m.purchases}</TableCell>
                      <TableCell className="text-right">{fmtDec(m.roas)}x</TableCell>
                      <TableCell className="text-right">৳{fmt(m.cpo)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
