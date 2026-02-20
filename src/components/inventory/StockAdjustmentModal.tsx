import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: any[];
  preselectedProductId?: string;
}

const REASONS = [
  "Purchase Received",
  "Damaged",
  "Lost",
  "Return",
  "Manual Count",
  "Other",
];

export default function StockAdjustmentModal({ open, onOpenChange, products, preselectedProductId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [productId, setProductId] = useState(preselectedProductId || "");
  const [adjustType, setAdjustType] = useState<"add" | "remove" | "set">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const selectedProduct = products?.find((p) => p.id === productId);
  const currentStock = selectedProduct?.stock_quantity || 0;
  const qty = parseInt(quantity) || 0;

  const newStock = useMemo(() => {
    if (adjustType === "add") return currentStock + qty;
    if (adjustType === "remove") return Math.max(0, currentStock - qty);
    return qty; // set exact
  }, [adjustType, currentStock, qty]);

  const diff = newStock - currentStock;

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
    setReference("");
    setNote("");
    setProductSearch("");
  };

  const handleSave = async () => {
    if (!productId || qty <= 0) {
      toast({ title: "Please select product and enter quantity", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await supabase
        .from("products")
        .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
        .eq("id", productId);

      await supabase.from("inventory_movements").insert({
        product_id: productId,
        movement_type: "manual_adjustment",
        quantity: diff,
        notes: `${reason}${note ? ` - ${note}` : ""}${reference ? ` (Ref: ${reference})` : ""}`,
        reference_type: reason.toLowerCase().replace(/\s+/g, "_"),
      });

      toast({ title: `✅ Stock updated: ${selectedProduct?.name} → ${newStock}` });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Search */}
          <div className="space-y-2">
            <Label>Product</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search product..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {filteredProducts?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — Stock: {p.stock_quantity || 0}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <RadioGroup value={adjustType} onValueChange={(v) => setAdjustType(v as any)} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="add" id="add" />
                <Label htmlFor="add" className="text-sm text-success font-medium">Add Stock (+)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="remove" id="remove" />
                <Label htmlFor="remove" className="text-sm text-destructive font-medium">Remove (-)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="set" id="set" />
                <Label htmlFor="set" className="text-sm font-medium">Set Exact</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
          </div>

          {/* Preview */}
          {selectedProduct && qty > 0 && (
            <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
              <p>Current Stock: <span className="font-bold">{currentStock}</span></p>
              <p>
                After Adjustment: <span className={cn("font-bold", diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "")}>
                  {newStock} ({diff >= 0 ? `+${diff}` : diff})
                </span>
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label>Reference (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO number or note" />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Additional notes..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !productId || qty <= 0}>
            {saving ? "Saving..." : "Save Adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
