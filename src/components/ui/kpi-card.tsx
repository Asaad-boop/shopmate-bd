import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  className?: string;
  loading?: boolean;
}

export function KpiCard({ title, value, subtitle, icon, trend, className, loading }: KpiCardProps) {
  if (loading) {
    return (
      <div className={cn("bg-card rounded-lg border border-border p-4", className)}>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-lg border border-border p-4", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-xl font-semibold mt-1 tabular-nums">{value}</p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          )}
          {trend && (
            <p className={cn("text-[11px] font-medium mt-0.5", trend.positive ? "text-success" : "text-destructive")}>
              {trend.positive ? "↑" : "↓"} {trend.value}
            </p>
          )}
        </div>
        <div className="p-2 rounded-md bg-primary/8 text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}
