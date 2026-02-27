import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Phone, Copy, Clock, Package, FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { type MockOrder, STATUS_CONFIG } from "./order-list-data";

interface Props {
  order: MockOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = "summary" | "items" | "timeline" | "notes";

export function OrderDetailSheet({ order, open, onOpenChange }: Props) {
  const [tab, setTab] = useState<Tab>("summary");

  if (!order) return null;

  const statusCfg = STATUS_CONFIG[order.status];
  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "summary", label: "Summary", icon: FileText },
    { key: "items", label: "Items", icon: Package },
    { key: "timeline", label: "Timeline", icon: Clock },
    { key: "notes", label: "Notes", icon: MessageSquare },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] p-0 overflow-y-auto">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-bold">{order.invoiceId}</SheetTitle>
            <span className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold",
              statusCfg.color
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dotColor)} />
              {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{order.date} at {order.time}</p>
        </SheetHeader>

        {/* Tab strip */}
        <div className="flex gap-0.5 px-6 pt-3 border-b border-border">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative",
                  tab === t.key ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                {tab === t.key && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-6 space-y-5">
          {/* SUMMARY */}
          {tab === "summary" && (
            <>
              {/* Customer */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{order.customerName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{order.customerPhone}</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1">
                    <Phone className="w-3 h-3" /> Call
                  </Button>
                </div>
                <Separator />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Delivery Address</p>
                    <p className="text-xs text-foreground">{order.address}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Totals */}
              <div className="rounded-xl border border-border p-4 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Totals Breakdown</p>
                {[
                  { label: "Subtotal", value: order.subtotal },
                  { label: "Shipping charged", value: order.shipping },
                  ...(order.discount > 0 ? [{ label: "Discount", value: -order.discount }] : []),
                ].map((row, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={cn("tabular-nums font-medium", row.value < 0 ? "text-destructive" : "text-foreground")}>
                      {row.value < 0 ? "-" : ""}৳{Math.abs(row.value).toLocaleString()}
                    </span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Internal courier charge</span>
                  <span className="tabular-nums text-muted-foreground">৳{order.courierCharge.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">COD fee</span>
                  <span className="tabular-nums text-muted-foreground">৳{order.codFee.toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-foreground">Expected Net Receivable</span>
                  <span className="text-primary tabular-nums">৳{order.netReceivable.toLocaleString()}</span>
                </div>
              </div>
            </>
          )}

          {/* ITEMS */}
          {tab === "items" && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left p-3 font-bold text-muted-foreground">Product</th>
                    <th className="text-center p-3 font-bold text-muted-foreground">Qty</th>
                    <th className="text-right p-3 font-bold text-muted-foreground">Price</th>
                    <th className="text-right p-3 font-bold text-muted-foreground">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{item.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center font-medium">{item.qty}</td>
                      <td className="p-3 text-right tabular-nums font-medium">৳{item.price.toLocaleString()}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">৳{item.cost.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TIMELINE */}
          {tab === "timeline" && (
            <div className="relative pl-6">
              <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
              {order.timeline.map((event, i) => (
                <div key={i} className="relative pb-5 last:pb-0">
                  <div className={cn(
                    "absolute left-[-18px] top-1 w-3 h-3 rounded-full border-2",
                    i === order.timeline.length - 1
                      ? "bg-primary border-primary"
                      : "bg-card border-border"
                  )} />
                  <p className="text-xs font-semibold text-foreground">{event.event}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{event.time} • {event.staff}</p>
                </div>
              ))}
            </div>
          )}

          {/* NOTES */}
          {tab === "notes" && (
            <div className="space-y-4">
              <Textarea
                placeholder="Add internal note…"
                className="min-h-[100px] text-xs"
                defaultValue={order.notes}
              />
              <div className="flex flex-wrap gap-1.5">
                {["Need Call", "VIP", "High Risk", "Unreachable", "Fragile"].map(tag => (
                  <Badge key={tag} variant="outline" className="text-[10px] cursor-pointer hover:bg-muted">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Button size="sm" className="text-xs h-8">Save Note</Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
