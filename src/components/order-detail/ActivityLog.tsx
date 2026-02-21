import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityLogProps {
  orderId: string;
}

export function ActivityLog({ orderId }: ActivityLogProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["order-activity", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_activity_log" as any)
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orderId,
  });

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const getActionText = (log: any) => {
    if (log.action === "status_change") {
      return `Status changed: ${log.old_status || "none"} → ${log.new_status}`;
    }
    if (log.action === "order_created") return "Order created";
    if (log.action === "items_updated") return "Order items updated";
    if (log.action === "note_added") return `Note added: ${log.details || ""}`;
    return log.action || "Activity";
  };

  const getDotColor = (action: string) => {
    if (action === "status_change") return "bg-blue-500";
    if (action === "order_created") return "bg-emerald-500";
    if (action === "items_updated") return "bg-orange-500";
    return "bg-muted-foreground";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : !logs || logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
        ) : (
          <div className="space-y-0">
            {logs.map((log, idx) => (
              <div key={log.id} className="flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5 shrink-0", getDotColor(log.action))} />
                  {idx < logs.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{getActionText(log)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {log.done_by && (
                      <span className="text-[10px] text-muted-foreground">{log.done_by}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{formatTime(log.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
