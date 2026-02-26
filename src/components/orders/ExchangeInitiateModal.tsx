import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateExchange } from "@/hooks/use-exchanges";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/lib/format";
import { ArrowRightLeft, Plus, Trash2, Loader2, Package, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  orderItems: any[];
}

interface LineItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  condition: string;
}

const REASONS = [
  "Wrong size", "Wrong color", "Defective product", "Customer changed mind",
  "Wrong product sent", "Quality issue", "Damaged in transit", "Other",
];

const REFUND_METHODS = ["Cash", "Bank", "bKash", "Nagad"];

export function ExchangeInitiateModal({ open, onOpenChange, order, orderItems }: Props) {
  const createEx = useCreateExchange();
  const [reason, setReason] = useState("");
  const [exchangeType, setExchangeType] = useState("different");
  const [notes, setNotes] = useState("");
  const [refundMethod, setRefundMethod] = useState("");
  const [returnItems, setReturnItems] = useState<LineItem[]>(() =>
    (orderItems || []).map((i: any) => ({
      product_id: i.product_id,
      product_name: i.products?.name || i.product_name_fallback || "Unknown",
      sku: i.products?.sku || "",
      quantity: i.quantity,
      unit_price: i.unit_price,
      condition: "good",
    }))
  );
  const [replacementItems, setReplacementItems] = useState<LineItem[]>([]);
  const [selectedProdId, setSelectedProdId] = useState("");

  const { data: products } = useQuery({
    queryKey: ["products-for-exchange"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, sku, selling_price").eq("status", "active").order("name");
      return data || [];
    },
    enabled: open,
  });

  const addReplacement = () => {
    const prod = products?.find((p: any) => p.id === selectedProdId);
    if (!prod) return;
    if (replacementItems.find((i) => i.product_id === prod.id)) return;
    setReplacementItems([...replacementItems, {
      product_id: prod.id, product_name: prod.name, sku: prod.sku || "",
      quantity: 1, unit_price: prod.selling_price || 0, condition: "good",
    }]);
    setSelectedProdId("");
  };

  const returnTotal = useMemo(() => returnItems.reduce((s, i) => s + i.unit_price * i.quantity, 0), [returnItems]);
  const replaceTotal = useMemo(() => replacementItems.reduce((s, i) => s + i.unit_price * i.quantity, 0), [replacementItems]);
  const priceDiff = replaceTotal - returnTotal;

  const customer = order?.customers as any;

  const handleSubmit = () => {
    if (!reason) return;
    createEx.mutate({
      order_id: order.id,
      reason,
      exchange_type: exchangeType,
      customer_phone: customer?.phone,
      customer_name: customer?.full_name,
      notes: `${notes}${refundMethod && priceDiff < 0 ? `\nRefund via: ${refundMethod}` : ""}`,
      return_items: returnItems,
      replacement_items: replacementItems,
    }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="w-5 h-5 text-primary" /> Initiate Exchange
            <Badge variant="outline" className="text-[10px] font-mono ml-2">#{order?.invoice_id || order?.order_number}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Type & Reason */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Exchange Type</Label>
              <Select value={exchangeType} onValueChange={setExchangeType}>
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="same">Same Product</SelectItem>
                  <SelectItem value="different">Different Product</SelectItem>
                  <SelectItem value="partial">Partial Exchange</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue placeholder="Select reason..." /></SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Return Items */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Items Being Returned
            </Label>
            <div className="space-y-1.5">
              {returnItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-destructive/5 rounded-xl p-2.5 border border-destructive/10">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.product_name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{item.sku}</p>
                  </div>
                  <Select value={item.condition} onValueChange={(v) => setReturnItems((prev) => prev.map((it, i) => i === idx ? { ...it, condition: v } : it))}>
                    <SelectTrigger className="h-7 w-24 text-[10px] rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                      <SelectItem value="defective">Defective</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" className="h-7 w-14 text-xs text-center rounded-lg" value={item.quantity} min={1}
                    onChange={(e) => setReturnItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, parseInt(e.target.value) || 1) } : it))} />
                  <span className="text-xs font-mono w-16 text-right">{formatBDT(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-right text-muted-foreground">Return Value: <strong>{formatBDT(returnTotal)}</strong></p>
          </div>

          {/* Replacement Items */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Replacement Items
            </Label>
            <div className="space-y-1.5">
              {replacementItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-emerald-500/5 rounded-xl p-2.5 border border-emerald-500/10">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.product_name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{item.sku}</p>
                  </div>
                  <Input type="number" className="h-7 w-14 text-xs text-center rounded-lg" value={item.quantity} min={1}
                    onChange={(e) => setReplacementItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, parseInt(e.target.value) || 1) } : it))} />
                  <span className="text-xs font-mono w-16 text-right">{formatBDT(item.unit_price * item.quantity)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive rounded-lg" onClick={() => setReplacementItems((p) => p.filter((_, i) => i !== idx))}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Select value={selectedProdId} onValueChange={setSelectedProdId}>
                <SelectTrigger className="h-9 text-xs flex-1 rounded-xl"><SelectValue placeholder="Add replacement product..." /></SelectTrigger>
                <SelectContent>
                  {(products || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name} ({formatBDT(p.selling_price)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-9 gap-1 text-xs rounded-xl" onClick={addReplacement} disabled={!selectedProdId}>
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            <p className="text-[10px] text-right text-muted-foreground">Replacement Value: <strong>{formatBDT(replaceTotal)}</strong></p>
          </div>

          {/* Price Adjustment */}
          <div className="rounded-xl bg-muted/50 p-3.5 space-y-2 border border-border/30">
            <div className="flex justify-between text-sm font-medium">
              <span>Price Adjustment</span>
              <span className={priceDiff > 0 ? "text-amber-600" : priceDiff < 0 ? "text-emerald-600" : "text-muted-foreground"}>
                {priceDiff > 0 ? "+" : ""}{formatBDT(priceDiff)}
              </span>
            </div>
            {priceDiff > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                Customer to pay extra {formatBDT(priceDiff)} via COD on exchange order
              </div>
            )}
            {priceDiff < 0 && (
              <div className="space-y-2">
                <p className="text-xs text-emerald-600">Refund {formatBDT(Math.abs(priceDiff))} to customer</p>
                <div className="space-y-1">
                  <Label className="text-[10px]">Refund Method</Label>
                  <Select value={refundMethod} onValueChange={setRefundMethod}>
                    <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue placeholder="Select method..." /></SelectTrigger>
                    <SelectContent>
                      {REFUND_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes</Label>
            <Textarea className="text-sm rounded-xl" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1 gap-1.5 rounded-xl" disabled={!reason || replacementItems.length === 0 || createEx.isPending} onClick={handleSubmit}>
              {createEx.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
              Create Exchange
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
