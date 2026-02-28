import { useState, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, FileDown, BarChart3, Truck, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ExecutiveMode = lazy(() => import("@/components/dashboard/ExecutiveMode").then(m => ({ default: m.ExecutiveMode })));
const OperationsMode = lazy(() => import("@/components/dashboard/OperationsMode").then(m => ({ default: m.OperationsMode })));
const FinanceMode = lazy(() => import("@/components/dashboard/FinanceMode").then(m => ({ default: m.FinanceMode })));

type DashboardMode = "executive" | "operations" | "finance";

const MODE_CONFIG: { key: DashboardMode; label: string; icon: React.ElementType; subtitle: string }[] = [
  { key: "executive", label: "Executive", icon: BarChart3, subtitle: "CEO Overview" },
  { key: "operations", label: "Operations", icon: Truck, subtitle: "Ops Manager View" },
  { key: "finance", label: "Finance", icon: Wallet, subtitle: "CFO View" },
];

function getDateRange(preset: string): { from: string; to: string; label: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  switch (preset) {
    case "yesterday": { const y = new Date(today); y.setDate(y.getDate() - 1); return { from: fmt(y), to: fmt(y), label: "Yesterday" }; }
    case "7d": { const s = new Date(today); s.setDate(s.getDate() - 6); return { from: fmt(s), to: fmt(today), label: "Last 7 Days" }; }
    case "month": { const s = new Date(today.getFullYear(), today.getMonth(), 1); return { from: fmt(s), to: fmt(today), label: "This Month" }; }
    case "30d": { const s = new Date(today); s.setDate(s.getDate() - 29); return { from: fmt(s), to: fmt(today), label: "Last 30 Days" }; }
    default: return { from: fmt(today), to: fmt(today), label: "Today" };
  }
}

function getStoredMode(): DashboardMode {
  try {
    const v = localStorage.getItem("dashboard_mode");
    if (v === "executive" || v === "operations" || v === "finance") return v;
  } catch {}
  return "executive";
}

export default function Dashboard() {
  const [mode, setMode] = useState<DashboardMode>(getStoredMode);
  const [datePreset, setDatePreset] = useState("today");
  const [refreshing, setRefreshing] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const refreshIconRef = useRef<SVGSVGElement>(null);
  const { from, to, label: periodLabel } = useMemo(() => getDateRange(datePreset), [datePreset]);

  const handleModeChange = useCallback((m: DashboardMode) => {
    setMode(m);
    setContentKey(k => k + 1);
    try { localStorage.setItem("dashboard_mode", m); } catch {}
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refreshIconRef.current?.classList.add("animate-spin-once");
    setContentKey(k => k + 1);
    setTimeout(() => {
      setRefreshing(false);
      refreshIconRef.current?.classList.remove("animate-spin-once");
    }, 800);
  }, []);

  const currentConfig = MODE_CONFIG.find(c => c.key === mode)!;

  return (
    <div className="space-y-0 animate-stagger-in">
      {/* ─── Premium Hero Section ─── */}
      <div className="relative -mx-4 -mt-4 px-6 pt-6 pb-5 mb-6 rounded-b-3xl bg-gradient-to-br from-secondary via-background to-accent/30">
        {/* Subtle decorative element */}
        <div className="absolute inset-0 overflow-hidden rounded-b-3xl pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/[0.04] blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-info/[0.03] blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-4">
          {/* Top Row: Title + Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {periodLabel} <span className="text-muted-foreground font-normal">•</span>{" "}
                <span className="text-muted-foreground font-medium text-lg">{currentConfig.subtitle}</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Select value={datePreset} onValueChange={setDatePreset}>
                <SelectTrigger className="w-[140px] h-9 text-sm bg-card/80 backdrop-blur-sm border-border/60 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-card/80 backdrop-blur-sm border-border/60 shadow-sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw ref={refreshIconRef} className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh"}</span>
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-card/80 backdrop-blur-sm border-border/60 shadow-sm">
                <FileDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-card/70 backdrop-blur-sm rounded-xl p-1 w-fit shadow-sm border border-border/40">
            {MODE_CONFIG.map((c) => {
              const active = mode === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => handleModeChange(c.key)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                    "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <c.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Mode Content ─── */}
      <div key={contentKey} className="animate-crossfade-in min-h-[400px]">
        <Suspense fallback={
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-[120px] rounded-2xl" />)}
            </div>
            <Skeleton className="h-[300px] rounded-2xl" />
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
