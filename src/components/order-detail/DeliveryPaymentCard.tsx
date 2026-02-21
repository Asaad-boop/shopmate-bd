import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, MapPin, FileText } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DeliveryPaymentCardProps {
  order: any;
  items: any[];
  deliveryForm: {
    city: string;
    zone: string;
    area: string;
    fullName: string;
    phone: string;
    address: string;
    note: string;
    advanceEnabled: boolean;
    advanceVia: string;
    advanceAmount: number;
    advanceTxnId: string;
  };
  onFormChange: (form: any) => void;
}

const PAYMENT_METHODS = ["bKash", "Nagad", "Bank", "Cash"] as const;

export function DeliveryPaymentCard({ order, items, deliveryForm, onFormChange }: DeliveryPaymentCardProps) {
  const update = (key: string, value: any) => onFormChange({ ...deliveryForm, [key]: value });

  const subtotal = items.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
  const totalDiscount = items.reduce((s, i) => s + (i.discount || 0), 0) + (order.discount || 0);
  const deliveryCharge = order.delivery_charge || 0;
  const advancePaid = deliveryForm.advanceEnabled ? deliveryForm.advanceAmount : 0;
  const grandTotal = subtotal - totalDiscount + deliveryCharge;
  const codAmount = grandTotal - advancePaid;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#6c63ff]" /> Delivery & Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Source + Courier chips */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs capitalize">{order.channel || "Manual"}</Badge>
          <Badge variant="outline" className="text-xs">Pathao</Badge>
          <Badge variant="outline" className="text-xs capitalize">{order.payment_method || "COD"}</Badge>
        </div>

        {/* Location */}
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
            <MapPin className="w-3 h-3" /> Location
          </Label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px]">City</Label>
              <Input value={deliveryForm.city} onChange={(e) => update("city", e.target.value)} className="h-9 text-sm" placeholder="City" />
            </div>
            <div>
              <Label className="text-[10px]">Zone</Label>
              <Input value={deliveryForm.zone} onChange={(e) => update("zone", e.target.value)} className="h-9 text-sm" placeholder="Zone" />
            </div>
            <div>
              <Label className="text-[10px]">Area</Label>
              <Input value={deliveryForm.area} onChange={(e) => update("area", e.target.value)} className="h-9 text-sm" placeholder="Area" />
            </div>
          </div>
        </div>

        {/* Customer fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px]">Full Name</Label>
            <Input value={deliveryForm.fullName} onChange={(e) => update("fullName", e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-[10px]">Phone</Label>
            <Input value={deliveryForm.phone} onChange={(e) => update("phone", e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        <div>
          <Label className="text-[10px]">Address</Label>
          <Input value={deliveryForm.address} onChange={(e) => update("address", e.target.value)} className="h-9 text-sm" placeholder="Full address" />
        </div>

        {/* Advance Payment Toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Advance Payment (optional)</Label>
            <Switch
              checked={deliveryForm.advanceEnabled}
              onCheckedChange={(c) => update("advanceEnabled", c)}
            />
          </div>

          {deliveryForm.advanceEnabled && (
            <div className="space-y-3 animate-fade-in bg-muted/50 rounded-xl p-4 border border-border/50">
              <div className="flex gap-2 flex-wrap">
                <Label className="text-xs text-muted-foreground w-full mb-1">Payment Via</Label>
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => update("advanceVia", m)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      deliveryForm.advanceVia === m
                        ? "bg-[#6c63ff] text-white border-[#6c63ff]"
                        : "bg-background text-foreground border-border hover:border-[#6c63ff]/30"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px]">Amount (৳)</Label>
                  <Input
                    type="number"
                    value={deliveryForm.advanceAmount}
                    onChange={(e) => update("advanceAmount", Number(e.target.value) || 0)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Transaction ID</Label>
                  <Input
                    value={deliveryForm.advanceTxnId}
                    onChange={(e) => update("advanceTxnId", e.target.value)}
                    className="h-9 text-sm"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Note */}
        <div>
          <Label className="text-xs flex items-center gap-1"><FileText className="w-3 h-3" /> Note</Label>
          <Textarea
            value={deliveryForm.note}
            onChange={(e) => update("note", e.target.value)}
            placeholder="Add order note..."
            className="mt-1 min-h-[60px] text-sm resize-none"
          />
        </div>

        {/* Order Summary */}
        <div className="rounded-xl bg-gradient-to-br from-[#6c63ff]/10 via-[#6c63ff]/5 to-transparent p-4 space-y-2.5 border border-[#6c63ff]/10">
          <p className="text-xs font-semibold text-[#6c63ff] uppercase tracking-wide">Order Summary</p>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatBDT(subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span className="text-red-500">-{formatBDT(totalDiscount)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery Charge</span><span>{formatBDT(deliveryCharge)}</span></div>
          {advancePaid > 0 && (
            <div className="flex justify-between text-sm"><span className="text-emerald-600">Advance Paid</span><span className="text-emerald-600">-{formatBDT(advancePaid)}</span></div>
          )}
          <div className="border-t border-[#6c63ff]/10 pt-2 flex justify-between">
            <span className="text-sm font-bold">Grand Total</span>
            <span className="text-xl font-bold text-[#6c63ff]">{formatBDT(grandTotal)}</span>
          </div>
          {codAmount > 0 && codAmount < grandTotal && (
            <div className="flex justify-between text-sm">
              <span className="text-amber-600 font-medium">COD Remaining</span>
              <span className="text-amber-600 font-bold">{formatBDT(codAmount)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
