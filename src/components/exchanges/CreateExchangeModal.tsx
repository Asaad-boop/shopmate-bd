import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateExchange } from "@/hooks/use-exchanges";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/lib/format";
import { ArrowRightLeft, Plus, Trash2, Loader2, Package } from "lucide-react";

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

export function CreateExchangeModal({ open, onOpenChange, order, orderItems }: Props) {
  const createEx = useCreateExchange();
  const [reason, setReason] = useState("");
  const [exchangeType, setExchangeType] = useState("different");
  const [notes, setNotes] = useState("");
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

  const returnTotal = returnItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const replaceTotal = replacementItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
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
      notes,
      return_items: returnItems,
      replacement_items: replacementItems,
    }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" /> Create Exchange
            <Badge variant="outline" className="text-[10px] font-mono ml-2">#{order?.order_number}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reason & Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select reason..." /></SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Exchange Type</Label>
              <Select value={exchangeType} onValueChange={setExchangeType}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="same">Same Product</SelectItem>
                  <SelectItem value="different">Different Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Return Items */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
              <Package className="w-3.5 h-3.5" /> Items Being Returned
            </Label>
            {returnItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-red-50 rounded-lg p-2 mb-1.5 border border-red-100">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.product_name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{item.sku}</p>
                </div>
                <Select value={item.condition} onValueChange={(v) => setReturnItems((prev) => prev.map((it, i) => i === idx ? { ...it, condition: v } : it))}>
                  <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                    <SelectItem value="defective">Defective</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" className="h-6 w-14 text-xs text-center" value={item.quantity} min={1}
                  onChange={(e) => setReturnItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, parseInt(e.target.value) || 1) } : it))} />
                <span className="text-xs font-mono w-16 text-right">{formatBDT(item.unit_price * item.quantity)}</span>
              </div>
            ))}
            <p className="text-[10px] text-right text-muted-foreground">Return Total: <strong>{formatBDT(returnTotal)}</strong></p>
          </div>

          <Separator />

          {/* Replacement Items */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
              <Package className="w-3.5 h-3.5" /> Replacement Items
            </Label>
            {replacementItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-emerald-50 rounded-lg p-2 mb-1.5 border border-emerald-100">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.product_name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{item.sku}</p>
                </div>
                <Input type="number" className="h-6 w-14 text-xs text-center" value={item.quantity} min={1}
                  onChange={(e) => setReplacementItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, parseInt(e.target.value) || 1) } : it))} />
                <span className="text-xs font-mono w-16 text-right">{formatBDT(item.unit_price * item.quantity)}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setReplacementItems((p) => p.filter((_, i) => i !== idx))}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <Select value={selectedProdId} onValueChange={setSelectedProdId}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Add replacement product..." /></SelectTrigger>
                <SelectContent>
                  {(products || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name} ({formatBDT(p.selling_price)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={addReplacement} disabled={!selectedProdId}>
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            <p className="text-[10px] text-right text-muted-foreground mt-1">Replacement Total: <strong>{formatBDT(replaceTotal)}</strong></p>
          </div>

          <Separator />

          {/* Price Difference Summary */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex justify-between text-xs">
              <span>Price Difference (Replacement - Return)</span>
              <span className={`font-mono font-semibold ${priceDiff > 0 ? "text-emerald-600" : priceDiff < 0 ? "text-red-600" : ""}`}>
                {priceDiff > 0 ? "+" : ""}{formatBDT(priceDiff)}
              </span>
            </div>
            {priceDiff > 0 && <p className="text-[10px] text-muted-foreground mt-1">Customer will pay extra {formatBDT(priceDiff)} via COD</p>}
            {priceDiff < 0 && <p className="text-[10px] text-muted-foreground mt-1">Customer will be refunded {formatBDT(Math.abs(priceDiff))}</p>}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea className="mt-1 text-sm" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1 gap-1" disabled={!reason || replacementItems.length === 0 || createEx.isPending} onClick={handleSubmit}>
              {createEx.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
              Create Exchange
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
