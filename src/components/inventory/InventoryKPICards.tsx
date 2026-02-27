import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatBDT, formatNumber } from "@/lib/format";
import { Package, DollarSign, AlertTriangle, MinusCircle, ShieldCheck, Truck } from "lucide-react";

interface KPIs {
  totalSKUs: number;
  totalValue: number;
  lowStock: number;
  reservedQty: number;
  netAvailable: number;
  damagedQty: number;
}

interface Props {
  kpis: KPIs;
  loading: boolean;
}

const cards: { key: keyof KPIs; title: string; icon: any; format: (v: number) => string; color: string; bg: string; alertKey?: boolean }[] = [
  { key: "totalSKUs", title: "Total SKUs", icon: Package, format: (v: number) => formatNumber(v), color: "text-primary", bg: "bg-primary/8" },
  { key: "totalValue", title: "Stock Value", icon: DollarSign, format: (v: number) => formatBDT(v), color: "text-info", bg: "bg-info/8" },
  { key: "lowStock", title: "Low Stock", icon: AlertTriangle, format: (v: number) => formatNumber(v), color: "text-warning", bg: "bg-warning/8", alertKey: true },
  { key: "reservedQty", title: "Reserved", icon: Truck, format: (v: number) => formatNumber(v), color: "text-info", bg: "bg-info/8" },
  { key: "netAvailable", title: "Net Available", icon: ShieldCheck, format: (v: number) => formatNumber(v), color: "text-success", bg: "bg-success/8" },
  { key: "damagedQty", title: "Damaged", icon: MinusCircle, format: (v: number) => formatNumber(v), color: "text-destructive", bg: "bg-destructive/8", alertKey: true },
];

export default function InventoryKPICards({ kpis, loading }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, i) => {
        const val = kpis[card.key as keyof KPIs];
        const isAlert = card.alertKey && val > 0;

        return (
          <Card
            key={card.key}
            className={cn(
              "group cursor-default border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
              isAlert && card.key === "lowStock" && "border-warning/30",
              isAlert && card.key === "damagedQty" && "border-destructive/30"
            )}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <CardContent className="p-4">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-7 w-24" />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                      {card.title}
                    </p>
                    <p className="text-xl font-bold mt-1.5 tabular-nums truncate">
                      {card.format(val)}
                    </p>
                  </div>
                  <div className={cn("p-2 rounded-lg shrink-0", card.bg, card.color)}>
                    <card.icon className="w-4 h-4" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
