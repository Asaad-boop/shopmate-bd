import { useOrderExchanges, EXCHANGE_STATUS_CONFIG } from "@/hooks/use-exchanges";
import { formatBDT, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, Truck, Package } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  orderId: string;
}

export function ExchangeHistoryCard({ orderId }: Props) {
  const { data: exchanges, isLoading } = useOrderExchanges(orderId);

  if (isLoading || !exchanges || exchanges.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <ArrowRightLeft className="w-4 h-4 text-primary" /> Exchange History
        <Badge variant="outline" className="text-[10px] ml-auto">{exchanges.length}</Badge>
      </h3>
      <div className="space-y-3">
        {exchanges.map((ex) => {
          const cfg = EXCHANGE_STATUS_CONFIG[ex.status] || EXCHANGE_STATUS_CONFIG.pending;
          const returnItems = (ex.exchange_items || []).filter((i) => i.direction === "return");
          const replaceItems = (ex.exchange_items || []).filter((i) => i.direction === "replacement");
          const reverseShipment = (ex.exchange_shipments || []).find((s) => s.shipment_type === "reverse");
          const replaceShipment = (ex.exchange_shipments || []).find((s) => s.shipment_type === "replacement");

          return (
            <div key={ex.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Link to="/exchanges" className="text-xs font-mono font-semibold text-primary hover:underline">{ex.exchange_number}</Link>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", cfg.color)}>{cfg.emoji} {cfg.label}</span>
              </div>

              <div className="text-[10px] text-muted-foreground">{ex.reason}</div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-semibold text-red-600 mb-0.5">↑ Returned</p>
                  {returnItems.map((i) => (
                    <p key={i.id} className="text-[10px]">{i.product_name} ×{i.quantity} ({i.condition})</p>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-emerald-600 mb-0.5">↓ Replacement</p>
                  {replaceItems.map((i) => (
                    <p key={i.id} className="text-[10px]">{i.product_name} ×{i.quantity}</p>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                {reverseShipment?.tracking_id && (
                  <span className="flex items-center gap-0.5"><Truck className="w-3 h-3" /> Rev: {reverseShipment.tracking_id}</span>
                )}
                {replaceShipment?.tracking_id && (
                  <span className="flex items-center gap-0.5"><Package className="w-3 h-3" /> Rep: {replaceShipment.tracking_id}</span>
                )}
                <span className="ml-auto font-mono">Impact: {formatBDT(ex.net_exchange_cost)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
