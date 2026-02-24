import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBDT } from "@/lib/format";
import { Package, ArrowRightLeft, Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";

interface ExchangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
}

interface ExchangeItem {
  product_id: string;
  sku: string;
  name: string;
  quantity: number;
}

export function ExchangeModal({ open, onOpenChange, order }: ExchangeModalProps) {
  const qc = useQueryClient();
  const o = order;
  const originalItems: any[] = o?.order_items || [];
  const [newItems, setNewItems] = useState<ExchangeItem[]>([]);
  const [reason, setReason] = useState(o?.exchange_reason || "");
  const [selectedProductId, setSelectedProductId] = useState("");

  // Fetch products for selection
  const { data: products } = useQuery({
    queryKey: ["products-for-exchange"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("status", "active")
        .order("name");
      return data || [];
    },
    enabled: open,
  });

  const addItem = () => {
    if (!selectedProductId) return;
    const prod = products?.find((p: any) => p.id === selectedProductId);
    if (!prod) return;
    if (newItems.find((i) => i.product_id === prod.id)) {
      toast({ title: "Product already added", variant: "destructive" });
      return;
    }
    setNewItems([...newItems, { product_id: prod.id, sku: prod.sku, name: prod.name, quantity: 1 }]);
    setSelectedProductId("");
  };

  const updateQty = (idx: number, qty: number) => {
    setNewItems((prev) => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, qty) } : item));
  };

  const removeItem = (idx: number) => {
    setNewItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const applyExchange = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error("Reason is required");
      if (newItems.length === 0) throw new Error("At least one new item is required");

      // 1. Stock IN for original returned items
      for (const item of originalItems) {
        const prod = item.products;
        if (!prod?.id) continue;
        await supabase.from("inventory_ledger").insert({
          product_id: prod.id,
          sku: prod.sku || "",
          txn_type: "return_good",
          qty_in: item.quantity,
          reference_type: "exchange",
          reference_id: o.id,
          note: `Exchange return: ${reason}`,
        });
      }

      // 2. Stock OUT for new exchanged items
      for (const item of newItems) {
        // Check stock availability
        const { data: stockData } = await supabase
          .from("v_stock_on_hand")
          .select("available")
          .eq("product_id", item.product_id)
          .single();

        const available = (stockData as any)?.available || 0;
        if (available < item.quantity) {
          throw new Error(`Insufficient stock for ${item.sku}: available ${available}, need ${item.quantity}`);
        }

        await supabase.from("inventory_ledger").insert({
          product_id: item.product_id,
          sku: item.sku,
          txn_type: "reserve",
          qty_out: item.quantity,
          reference_type: "exchange",
          reference_id: o.id,
          note: `Exchange issue: ${reason}`,
        });
      }

      // 3. Update order status
      const { error: updErr } = await supabase
        .from("orders")
        .update({
          status: "exchanged",
          exchange_applied: true,
          exchange_reason: reason,
          exchange_applied_at: new Date().toISOString(),
        })
        .eq("id", o.id);
      if (updErr) throw updErr;

      // 4. Audit log
      await supabase.from("audit_logs").insert({
        entity_type: "order",
        entity_id: o.id,
        action: "exchange_applied",
        after_json: {
          original_items: originalItems.map((i: any) => ({ sku: i.products?.sku, qty: i.quantity })),
          new_items: newItems.map((i) => ({ sku: i.sku, qty: i.quantity })),
          reason,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legacy-orders"] });
      qc.invalidateQueries({ queryKey: ["legacy-order-detail"] });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      toast({ title: "Exchange applied", description: "Stock movements recorded & status updated." });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Exchange failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            {o?.exchange_applied ? "Edit Exchange" : "Create Exchange"}
            <Badge variant="outline" className="text-[10px] ml-2 font-mono">
              #{o?.order_number || o?.legacy_order_id}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Original Items (read-only) */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Package className="w-3.5 h-3.5" /> Original Items (returned)
            </Label>
            <div className="space-y-1.5">
              {originalItems.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 bg-red-50 rounded-lg p-2 border border-red-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.products?.name || item.product_name_fallback || "Unknown"}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{item.products?.sku || "?"} × {item.quantity}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-red-600 border-red-200">↑ Stock IN</Badge>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* New Items (editable) */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Package className="w-3.5 h-3.5" /> New Items (issued)
            </Label>
            <div className="space-y-1.5">
              {newItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{item.sku}</p>
                  </div>
                  <Input
                    type="number"
                    className="h-7 w-16 text-xs text-center"
                    value={item.quantity}
                    min={1}
                    onChange={(e) => updateQty(idx, parseInt(e.target.value) || 1)}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">↓ Stock OUT</Badge>
                </div>
              ))}
            </div>

            {/* Add item */}
            <div className="flex gap-2 mt-2">
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Select product..." /></SelectTrigger>
                <SelectContent>
                  {(products || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={addItem} disabled={!selectedProductId}>
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
          </div>

          <Separator />

          {/* Reason */}
          <div>
            <Label className="text-xs">Reason / Notes</Label>
            <Textarea
              className="mt-1 text-sm"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why this exchange is needed..."
            />
          </div>

          {!reason.trim() && newItems.length > 0 && (
            <p className="text-[11px] text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Reason is required
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              className="flex-1 gap-1"
              disabled={applyExchange.isPending || newItems.length === 0 || !reason.trim()}
              onClick={() => applyExchange.mutate()}
            >
              {applyExchange.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
              Apply Exchange
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
