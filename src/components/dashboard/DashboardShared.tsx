import { useNavigate } from "react-router-dom";
import { formatBDT, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, ArrowRight } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";

/* ── Percentage Change Helper ── */
export function delta(cur: number, prev: number): { pct: number; positive: boolean } {
  if (prev === 0) return { pct: cur > 0 ? 100 : 0, positive: cur >= 0 };
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return { pct: Math.abs(Math.round(pct * 10) / 10), positive: pct >= 0 };
}

/* ── KPI Card (Enterprise Style) ── */
export const KpiCard = memo(function KpiCard({
  label, value, sub, icon: Icon, delta: d, onClick, loading, color, subColor,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  delta?: { pct: number; positive: boolean }; onClick?: () => void;
  loading?: boolean; color?: string; subColor?: string;
}) {
  if (loading) return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <Skeleton className="h-4 w-20 mb-3" />
      <Skeleton className="h-7 w-28 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
  return (
    <button onClick={onClick}
      className="bg-card rounded-xl p-4 text-left w-full border border-border
        hover:border-primary/30 hover:shadow-md transition-all duration-200 group relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", color || "bg-primary/10 text-primary")}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        {d && d.pct > 0 && (
          <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
            d.positive ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "bg-destructive/10 text-destructive")}>
            {d.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {d.pct}%
          </span>
        )}
      </div>
      <p className="text-xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground mt-1">{label}</p>
      {sub && <p className={cn("text-[10px] mt-0.5", subColor || "text-muted-foreground")}>{sub}</p>}
    </button>
  );
});

/* ── Hero KPI (for Ops/Finance) ── */
export const HeroKpi = memo(function HeroKpi({
  label, value, sub, icon: Icon, delta: d, onClick, loading, accent,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  delta?: { pct: number; positive: boolean }; onClick?: () => void;
  loading?: boolean; accent?: string;
}) {
  if (loading) return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <Skeleton className="h-8 w-8 rounded-lg mb-2" />
      <Skeleton className="h-6 w-20 mb-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
  return (
    <button onClick={onClick}
      className="bg-card rounded-xl p-4 text-left w-full border border-border
        hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", accent || "bg-primary/10 text-primary")}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        {d && d.pct > 0 && (
          <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
            d.positive ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "bg-destructive/10 text-destructive")}>
            {d.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {d.pct}%
          </span>
        )}
      </div>
      <p className="text-xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </button>
  );
});

/* ── Alert Item ── */
export const AlertItem = memo(function AlertItem({
  label, count, amount, severity, to, icon,
}: {
  label: string; count: number; amount?: number;
  severity: "critical" | "high" | "medium" | "info"; to: string; icon?: string;
}) {
  const nav = useNavigate();
  if (count === 0) return null;
  const borderColor = {
    critical: "border-l-destructive",
    high: "border-l-[hsl(var(--warning))]",
    medium: "border-l-muted-foreground",
    info: "border-l-[hsl(var(--info))]",
  };
  const badgeColor = {
    critical: "bg-destructive text-destructive-foreground",
    high: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]",
    medium: "bg-muted text-muted-foreground",
    info: "bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]",
  };
  return (
    <button onClick={() => nav(to)}
      className={cn("w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-l-[3px]",
        "hover:bg-accent/50 transition-colors duration-150 text-left group bg-card",
        borderColor[severity])}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="text-sm">{icon}</span>}
        <span className="text-sm truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {amount != null && amount > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{formatBDT(amount)}</span>
        )}
        <Badge className={cn("text-[10px] h-5 px-1.5 rounded-full", badgeColor[severity])}>{count}</Badge>
        <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
      </div>
    </button>
  );
});

/* ── Pipeline Stage ── */
export const PipelineStage = memo(function PipelineStage({
  label, emoji, count, amount, onClick, active,
}: {
  label: string; emoji: string; count: number; amount: number;
  onClick: () => void; active?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={cn("flex-1 min-w-[100px] rounded-xl p-3 text-center border",
        "hover:border-primary/30 hover:shadow-sm transition-all duration-200",
        active ? "bg-primary/5 border-primary/20" : "bg-card border-border")}
    >
      <span className="text-lg">{emoji}</span>
      <p className="text-xl font-bold tabular-nums mt-1">{formatNumber(count)}</p>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-[10px] text-muted-foreground tabular-nums">{formatBDT(amount)}</p>
    </button>
  );
});

/* ── Quick Action Button ── */
export const QuickActionBtn = memo(function QuickActionBtn({
  icon: Icon, label, onClick, emoji,
}: {
  icon?: React.ElementType; label: string; onClick: () => void; emoji?: string;
}) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border
        hover:border-primary/30 hover:shadow-md transition-all duration-200 min-w-[80px]"
    >
      {emoji ? (
        <span className="text-xl">{emoji}</span>
      ) : Icon ? (
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      ) : null}
      <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
    </button>
  );
});
