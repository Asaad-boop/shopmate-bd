import { useNavigate } from "react-router-dom";
import { formatBDT, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, ArrowRight } from "lucide-react";

export function delta(cur: number, prev: number): { pct: number; positive: boolean } {
  if (prev === 0) return { pct: cur > 0 ? 100 : 0, positive: cur >= 0 };
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return { pct: Math.abs(Math.round(pct * 10) / 10), positive: pct >= 0 };
}

export function HeroKpi({
  label, value, sub, icon: Icon, delta: d, onClick, loading, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  delta?: { pct: number; positive: boolean };
  onClick?: () => void;
  loading?: boolean;
  accent?: string;
}) {
  if (loading) return <Skeleton className="h-[120px] rounded-2xl" />;
  return (
    <button
      onClick={onClick}
      className="bg-card rounded-2xl p-5 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group border border-transparent hover:border-primary/10 w-full"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent || "bg-primary/10 text-primary"}`}>
          <Icon className="w-5 h-5" />
        </div>
        {d && d.pct > 0 && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${d.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {d.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {d.pct}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </button>
  );
}

export function AlertItem({
  label, count, amount, severity, to,
}: {
  label: string;
  count: number;
  amount?: number;
  severity: "critical" | "high" | "medium";
  to: string;
}) {
  const nav = useNavigate();
  if (count === 0) return null;
  const colors = {
    critical: "bg-destructive text-destructive-foreground",
    high: "bg-warning text-warning-foreground",
    medium: "bg-muted text-muted-foreground",
  };
  return (
    <button
      onClick={() => nav(to)}
      className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-accent/60 transition-colors text-left group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${severity === "critical" ? "bg-destructive" : severity === "high" ? "bg-warning" : "bg-muted-foreground/40"}`} />
        <span className="text-sm font-medium truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {amount != null && amount > 0 && (
          <span className="text-xs text-muted-foreground font-mono">{formatBDT(amount)}</span>
        )}
        <Badge className={`text-xs ${colors[severity]}`}>{count}</Badge>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

export function PipelineStage({
  label, emoji, count, amount, onClick, active,
}: {
  label: string;
  emoji: string;
  count: number;
  amount: number;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[120px] rounded-xl p-4 text-center transition-all duration-200 hover:shadow-md ${active ? "bg-primary/10 ring-1 ring-primary/20" : "bg-card hover:bg-accent/50"}`}
    >
      <span className="text-lg">{emoji}</span>
      <p className="text-xl font-bold font-mono mt-1">{formatNumber(count)}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground font-mono mt-0.5">{formatBDT(amount)}</p>
    </button>
  );
}

export function QuickActionBtn({
  icon: Icon, label, onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card hover:bg-accent/50 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 min-w-[88px]"
    >
      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="w-4.5 h-4.5" />
      </div>
      <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
    </button>
  );
}
