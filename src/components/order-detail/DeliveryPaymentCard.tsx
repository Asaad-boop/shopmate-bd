import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MapPin, CreditCard } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderItem } from "./OrderItemsCard";

export interface DeliveryPaymentData {
  channel: string;
  delivery_address: string;
  delivery_district: string;
  delivery_thana: string;
  customer_name: string;
  customer_phone: string;
  notes: string;
  delivery_charge: number;
  discount: number;
  advance_enabled: boolean;
  advance_via: string;
  advance_amount: number;
  advance_txn_id: string;
}

interface DeliveryPaymentCardProps {
  data: DeliveryPaymentData;
  onChange: (data: DeliveryPaymentData) => void;
  items: OrderItem[];
}

const PAYMENT_METHODS = ["bKash", "Nagad", "Bank", "Cash"];

export function DeliveryPaymentCard({ data, onChange, items }: DeliveryPaymentCardProps) {
  const update = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const subtotal = items.reduce((s, i) => s + i.total_price, 0);
  const totalDiscount = data.discount + items.reduce((s, i) => s + i.discount, 0);
  const grandTotal = subtotal - data.discount + data.delivery_charge;
  const codAmount = grandTotal - (data.advance_enabled ? data.advance_amount : 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          Delivery & Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Source & Courier badges */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="bg-muted/50">
            Source: {data.channel || "Manual"}
          </Badge>
        </div>

        {/* Location */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">District</Label>
            <Input
              value={data.delivery_district}
              onChange={(e) => update("delivery_district", e.target.value)}
              className="h-9 text-sm mt-1"
              placeholder="District"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Thana</Label>
            <Input
              value={data.delivery_thana}
              onChange={(e) => update("delivery_thana", e.target.value)}
              className="h-9 text-sm mt-1"
              placeholder="Thana"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Delivery Charge</Label>
            <Input
              type="number"
              value={data.delivery_charge}
              onChange={(e) => update("delivery_charge", Number(e.target.value) || 0)}
              className="h-9 text-sm mt-1"
              placeholder="60"
            />
          </div>
        </div>

        {/* Customer fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Full Name</Label>
            <Input
              value={data.customer_name}
              onChange={(e) => update("customer_name", e.target.value)}
              className="h-9 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Phone</Label>
            <Input
              value={data.customer_phone}
              onChange={(e) => update("customer_phone", e.target.value)}
              className="h-9 text-sm mt-1"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Address</Label>
          <Input
            value={data.delivery_address}
            onChange={(e) => update("delivery_address", e.target.value)}
            className="h-9 text-sm mt-1"
            placeholder="Full delivery address"
          />
        </div>

        {/* Advance Payment */}
        <div className="border border-border rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={data.advance_enabled}
              onCheckedChange={(v) => update("advance_enabled", !!v)}
              id="advance-check"
            />
            <label htmlFor="advance-check" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
              Advance Payment (optional)
            </label>
          </div>

          {data.advance_enabled && (
            <div className="space-y-3 pl-6">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Payment Via</Label>
                <div className="flex gap-1.5">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      onClick={() => update("advance_via", m)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        data.advance_via === m
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Amount</Label>
                  <Input
                    type="number"
                    value={data.advance_amount || ""}
                    onChange={(e) => update("advance_amount", Number(e.target.value) || 0)}
                    className="h-9 text-sm mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Transaction ID</Label>
                  <Input
                    value={data.advance_txn_id}
                    onChange={(e) => update("advance_txn_id", e.target.value)}
                    className="h-9 text-sm mt-1"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Note */}
        <div>
          <Label className="text-xs text-muted-foreground">Note</Label>
          <Textarea
            value={data.notes}
            onChange={(e) => update("notes", e.target.value)}
            className="mt-1 text-sm min-h-[60px]"
            placeholder="Add order note..."
          />
        </div>

        {/* Order Summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatBDT(subtotal)}</span>
          </div>
          {data.discount > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Discount</span>
              <span>-{formatBDT(data.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery Charge</span>
            <span>{formatBDT(data.delivery_charge)}</span>
          </div>
          {data.advance_enabled && data.advance_amount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Advance Paid</span>
              <span>-{formatBDT(data.advance_amount)}</span>
            </div>
          )}
          <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
            <span>Grand Total</span>
            <span>{formatBDT(grandTotal)}</span>
          </div>
          {data.advance_enabled && data.advance_amount > 0 && (
            <div className="flex justify-between text-orange-600 font-semibold">
              <span>COD Remaining</span>
              <span>{formatBDT(codAmount)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
