import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, CheckCircle2, RotateCcw } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CourierHistoryCardProps {
  phone: string;
  orderId: string;
}

export function CourierHistoryCard({ phone, orderId }: CourierHistoryCardProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["courier-history", phone, orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courier_history")
        .select("*")
        .or(`phone.eq.${phone},order_id.eq.${orderId}`)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!phone || !!orderId,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="w-4 h-4 text-[#6c63ff]" /> Courier History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !history || history.length === 0 ? (
          <div className="text-center py-6">
            <Truck className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No courier history yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center",
                    h.status === "delivered" ? "bg-emerald-100" : "bg-red-100"
                  )}>
                    {h.status === "delivered" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <RotateCcw className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">{h.courier_name}</p>
                    {h.tracking_id && (
                      <p className="text-xs text-muted-foreground font-mono">{h.tracking_id}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={cn(
                    "text-[10px]",
                    h.status === "delivered" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  )}>
                    {h.status === "delivered" ? "✓ Delivered" : "↩ Returned"}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(h.delivered_at || h.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
