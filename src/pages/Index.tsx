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
    setContentKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <div className="space-y-5">
      {/* ─── Header Bar ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Mode Tabs */}
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {MODE_CONFIG.map((c) => {
              const active = mode === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => handleModeChange(c.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150",
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <c.icon className="w-3.5 h-3.5" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Tabs */}
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {DATE_PRESETS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDatePreset(d.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150",
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
            <RefreshCw ref={refreshIconRef} className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <FileDown className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── Mode Content ─── */}
      <div key={contentKey} className="min-h-[400px]">
        <Suspense fallback={
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-[80px] rounded-lg" />)}
            </div>
            <Skeleton className="h-[240px] rounded-lg" />
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
