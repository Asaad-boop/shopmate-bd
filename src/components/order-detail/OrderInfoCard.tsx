import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useBDCourierSingle, getRiskLevel } from "@/hooks/use-bd-courier";
import { cn } from "@/lib/utils";

interface OrderInfoCardProps {
  order: any;
  customerPhone: string | null;
}

export function OrderInfoCard({ order, customerPhone }: OrderInfoCardProps) {
  const { data: bdData } = useBDCourierSingle(customerPhone || "", !!customerPhone);
  const risk = getRiskLevel(bdData?.success_rate);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="w-4 h-4 text-muted-foreground" />
          Order Info
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground mb-0.5">Source</p>
            <p className="font-medium capitalize">{order.channel || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Courier</p>
            <p className="font-medium">{order.pathao_tracking_code ? "Pathao" : "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Created</p>
            <p className="font-medium">{formatDate(order.created_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Success Rate</p>
            <Badge className={cn("text-[10px]", risk.bg, risk.color)}>
              {bdData?.success_rate != null ? `${bdData.success_rate}%` : risk.label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
