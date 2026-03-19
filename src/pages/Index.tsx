import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, BarChart3, Truck, Wallet, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";
import { useAuth } from "@/hooks/use-auth";

const ExecutiveMode = lazy(() => import("@/components/dashboard/ExecutiveMode").then(m => ({ default: m.ExecutiveMode })));
const OperationsMode = lazy(() => import("@/components/dashboard/OperationsMode").then(m => ({ default: m.OperationsMode })));
const FinanceMode = lazy(() => import("@/components/dashboard/FinanceMode").then(m => ({ default: m.FinanceMode })));

type DashboardMode = "executive" | "operations" | "finance";

const MODE_CONFIG: { key: DashboardMode; label: string; icon: React.ElementType; emoji: string; activeClass: string }[] = [
  { key: "executive", label: "Executive", icon: BarChart3, emoji: "👔", activeClass: "bg-primary text-primary-foreground shadow-md" },
  { key: "operations", label: "Operations", icon: Truck, emoji: "⚙️", activeClass: "bg-[hsl(200,80%,50%)] text-white shadow-md" },
  { key: "finance", label: "Finance", icon: Wallet, emoji: "💰", activeClass: "bg-[hsl(160,60%,40%)] text-white shadow-md" },
];

const DATE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Weekly" },
  { key: "month", label: "Monthly" },
];

function getDateRange(preset: string): { from: string; to: string; label: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  switch (preset) {
    case "yesterday": { const y = new Date(today); y.setDate(y.getDate() - 1); return { from: fmt(y), to: fmt(y), label: "Yesterday" }; }
    case "7d": { const s = new Date(today); s.setDate(s.getDate() - 6); return { from: fmt(s), to: fmt(today), label: "This Week" }; }
    case "month": { const s = new Date(today.getFullYear(), today.getMonth(), 1); return { from: fmt(s), to: fmt(today), label: "This Month" }; }
    default: return { from: fmt(today), to: fmt(today), label: "Today" };
  }
}

function getStoredMode(): DashboardMode {
  try {
    const v = localStorage.getItem("shopmate_dashboard_mode");
    if (v === "executive" || v === "operations" || v === "finance") return v;
  } catch {}
  return "executive";
}

function getGreeting(name: string): string {
  const h = new Date().getHours();
  let greeting = "Good morning";
  if (h >= 22 || h < 5) greeting = "Working late?";
  else if (h >= 17) greeting = "Good evening";
  else if (h >= 12) greeting = "Good afternoon";
  return `${greeting}, ${name} 👋`;
}

export default function Dashboard() {
  usePageTitle("Dashboard");
  const { user } = useAuth();

  const [mode, setMode] = useState<DashboardMode>(getStoredMode);
  const [datePreset, setDatePreset] = useState("month");
  const [refreshing, setRefreshing] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { from, to } = useMemo(() => getDateRange(datePreset), [datePreset]);

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
  const greeting = useMemo(() => getGreeting(displayName), [displayName]);

  const handleModeChange = useCallback((m: DashboardMode) => {
    setMode(m);
    try { localStorage.setItem("shopmate_dashboard_mode", m); } catch {}
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setContentKey(k => k + 1);
    setLastUpdated(new Date());
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setContentKey(k => k + 1);
      setLastUpdated(new Date());
    }, 300_000);
    return () => clearInterval(interval);
  }, []);

  const timeDiff = useMemo(() => {
    const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
    if (diff < 1) return "Just now";
    return `${diff}m ago`;
  }, [lastUpdated]);

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Greeting + Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{greeting}</h1>
          <p className="text-sm text-muted-foreground">Here's what's happening with your business</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeDiff}
          </span>

          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {DATE_PRESETS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDatePreset(d.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                  datePreset === d.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" className="h-8 gap-1.5"
            onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 w-fit">
        {MODE_CONFIG.map((c) => {
          const active = mode === c.key;
          return (
            <button
              key={c.key}
              onClick={() => handleModeChange(c.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                active
                  ? c.activeClass
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              )}
            >
              <span className="text-sm">{c.emoji}</span>
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Mode Content */}
      <div key={contentKey} className="min-h-[400px]">
        <Suspense fallback={
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[110px] rounded-xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Skeleton className="lg:col-span-2 h-[300px] rounded-xl" />
              <Skeleton className="h-[300px] rounded-xl" />
            </div>
          </div>
        }>
          {mode === "executive" && <ExecutiveMode from={from} to={to} />}
          {mode === "operations" && <OperationsMode from={from} to={to} />}
          {mode === "finance" && <FinanceMode from={from} to={to} />}
        </Suspense>
      </div>
    </div>
  );
}
