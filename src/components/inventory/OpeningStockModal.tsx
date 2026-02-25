import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, PackageOpen } from "lucide-react";
import { formatBDT } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: any[];
}

export default function OpeningStockModal({ open, onOpenChange, products }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedProduct = products?.find((p) => p.id === productId);
  const qty = parseInt(quantity) || 0;
  const cost = parseFloat(unitCost) || 0;
  const totalValue = qty * cost;

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!productSearch) return products;
    const s = productSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s));
  }, [products, productSearch]);

  const reset = () => {
    setProductId("");
    setQuantity("");
    setUnitCost("");
    setProductSearch("");
  };

  const handleSave = async () => {
    if (!productId || qty <= 0 || cost <= 0) {
      toast({ title: "Please fill all fields with valid values", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // 1. Get account mappings
      const { data: mappings } = await supabase
        .from("account_mappings")
        .select("mapping_key, account_id")
        .in("mapping_key", ["inventory", "opening_balance_equity"]);

      const acctInventory = mappings?.find((m) => m.mapping_key === "inventory")?.account_id;
      const acctOBE = mappings?.find((m) => m.mapping_key === "opening_balance_equity")?.account_id;

      if (!acctInventory || !acctOBE) {
        toast({
          title: "Account mappings not configured",
          description: "Please map 'inventory' and 'opening_balance_equity' in Accounting → Account Mappings.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      // 2. Calculate new WAC
      const { data: newAvgCost } = await supabase.rpc("calc_weighted_avg_cost", {
        p_product_id: productId,
        p_new_qty: qty,
        p_new_cost: cost,
      });

      // 3. Insert inventory_ledger entry
      const { error: ledgerErr } = await supabase.from("inventory_ledger").insert({
        product_id: productId,
        sku: selectedProduct?.sku || "",
        txn_type: "stock_in",
        qty_in: qty,
        unit_cost: cost,
        running_avg_cost: newAvgCost || cost,
        reference_type: "opening_balance",
        note: "Opening stock entry",
      });
      if (ledgerErr) throw ledgerErr;

      // 4. Update product stock_quantity
      const currentStock = selectedProduct?.stock_quantity || 0;
      const { error: prodErr } = await supabase
        .from("products")
        .update({
          stock_quantity: currentStock + qty,
          landed_cost_bdt: newAvgCost || cost,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);
      if (prodErr) throw prodErr;

      // 5. Post GL journal: Dr Inventory Asset, Cr Opening Balance Equity
      const { data: je, error: jeErr } = await supabase
        .from("journal_entries")
        .insert({
          entry_date: new Date().toISOString().slice(0, 10),
          description: `Opening stock: ${selectedProduct?.name} (${selectedProduct?.sku}) × ${qty} @ ${cost}`,
          reference_type: "opening_balance",
          reference_id: productId,
          status: "posted",
          is_auto: true,
        })
        .select("id")
        .single();
      if (jeErr) throw jeErr;

      const { error: lineErr } = await supabase.from("journal_lines").insert([
        {
          journal_id: je.id,
          account_id: acctInventory,
          debit: totalValue,
          credit: 0,
          description: `Inventory asset – opening stock ${selectedProduct?.sku}`,
        },
        {
          journal_id: je.id,
          account_id: acctOBE,
          debit: 0,
          credit: totalValue,
          description: `Opening balance equity – ${selectedProduct?.sku}`,
        },
      ]);
      if (lineErr) throw lineErr;

      // 6. Audit log
      await supabase.from("audit_logs").insert({
        entity_type: "inventory_ledger",
        entity_id: productId,
        action: "opening_stock",
        after_json: {
          product_id: productId,
          sku: selectedProduct?.sku,
          quantity: qty,
          unit_cost: cost,
          total_value: totalValue,
          journal_id: je.id,
        },
      });

      toast({ title: `✅ Opening stock posted: ${selectedProduct?.name} × ${qty}` });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      qc.invalidateQueries({ queryKey: ["trial-balance"] });
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
              <PackageOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Opening Stock Entry</DialogTitle>
              <DialogDescription>Enter initial stock balance for a product</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4">
          {/* Product Search */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Product</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10 rounded-lg"
              />
            </div>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {filteredProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — Current: {p.stock_quantity || 0}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Quantity</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter opening quantity"
              className="rounded-lg"
            />
          </div>

          {/* Unit Cost */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Unit Cost (৳)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="Cost per unit"
              className="rounded-lg"
            />
          </div>

          {/* Preview */}
          {qty > 0 && cost > 0 && (
            <div className="p-4 rounded-xl bg-muted/50 text-sm space-y-2 animate-in fade-in-50">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Value</span>
                <span className="font-bold text-lg">{formatBDT(totalValue)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Reference</span>
                <span className="font-mono">OPENING_BALANCE</span>
              </div>
              <div className="border-t border-border/50 pt-2 mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dr Inventory Asset</span>
                  <span className="text-success font-medium">{formatBDT(totalValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cr Opening Balance Equity</span>
                  <span className="text-destructive font-medium">{formatBDT(totalValue)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !productId || qty <= 0 || cost <= 0}>
            {saving ? "Posting..." : "Post Opening Stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
