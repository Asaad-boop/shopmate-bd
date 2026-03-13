import { useNavigate } from "react-router-dom";
import { formatBDT, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, ArrowRight } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";

export function delta(cur: number, prev: number): { pct: number; positive: boolean } {
  if (prev === 0) return { pct: cur > 0 ? 100 : 0, positive: cur >= 0 };
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return { pct: Math.abs(Math.round(pct * 10) / 10), positive: pct >= 0 };
}

export const HeroKpi = memo(function HeroKpi({
  label, value, sub, icon: Icon, delta: d, onClick, loading, accent,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  delta?: { pct: number; positive: boolean }; onClick?: () => void;
  loading?: boolean; accent?: string;
}) {
  if (loading) return <Skeleton className="h-[76px] rounded-lg" />;
  return (
    <button onClick={onClick}
      className="bg-card rounded-lg p-3.5 text-left w-full border border-border
        hover:border-primary/30 transition-colors duration-150 group"
    >
      <div className="flex items-start justify-between mb-1">
        <div className={cn("w-8 h-8 rounded-md flex items-center justify-center", accent || "bg-primary/8 text-primary")}>
          <Icon className="w-4 h-4" />
        </div>
        {d && d.pct > 0 && (
          <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded",
            d.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
            {d.positive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
            {d.pct}%
          </span>
        )}
      </div>
      <p className="text-lg font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </button>
  );
});

export const AlertItem = memo(function AlertItem({
  label, count, amount, severity, to,
}: {
  label: string; count: number; amount?: number;
  severity: "critical" | "high" | "medium"; to: string;
}) {
  const nav = useNavigate();
  if (count === 0) return null;
  const colors = {
    critical: "bg-destructive text-destructive-foreground",
    high: "bg-warning text-warning-foreground",
    medium: "bg-muted text-muted-foreground",
  };
  return (
    <button onClick={() => nav(to)}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-md
        hover:bg-accent transition-colors duration-150 text-left group"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
          severity === "critical" ? "bg-destructive" : severity === "high" ? "bg-warning" : "bg-muted-foreground/40")} />
        <span className="text-sm truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {amount != null && amount > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{formatBDT(amount)}</span>
        )}
        <Badge className={cn("text-[10px] h-5 px-1.5", colors[severity])}>{count}</Badge>
        <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
      </div>
    </button>
  );
});

export const PipelineStage = memo(function PipelineStage({
  label, emoji, count, amount, onClick, active,
}: {
  label: string; emoji: string; count: number; amount: number;
  onClick: () => void; active?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={cn("flex-1 min-w-[100px] rounded-lg p-3 text-center border border-border",
        "hover:border-primary/30 transition-colors duration-150",
        active ? "bg-primary/5 border-primary/20" : "bg-card")}
    >
      <span className="text-base">{emoji}</span>
      <p className="text-lg font-semibold tabular-nums mt-0.5">{formatNumber(count)}</p>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-[10px] text-muted-foreground tabular-nums">{formatBDT(amount)}</p>
    </button>
  );
});

export const QuickActionBtn = memo(function QuickActionBtn({
  icon: Icon, label, onClick,
}: {
  icon: React.ElementType; label: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-card border border-border
        hover:border-primary/30 transition-colors duration-150 min-w-[72px]"
    >
      <div className="w-8 h-8 rounded-md bg-primary/8 text-primary flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
    </button>
  );
});
