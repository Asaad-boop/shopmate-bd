import { useProductLedger } from "@/hooks/use-inventory-ledger";
import type { StockOnHand } from "@/hooks/use-inventory-ledger";
import { formatBDT, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, TrendingUp, ShoppingCart, RotateCcw, ArrowUpDown, Truck } from "lucide-react";

const TXN_ICONS: Record<string, React.ReactNode> = {
  stock_in: <Package className="w-3 h-3 text-success" />,
  purchase: <Package className="w-3 h-3 text-info" />,
  sale: <ShoppingCart className="w-3 h-3 text-primary" />,
  stock_out: <ShoppingCart className="w-3 h-3 text-warning" />,
  return: <RotateCcw className="w-3 h-3 text-info" />,
  stock_adjustment: <ArrowUpDown className="w-3 h-3 text-muted-foreground" />,
  shipment: <Truck className="w-3 h-3 text-info" />,
};

interface Props {
  productId: string;
  productName: string;
  stock: StockOnHand;
  sellingPrice?: number | null;
}

export default function InventoryRowExpander({ productId, productName, stock, sellingPrice }: Props) {
  const { data: ledger, isLoading } = useProductLedger(productId);

  const recentEntries = (ledger || []).slice(-8).reverse();
  const totalSold = (ledger || []).reduce((sum, e) => sum + (e.qty_out || 0), 0);
  const totalRevenue = totalSold * (sellingPrice || 0);
  const totalCOGS = totalSold * stock.avg_unit_cost;
  const netProfit = totalRevenue - totalCOGS;

  return (
    <div className="bg-muted/30 border-t border-border/50 px-6 py-5 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {/* Left: Timeline */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Recent Stock Movements
          </h4>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : recentEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">No ledger entries yet</p>
          ) : (
            <div className="space-y-0">
              {recentEntries.map((entry, i) => (
                <div key={entry.id} className="flex items-start gap-3 py-1.5">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shrink-0">
                      {TXN_ICONS[entry.txn_type] || <ArrowUpDown className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    {i < recentEntries.length - 1 && <div className="w-px h-4 bg-border" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium truncate">
                        {entry.txn_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </p>
                      <span className={cn(
                        "text-xs font-bold tabular-nums shrink-0",
                        entry.qty_in > 0 ? "text-success" : "text-destructive"
                      )}>
                        {entry.qty_in > 0 ? `+${entry.qty_in}` : `-${entry.qty_out}`}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(entry.created_at)}
                      {entry.note && ` — ${entry.note.slice(0, 40)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Profit snapshot */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Profit Snapshot
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Avg Cost", value: formatBDT(stock.avg_unit_cost, true), color: "" },
              { label: "Total Sold", value: String(totalSold), color: "" },
              { label: "Revenue", value: formatBDT(totalRevenue), color: "text-success" },
              { label: "Net Profit", value: formatBDT(netProfit), color: netProfit >= 0 ? "text-success" : "text-destructive" },
            ].map((item) => (
              <div key={item.label} className="bg-card rounded-lg border border-border/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                <p className={cn("text-sm font-bold mt-0.5 tabular-nums", item.color)}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
