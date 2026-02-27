import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBDT } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

interface Props {
  subtotal: number;
  totalDiscount: number;
  deliveryCharge: number;
  advancePaid: number;
  grandTotal: number;
  onDiscountChange: (v: number) => void;
  onAdvanceChange: (v: number) => void;
  onDeliveryChargeChange: (v: number) => void;
  discount: number;
  advance: number;
  paymentMethod: string;
}

export function WebOrderTotalsStrip({
  subtotal, totalDiscount, deliveryCharge, advancePaid, grandTotal,
  onDiscountChange, onAdvanceChange, onDeliveryChargeChange,
  discount, advance, paymentMethod,
}: Props) {
  const isCOD = !paymentMethod || paymentMethod.toLowerCase() === "cod" || paymentMethod.toLowerCase() === "cash on delivery";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-3 items-end">
        {/* Discount */}
        <div>
          <Label className="text-[9px] text-muted-foreground uppercase tracking-wider">Discount</Label>
          <Input
            type="number"
            value={discount}
            onChange={(e) => onDiscountChange(Number(e.target.value) || 0)}
            className="h-8 text-xs text-right tabular-nums mt-1"
          />
        </div>

        {/* Advance */}
        <div>
          <Label className="text-[9px] text-muted-foreground uppercase tracking-wider">Advance</Label>
          <Input
            type="number"
            value={advance}
            onChange={(e) => onAdvanceChange(Number(e.target.value) || 0)}
            className="h-8 text-xs text-right tabular-nums mt-1"
          />
        </div>

        {/* Sub Total (read-only) */}
        <div>
          <Label className="text-[9px] text-muted-foreground uppercase tracking-wider">Sub Total</Label>
          <div className="h-8 mt-1 rounded-md border border-border bg-muted/50 flex items-center justify-end px-3">
            <span className="text-xs font-semibold tabular-nums">{formatBDT(subtotal - totalDiscount)}</span>
          </div>
        </div>

        {/* Delivery Charge */}
        <div>
          <Label className="text-[9px] text-muted-foreground uppercase tracking-wider">Delivery Charge</Label>
          <Input
            type="number"
            value={deliveryCharge}
            onChange={(e) => onDeliveryChargeChange(Number(e.target.value) || 0)}
            className="h-8 text-xs text-right tabular-nums mt-1"
          />
        </div>

        {/* Grand Total (read-only) */}
        <div>
          <Label className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Grand Total</Label>
          <div className="h-8 mt-1 rounded-md border-2 border-primary/30 bg-primary/5 flex items-center justify-end px-3">
            <span className="text-sm font-black text-primary tabular-nums">{formatBDT(grandTotal)}</span>
          </div>
        </div>
      </div>

      {isCOD && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
          <p className="text-[10px] text-destructive font-medium">
            The payment method is Cash on Delivery (COD). Please confirm with the customer.
          </p>
        </div>
      )}
    </div>
  );
}
