import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBDT, formatDate } from "@/lib/format";
import { ArrowRightLeft, ExternalLink, ChevronRight } from "lucide-react";
import { EXCHANGE_STATUS_CONFIG, type ExchangeRequest } from "@/hooks/use-exchanges";
import { cn } from "@/lib/utils";

interface Props {
  exchanges: ExchangeRequest[];
  orderId: string;
}

export function ExchangeSummaryCard({ exchanges, orderId }: Props) {
  const navigate = useNavigate();

  if (!exchanges || exchanges.length === 0) return null;

  const totalAdjustment = exchanges.reduce((s, e) => s + (e.price_difference || 0), 0);
  const totalCourierLoss = exchanges.reduce((s, e) => s + (e.courier_cost_total || 0), 0);
  const totalDamageLoss = exchanges.reduce((s, e) => s + (e.damaged_loss || 0), 0);

  return (
    <Card className="border-purple-200/50">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-purple-600" />
          Exchange History
          <Badge variant="outline" className="text-[10px] ml-auto border-purple-300 bg-purple-50 text-purple-700">
            {exchanges.length} exchange{exchanges.length > 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Price Adj.</p>
            <p className={cn("text-xs font-bold", totalAdjustment > 0 ? "text-amber-600" : totalAdjustment < 0 ? "text-emerald-600" : "")}>
              {totalAdjustment > 0 ? "+" : ""}{formatBDT(totalAdjustment)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Courier Loss</p>
            <p className="text-xs font-bold text-destructive">{formatBDT(totalCourierLoss)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Damage Loss</p>
            <p className="text-xs font-bold text-destructive">{formatBDT(totalDamageLoss)}</p>
          </div>
        </div>

        {/* Exchange list */}
        <div className="space-y-1.5">
          {exchanges.map((ex) => {
            const cfg = EXCHANGE_STATUS_CONFIG[ex.status] || EXCHANGE_STATUS_CONFIG.pending;
            return (
              <div
                key={ex.id}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => navigate("/exchanges")}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold">{ex.exchange_number}</span>
                    <Badge className={cn("text-[9px] px-1.5 py-0", cfg.color)}>{cfg.emoji} {cfg.label}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {ex.reason} · {formatDate(ex.created_at)}
                    {ex.price_difference !== 0 && (
                      <span className={cn("ml-1 font-medium", ex.price_difference > 0 ? "text-amber-600" : "text-emerald-600")}>
                        ({ex.price_difference > 0 ? "+" : ""}{formatBDT(ex.price_difference)})
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            );
          })}
        </div>

        <Button variant="outline" size="sm" className="w-full text-xs h-8 rounded-xl gap-1.5"
          onClick={() => navigate("/exchanges")}>
          <ExternalLink className="w-3 h-3" /> View All Exchanges
        </Button>
      </CardContent>
    </Card>
  );
}
