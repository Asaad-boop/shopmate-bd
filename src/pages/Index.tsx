import { useState, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileDown, BarChart3, Truck, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ExecutiveMode = lazy(() => import("@/components/dashboard/ExecutiveMode").then(m => ({ default: m.ExecutiveMode })));
const OperationsMode = lazy(() => import("@/components/dashboard/OperationsMode").then(m => ({ default: m.OperationsMode })));
const FinanceMode = lazy(() => import("@/components/dashboard/FinanceMode").then(m => ({ default: m.FinanceMode })));

type DashboardMode = "executive" | "operations" | "finance";

const MODE_CONFIG: { key: DashboardMode; label: string; icon: React.ElementType }[] = [
  { key: "executive", label: "Executive", icon: BarChart3 },
  { key: "operations", label: "Operations", icon: Truck },
  { key: "finance", label: "Finance", icon: Wallet },
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
  const { from, to } = useMemo(() => getDateRange(datePreset), [datePreset]);

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

  return (
    <div className="space-y-0 animate-stagger-in">
      {/* ─── Warm Hero Section ─── */}
      <div className="relative -mx-4 -mt-4 px-5 pt-5 pb-5 mb-5"
        style={{
          background: "linear-gradient(135deg, hsl(28 80% 93%) 0%, hsl(30 60% 96%) 40%, hsl(24 70% 91%) 100%)",
          borderRadius: "0 0 24px 24px",
        }}
      >
        {/* Decorative orbs */}
        <div className="absolute inset-0 overflow-hidden rounded-b-3xl pointer-events-none">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-30"
            style={{ background: "radial-gradient(circle, hsl(24 85% 70% / 0.4), transparent 70%)" }} />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, hsl(24 85% 65% / 0.3), transparent 70%)" }} />
        </div>

        <div className="relative flex flex-col gap-4">
          {/* Top Row: Date Filter Tabs + Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Date Tabs - pill style */}
            <div className="flex items-center gap-1 bg-card/70 backdrop-blur-sm rounded-2xl p-1 shadow-sm border border-border/30">
              {DATE_PRESETS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setDatePreset(d.key)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    datePreset === d.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm"
                className="h-9 gap-1.5 bg-card/80 backdrop-blur-sm border-border/40 shadow-sm rounded-xl"
                onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw ref={refreshIconRef} className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh"}</span>
              </Button>
              <Button variant="outline" size="sm"
                className="h-9 gap-1.5 bg-card/80 backdrop-blur-sm border-border/40 shadow-sm rounded-xl">
                <FileDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </div>
          </div>

          {/* Mode Toggle - bottom of hero */}
          <div className="flex items-center gap-1 bg-card/60 backdrop-blur-sm rounded-2xl p-1 w-fit shadow-sm border border-border/30">
            {MODE_CONFIG.map((c) => {
              const active = mode === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => handleModeChange(c.key)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold",
                    "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    active
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/80"
                  )}
                >
                  <c.icon className="w-4 h-4" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Mode Content ─── */}
      <div key={contentKey} className="animate-crossfade-in min-h-[400px] px-1">
        <Suspense fallback={
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-[100px] rounded-2xl" />)}
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
