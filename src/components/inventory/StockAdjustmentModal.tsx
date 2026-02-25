import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Search, Package } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: any[];
  preselectedProductId?: string;
}

const REASONS = [
  "Physical Count Correction",
  "Damaged Goods",
  "Lost / Shrinkage",
  "Sample / Giveaway",
  "Other",
];

export default function StockAdjustmentModal({ open, onOpenChange, products, preselectedProductId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [productId, setProductId] = useState(preselectedProductId || "");
  const [adjustType, setAdjustType] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const selectedProduct = products?.find((p) => p.id === productId);
  const qty = parseInt(quantity) || 0;

  const filteredProducts = products?.filter((p) => {
    if (!productSearch) return true;
    const s = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
  });

  const reset = () => {
    setProductId(preselectedProductId || "");
    setAdjustType("add");
    setQuantity("");
    setReason("");
    setNote("");
    setProductSearch("");
  };

  const handleSave = async () => {
    if (!productId || qty <= 0 || !reason) {
      toast({ title: "Please select product, quantity, and reason", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const adjustNote = `${reason}${note ? ` — ${note}` : ""}`;

      // Write to inventory_ledger — the ONLY source of truth
      const { error: ledgerErr } = await supabase.from("inventory_ledger").insert({
        product_id: productId,
        sku: selectedProduct?.sku || "",
        txn_type: adjustType === "add" ? "stock_in" : "stock_out",
        qty_in: adjustType === "add" ? qty : 0,
        qty_out: adjustType === "remove" ? qty : 0,
        reference_type: "stock_adjustment",
        note: adjustNote,
      });
      if (ledgerErr) throw ledgerErr;

      // Audit log
      await supabase.from("audit_logs").insert({
        entity_type: "inventory_ledger",
        entity_id: productId,
        action: "stock_adjustment",
        after_json: {
          product_id: productId,
          sku: selectedProduct?.sku,
          type: adjustType,
          quantity: qty,
          reason,
          note,
        },
      });

      toast({ title: `✅ Stock adjusted: ${selectedProduct?.name} ${adjustType === "add" ? `+${qty}` : `-${qty}`}` });
      qc.invalidateQueries({ queryKey: ["stock-on-hand"] });
      qc.invalidateQueries({ queryKey: ["product-ledger"] });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Adjust Stock</DialogTitle>
              <DialogDescription>Creates a STOCK_ADJUSTMENT ledger entry. No direct edits.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(80vh - 180px)" }}>
          {/* Product Search */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Product</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search product..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-10 rounded-lg" />
            </div>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {filteredProducts?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Direction</Label>
            <RadioGroup value={adjustType} onValueChange={(v) => setAdjustType(v as any)} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="add" id="adj-add" />
                <Label htmlFor="adj-add" className="text-sm text-success font-medium cursor-pointer">Stock IN (+)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="remove" id="adj-remove" />
                <Label htmlFor="adj-remove" className="text-sm text-destructive font-medium cursor-pointer">Stock OUT (−)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Quantity</Label>
            <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Enter quantity" className="rounded-lg" />
          </div>

          {/* Preview */}
          {selectedProduct && qty > 0 && (
            <div className="p-4 rounded-xl bg-muted/50 text-sm space-y-1 animate-row-in">
              <p className="text-muted-foreground text-xs">Ledger entry will be created:</p>
              <p className={cn("font-bold text-lg", adjustType === "add" ? "text-success" : "text-destructive")}>
                {adjustType === "add" ? `+${qty} IN` : `−${qty} OUT`}
              </p>
              <p className="text-[10px] text-muted-foreground">Type: STOCK_ADJUSTMENT • No direct quantity edit</p>
            </div>
          )}

          {/* Reason — MANDATORY */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Reason <span className="text-destructive">*</span></Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select reason" /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Additional details..." rows={2} className="rounded-lg resize-none" />
          </div>
        </div>

        <DialogFooter className="px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !productId || qty <= 0 || !reason}>
            {saving ? "Saving..." : "Submit Adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
