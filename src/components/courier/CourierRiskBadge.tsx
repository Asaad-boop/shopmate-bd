import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion, UserPlus } from "lucide-react";

interface CourierRiskBadgeProps {
  phone: string;
  /** Show expanded card with courier breakdown */
  expanded?: boolean;
  className?: string;
}

interface RiskResult {
  risk_level: string;
  overall_success_rate: number;
  total_orders: number;
  total_success: number;
  total_cancel: number;
  courier_data?: Record<string, any>;
  fetched_at?: string;
  from_cache?: boolean;
  error?: string;
}

const RISK_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string; bg: string; border: string }> = {
  low: { label: "Trusted", icon: ShieldCheck, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  medium: { label: "Medium Risk", icon: ShieldAlert, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  high: { label: "High Risk", icon: ShieldAlert, color: "text-destructive", bg: "bg-red-50", border: "border-red-200" },
  new_customer: { label: "New Customer", icon: UserPlus, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  unknown: { label: "Unknown", icon: ShieldQuestion, color: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
};

export function CourierRiskBadge({ phone, expanded = false, className }: CourierRiskBadgeProps) {
  const { data, isLoading } = useQuery<RiskResult | null>({
    queryKey: ["bd-courier-risk", phone],
    queryFn: async () => {
      if (!phone || phone.length < 8) return null;

      const { data, error } = await supabase.functions.invoke("bd-courier-check", {
        body: { phone },
      });

      if (error) {
        console.error("BD Courier risk check error:", error);
        return null;
      }

      return data || null;
    },
    enabled: !!phone && phone.length >= 8,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return <Skeleton className={cn("h-6 w-24 rounded-full", className)} />;
  }

  if (!data || data.error) {
    return null;
  }

  const riskLevel = data.risk_level || "unknown";
  const config = RISK_CONFIG[riskLevel] || RISK_CONFIG.unknown;
  const Icon = config.icon;
  const rate = data.overall_success_rate ?? 0;

  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
            config.bg, config.color, config.border,
            className
          )}>
            <Icon className="w-3.5 h-3.5" />
            {config.label}
            {data.total_orders > 0 && (
              <span className="opacity-70">({rate}%)</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px]">
          <div className="space-y-1.5">
            <p className="font-semibold text-sm">{config.label} — {rate}% success</p>
            <div className="text-xs space-y-0.5">
              <p>Total Orders: {data.total_orders}</p>
              <p>Delivered: {data.total_success}</p>
              <p>Cancelled/Returned: {data.total_cancel}</p>
            </div>
            {data.from_cache && (
              <p className="text-[10px] text-muted-foreground">Cached result</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Expanded card view
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3",
      config.bg, config.border,
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-5 h-5", config.color)} />
          <span className={cn("font-semibold text-sm", config.color)}>{config.label}</span>
        </div>
        <span className={cn("text-2xl font-bold", config.color)}>
          {rate}%
        </span>
      </div>

      {/* Success bar */}
      <div className="w-full h-2 rounded-full bg-background/50 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            rate >= 80 ? "bg-emerald-500" : rate >= 60 ? "bg-amber-500" : "bg-destructive"
          )}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-foreground">{data.total_orders}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
        </div>
        <div>
          <p className="text-lg font-bold text-emerald-600">{data.total_success}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Success</p>
        </div>
        <div>
          <p className="text-lg font-bold text-destructive">{data.total_cancel}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cancel</p>
        </div>
      </div>

      {/* Courier breakdown */}
      {data.courier_data && Object.keys(data.courier_data).length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">By Courier</p>
          {Object.entries(data.courier_data).map(([courier, stats]: [string, any]) => (
            <div key={courier} className="flex items-center justify-between text-xs">
              <span className="font-medium capitalize">{courier}</span>
              <span className="text-muted-foreground">
                {stats.success || stats.success_parcel || 0}/{stats.total || stats.total_parcel || 0}
              </span>
            </div>
          ))}
        </div>
      )}

      {data.from_cache && (
        <p className="text-[10px] text-muted-foreground text-right">
          Cached • {data.fetched_at ? new Date(data.fetched_at).toLocaleDateString() : ""}
        </p>
      )}
    </div>
  );
}

export default CourierRiskBadge;
