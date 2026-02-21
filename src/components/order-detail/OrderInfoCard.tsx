import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Info, Calendar, Globe, Truck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface OrderInfoCardProps {
  order: any;
  successRate?: number;
}

export function OrderInfoCard({ order, successRate }: OrderInfoCardProps) {
  const sr = successRate ?? 0;
  const srColor = sr >= 80 ? "text-emerald-600" : sr >= 50 ? "text-amber-600" : "text-red-600";
  const srBg = sr >= 80 ? "bg-emerald-500" : sr >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="w-4 h-4 text-[#6c63ff]" /> Order Info
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Globe className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wide">Source</span>
            </div>
            <Badge variant="outline" className="text-xs capitalize">{order.channel || "Manual"}</Badge>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Truck className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wide">Courier</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {order.pathao_consignment_id ? "Pathao" : "—"}
            </Badge>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-wide">Created</span>
            </div>
            <span className="text-xs font-medium">{formatDate(order.created_at)}</span>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Success Rate</span>
              <span className={cn("text-xs font-bold", srColor)}>{sr}%</span>
            </div>
            <Progress value={sr} className="h-1.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
