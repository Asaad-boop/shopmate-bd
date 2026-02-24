import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBDT, formatBDT2, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLegacyCourierSync } from "@/hooks/use-legacy-courier-sync";
import { calculateNetPayable } from "@/lib/courier-calc";
import {
  Package, User, MapPin, Truck, Receipt, ShieldAlert,
  RefreshCw, FileText, Clock, CheckCircle, XCircle, Loader2,
  AlertTriangle, Info
} from "lucide-react";

interface LegacyOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

const COURIER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  UNKNOWN: { label: "Unknown", color: "bg-muted text-muted-foreground" },
  IN_TRANSIT: { label: "In Transit", color: "bg-blue-100 text-blue-800" },
  DELIVERED: { label: "Delivered", color: "bg-emerald-100 text-emerald-800" },
  PARTIAL_DELIVERED: { label: "Partial", color: "bg-amber-100 text-amber-800" },
  RETURNED: { label: "Returned", color: "bg-red-100 text-red-800" },
};

const ERP_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  delivered: { label: "Delivered", color: "bg-emerald-100 text-emerald-800" },
  returned: { label: "Returned", color: "bg-red-100 text-red-800" },
  partially_delivered: { label: "Partial", color: "bg-amber-100 text-amber-800" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
  shipped: { label: "Shipped", color: "bg-blue-100 text-blue-800" },
  in_transit: { label: "In Transit", color: "bg-indigo-100 text-indigo-800" },
};

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium text-right max-w-[60%] truncate", mono && "font-mono text-xs")}>{value || "—"}</span>
    </div>
  );
}

export function LegacyOrderDrawer({ open, onOpenChange, orderId }: LegacyOrderDrawerProps) {
  const { syncSingleOrder, syncing } = useLegacyCourierSync();

  const { data: order, isLoading } = useQuery({
    queryKey: ["legacy-order-detail", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(full_name, phone, phone2, address, district, thana), order_items(id, product_id, quantity, unit_price, total_price, product_name_fallback, products(name, sku, image_url))")
        .eq("id", orderId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId && open,
  });

  const o = order as any;
  const customer = o?.customers;
  const items = (o?.order_items || []) as any[];
  const courierStatus = o?.courier_final_status || "UNKNOWN";
  const courierCfg = COURIER_STATUS_CONFIG[courierStatus] || COURIER_STATUS_CONFIG.UNKNOWN;
  const erpStatus = o?.status || "pending";
  const erpCfg = ERP_STATUS_CONFIG[erpStatus] || { label: erpStatus, color: "bg-muted text-muted-foreground" };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-base">#{o?.order_number || o?.legacy_order_id}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 bg-amber-50 text-amber-700">LEGACY</Badge>
          </SheetTitle>
          {/* Triple status row */}
          <div className="flex gap-2 flex-wrap mt-1">
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground mb-0.5">Legacy</p>
              <Badge variant="outline" className="text-[10px]">{o?.legacy_status || "—"}</Badge>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground mb-0.5">ERP</p>
              <Badge className={cn("text-[10px]", erpCfg.color)}>{erpCfg.label}</Badge>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground mb-0.5">Courier Final</p>
              <Badge className={cn("text-[10px]", courierCfg.color)}>{courierCfg.label}</Badge>
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !o ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Order not found</div>
        ) : (
          <div className="space-y-5 pb-6">
            {/* Legacy Snapshot */}
            <div className="bg-amber-50/60 rounded-xl border border-amber-200/60 p-4">
              <SectionTitle icon={FileText} title="Legacy Snapshot" />
              <InfoRow label="Legacy Invoice" value={o.legacy_order_id || o.legacy_invoice_no} mono />
              <InfoRow label="Legacy Status" value={o.legacy_status} />
              <InfoRow label="Order Date" value={formatDate(o.order_date)} />
              <InfoRow label="Delivered Date" value={formatDate(o.legacy_delivered_date)} />
              <InfoRow label="Returned Date" value={formatDate(o.legacy_returned_date)} />
              <InfoRow label="Import Batch" value={o.legacy_import_batch_id?.slice(0, 8)} mono />
            </div>

            <Separator />

            {/* Customer */}
            <div>
              <SectionTitle icon={User} title="Customer & Address" />
              <InfoRow label="Name" value={customer?.full_name} />
              <InfoRow label="Phone" value={customer?.phone} mono />
              {customer?.phone2 && <InfoRow label="Phone 2" value={customer.phone2} mono />}
              <InfoRow label="Address" value={o.delivery_address || customer?.address} />
              <InfoRow label="District" value={o.delivery_district || customer?.district} />
              <InfoRow label="Thana" value={o.delivery_thana || customer?.thana} />
            </div>

            <Separator />

            {/* Items */}
            <div>
              <SectionTitle icon={Package} title="Order Items" />
              <div className="space-y-2">
                {items.map((item: any, idx: number) => {
                  const prod = item.products;
                  return (
                    <div key={item.id || idx} className="flex items-center gap-3 bg-muted/30 rounded-lg p-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{prod?.name || item.product_name_fallback || "Unknown"}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{prod?.sku || "No SKU"} × {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold">{formatBDT(item.total_price || item.quantity * item.unit_price)}</p>
                    </div>
                  );
                })}
                {items.length === 0 && <p className="text-xs text-muted-foreground">No items found</p>}
              </div>
            </div>

            <Separator />

            {/* Courier Panel */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Courier</h3>
                </div>
                {o.legacy_tracking_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    disabled={syncing}
                    onClick={() => syncSingleOrder(o.id, o.legacy_tracking_id)}
                  >
                    {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Sync Pathao
                  </Button>
                )}
              </div>
              <InfoRow label="Courier Name" value={o.legacy_courier_name} />
              <InfoRow label="Tracking ID" value={o.legacy_tracking_id} mono />
              <InfoRow label="Courier Final Status" value={
                <Badge className={cn("text-[10px]", courierCfg.color)}>{courierCfg.label}</Badge>
              } />
            </div>

            <Separator />

            {/* Charges (read-only auto-fill) */}
            {(() => {
              const calcResult = calculateNetPayable({
                collectable_amount: o.total_amount,
                courier_delivery_fee: o.courier_delivery_fee,
                courier_cod_fee: o.courier_cod_fee,
                courier_discount: o.courier_discount,
                courier_promo_discount: o.courier_promo_discount,
                courier_additional_charge: o.courier_additional_charge,
                courier_compensation_cost: o.courier_compensation_cost,
                is_return: o.courier_final_status === "RETURNED",
              });
              return (
                <div className="bg-muted/30 rounded-xl border p-4">
                  <SectionTitle icon={Receipt} title="Courier Charges (Auto-filled)" />
                  {calcResult.warning && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-md p-2 mb-2 border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {calcResult.warning}
                    </div>
                  )}
                  <InfoRow label="Delivery Fee" value={formatBDT2(o.courier_delivery_fee)} />
                  <InfoRow label="COD Fee" value={formatBDT2(o.courier_cod_fee)} />
                  <InfoRow label="Discount" value={formatBDT2(o.courier_discount)} />
                  <InfoRow label="Promo Discount" value={formatBDT2(o.courier_promo_discount)} />
                  <InfoRow label="Additional Charge" value={formatBDT2(o.courier_additional_charge)} />
                  <InfoRow label="Compensation Cost" value={formatBDT2(o.courier_compensation_cost)} />
                  <InfoRow label="Total Cost" value={formatBDT2(calcResult.totalCost)} />
                  <InfoRow label="Net Payable" value={
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help text-primary font-semibold">
                            {formatBDT2(calcResult.netPayable)}
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <div className="text-xs space-y-0.5 font-mono">
                            {calcResult.breakdown.map((line, i) => (
                              <p key={i}>{line}</p>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  } />
                  <InfoRow label="Return Cost" value={formatBDT2(o.courier_return_cost)} />
                  {!o.courier_total_cost && (
                    <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Awaiting courier sync or statement import
                    </p>
                  )}
                </div>
              );
            })()}

            <Separator />

            {/* Settlement */}
            <div>
              <SectionTitle icon={Receipt} title="Settlement" />
              <InfoRow label="Settlement Batch" value={o.settlement_batch_id?.slice(0, 8) || "Not matched"} mono />
              <InfoRow label="Settlement Posted" value={
                o.settlement_posted
                  ? <span className="flex items-center gap-1 text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> Posted</span>
                  : <span className="flex items-center gap-1 text-muted-foreground"><XCircle className="w-3.5 h-3.5" /> Pending</span>
              } />
              <InfoRow label="Customer Total" value={formatBDT(o.total_amount)} />
            </div>

            {/* Financial Summary */}
            {(() => {
              const isLegacy = o.order_source === "LEGACY";
              const collectableAmount = isLegacy ? o.total_amount : o.subtotal;
              const summaryCalc = calculateNetPayable({
                collectable_amount: collectableAmount,
                courier_delivery_fee: o.courier_delivery_fee,
                courier_cod_fee: o.courier_cod_fee,
                courier_discount: o.courier_discount,
                courier_promo_discount: o.courier_promo_discount,
                courier_additional_charge: o.courier_additional_charge,
                courier_compensation_cost: o.courier_compensation_cost,
                is_return: o.courier_final_status === "RETURNED",
              });
              return (
                <div className="bg-primary/5 rounded-xl border border-primary/10 p-4">
                  {summaryCalc.warning && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-md p-2 mb-3 border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {summaryCalc.warning}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {!isLegacy && (
                      <div>
                        <p className="text-[10px] text-muted-foreground">Subtotal</p>
                        <p className="text-sm font-bold">{formatBDT(o.subtotal)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] text-muted-foreground">Shipping</p>
                      <p className="text-sm font-bold">{formatBDT(o.delivery_charge)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Customer Total</p>
                      <p className="text-sm font-bold text-primary">{formatBDT(o.total_amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Net Payable</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-sm font-bold inline-flex items-center gap-1 cursor-help">
                              {summaryCalc.warning ? (
                                <span className="text-amber-600">N/A</span>
                              ) : (
                                <span className="text-primary">{formatBDT(summaryCalc.netPayable)}</span>
                              )}
                              <Info className="w-3 h-3 text-muted-foreground" />
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="text-xs space-y-0.5 font-mono">
                              <p className="font-semibold mb-1">{isLegacy ? "Legacy: uses Customer Total" : "Uses Subtotal"}</p>
                              {summaryCalc.breakdown.map((line, i) => (
                                <p key={i}>{line}</p>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Posting modes */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="text-[9px]">Posting: {o.posting_mode || "DISABLED"}</Badge>
              <Badge variant="outline" className="text-[9px]">Inventory: {o.inventory_mode || "DISABLED"}</Badge>
              <Badge variant="outline" className="text-[9px]">Courier: {o.courier_mode || "DISABLED"}</Badge>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
