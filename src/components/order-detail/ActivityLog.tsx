import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityLogProps {
  orderId: string;
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export function ActivityLog({ orderId }: ActivityLogProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["order-activity-log", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_activity_log")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#6c63ff]" /> Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="text-center py-6">
            <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
          </div>
        ) : (
          <div className="space-y-0">
            {logs.map((log, i) => {
              const isFirst = i === 0;
              const isLast = i === logs.length - 1;
              const dotColor = isFirst ? "bg-[#6c63ff]" : log.action === "order_created" ? "bg-amber-500" : "bg-muted-foreground/30";
              return (
                <div key={log.id} className="flex gap-3 relative">
                  {/* Timeline line + dot */}
                  <div className="flex flex-col items-center">
                    <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ring-2 ring-background", dotColor)} />
                    {!isLast && <div className="w-px flex-1 bg-border/50 mt-1" />}
                  </div>
                  {/* Content */}
                  <div className="pb-4 flex-1 min-w-0">
                    <p className="text-xs font-medium leading-relaxed">{log.action}</p>
                    {log.details && <p className="text-[10px] text-muted-foreground mt-0.5">{log.details}</p>}
                    {log.old_status && log.new_status && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {log.old_status} → {log.new_status}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {log.done_by && <span className="text-[10px] text-[#6c63ff]">{log.done_by}</span>}
                      <span className="text-[10px] text-muted-foreground">{timeAgo(log.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
