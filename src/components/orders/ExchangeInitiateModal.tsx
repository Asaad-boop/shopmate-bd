import { useState, useMemo } from "react";
import { useCreateExchange } from "@/hooks/use-exchanges";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/lib/format";
import { ArrowRightLeft, Loader2, Package, AlertCircle, Search, Plus, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  orderItems: any[];
}

interface ReturnLine {
  product_id: string;
  product_name: string;
  sku: string;
  max_qty: number;
  quantity: number;
  unit_price: number;
  selected: boolean;
}

interface ReplacementLine {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
}

const EXCHANGE_REASONS = [
  { value: "wrong_product", label: "Wrong product sent" },
  { value: "damaged_defective", label: "Damaged/defective" },
  { value: "missing_parts", label: "Missing parts" },
  { value: "size_variant", label: "Size/variant issue" },
  { value: "customer_changed_mind", label: "Customer changed mind" },
  { value: "other", label: "Other" },
];

const HANDLING_OPTIONS = [
  { value: "courier_next_delivery", label: "Courier will bring replacement on next delivery" },
  { value: "store_pickup", label: "Customer will visit / store pickup" },
  { value: "manual_backoffice", label: "Manual (back office)" },
];

export function ExchangeInitiateModal({ open, onOpenChange, order, orderItems }: Props) {
  const createEx = useCreateExchange();
  const [timing, setTiming] = useState<string>("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [handling, setHandling] = useState("");
  const [skuSearch, setSkuSearch] = useState("");

  const [returnLines, setReturnLines] = useState<ReturnLine[]>(() =>
    (orderItems || []).map((i: any) => ({
      product_id: i.product_id,
      product_name: i.products?.name || i.product_name_fallback || "Unknown",
      sku: i.products?.sku || "",
      max_qty: i.quantity,
      quantity: i.quantity,
      unit_price: i.unit_price,
      selected: true,
    }))
  );

  const [replacementItems, setReplacementItems] = useState<ReplacementLine[]>([]);

  // SKU search query
  const { data: searchResults } = useQuery({
    queryKey: ["product-search-exchange", skuSearch],
    enabled: skuSearch.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, sku, selling_price")
        .or(`sku.ilike.%${skuSearch}%,name.ilike.%${skuSearch}%`)
        .limit(8);
      return data || [];
    },
  });

  const selectedItems = useMemo(() => returnLines.filter((l) => l.selected && l.quantity > 0), [returnLines]);
  const returnTotal = useMemo(() => selectedItems.reduce((s, i) => s + i.unit_price * i.quantity, 0), [selectedItems]);
  const replaceTotal = useMemo(() => replacementItems.reduce((s, i) => s + i.unit_price * i.quantity, 0), [replacementItems]);
  const priceDiff = replaceTotal - returnTotal;

  const detailsValid = details.trim().length >= 10;
  const canSubmit = !!timing && !!reason && detailsValid && !!handling && selectedItems.length > 0 && replacementItems.length > 0 && !createEx.isPending;

  const customer = order?.customers as any;
  const invoiceDisplay = order?.invoice_id || order?.order_number || "";
  const currentStatus = order?.status || "pending";

  const toggleItem = (idx: number) => {
    setReturnLines((prev) => prev.map((l, i) => i === idx ? { ...l, selected: !l.selected } : l));
  };

  const updateQty = (idx: number, qty: number) => {
    setReturnLines((prev) =>
      prev.map((l, i) => i === idx ? { ...l, quantity: Math.max(1, Math.min(qty, l.max_qty)) } : l)
    );
  };

  const addReplacement = (product: any) => {
    // Don't add duplicates
    if (replacementItems.find((r) => r.product_id === product.id)) return;
    setReplacementItems((prev) => [
      ...prev,
      { product_id: product.id, product_name: product.name, sku: product.sku || "", quantity: 1, unit_price: product.selling_price || 0 },
    ]);
    setSkuSearch("");
  };

  const removeReplacement = (idx: number) => {
    setReplacementItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateReplacementQty = (idx: number, qty: number) => {
    setReplacementItems((prev) =>
      prev.map((r, i) => i === idx ? { ...r, quantity: Math.max(1, qty) } : r)
    );
  };

  const autoFillSameProducts = () => {
    const items = selectedItems.map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      sku: i.sku,
      quantity: i.quantity,
      unit_price: i.unit_price,
    }));
    setReplacementItems(items);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    createEx.mutate(
      {
        order_id: order.id,
        reason: `${EXCHANGE_REASONS.find(r => r.value === reason)?.label || reason}`,
        exchange_type: timing === "rider_time" ? "same" : "different",
        customer_phone: customer?.phone,
        customer_name: customer?.full_name,
        notes: `Timing: ${timing === "rider_time" ? "Rider-time" : "After delivery"} | Handling: ${HANDLING_OPTIONS.find(h => h.value === handling)?.label || handling} | Status at initiation: ${currentStatus}\n${details}`,
        return_items: selectedItems.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          sku: i.sku,
          quantity: i.quantity,
          unit_price: i.unit_price,
          condition: "good",
        })),
        replacement_items: replacementItems.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          sku: i.sku,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="w-5 h-5 text-amber-600" />
            Initiate Exchange
            {invoiceDisplay && (
              <Badge variant="outline" className="text-[10px] font-mono ml-1">
                {invoiceDisplay}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* 1) Exchange Timing */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Exchange Timing *</Label>
            <RadioGroup value={timing} onValueChange={setTiming} className="grid grid-cols-1 gap-2">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${timing === "rider_time" ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700" : "border-border hover:bg-muted/30"}`}>
                <RadioGroupItem value="rider_time" />
                <div>
                  <p className="text-xs font-medium">Rider-time exchange</p>
                  <p className="text-[10px] text-muted-foreground">Customer checked item in front of courier</p>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${timing === "after_delivery" ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700" : "border-border hover:bg-muted/30"}`}>
                <RadioGroupItem value="after_delivery" />
                <div>
                  <p className="text-xs font-medium">After delivery exchange</p>
                  <p className="text-[10px] text-muted-foreground">Customer reported issue after receiving</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* 2) Exchange Reason */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Exchange Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9 text-xs rounded-xl">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {EXCHANGE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3) Details / Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Details / Notes *</Label>
            <Textarea
              className="text-sm rounded-xl"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe the issue in detail (min 10 characters)..."
            />
            {details.length > 0 && !detailsValid && (
              <p className="text-[10px] text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Minimum 10 characters ({details.trim().length}/10)
              </p>
            )}
          </div>

          {/* 4) Items to Return */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Items to Return
            </Label>
            <div className="space-y-1.5">
              {returnLines.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2.5 rounded-xl p-2.5 border transition-colors ${
                    item.selected
                      ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                      : "bg-muted/30 border-border/30 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggleItem(idx)}
                    className="rounded border-border accent-amber-600 w-4 h-4 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.product_name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{item.sku || "—"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Label className="text-[10px] text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      className="h-7 w-14 text-xs text-center rounded-lg"
                      value={item.quantity}
                      min={1}
                      max={item.max_qty}
                      disabled={!item.selected}
                      onChange={(e) => updateQty(idx, parseInt(e.target.value) || 1)}
                    />
                    <span className="text-[10px] text-muted-foreground">/ {item.max_qty}</span>
                  </div>
                  <span className="text-xs font-mono w-16 text-right shrink-0">
                    {formatBDT(item.unit_price * (item.selected ? item.quantity : 0))}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-right text-muted-foreground">
              Return: {selectedItems.length} item(s) · <strong>{formatBDT(returnTotal)}</strong>
            </p>
          </div>

          {/* 5) Replacement Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Replacement Items *
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-[10px] h-6 px-2 text-amber-700"
                onClick={autoFillSameProducts}
              >
                Auto-fill same products
              </Button>
            </div>

            {/* SKU Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="h-8 pl-8 text-xs rounded-xl"
                placeholder="Search by SKU or product name..."
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
              />
              {skuSearch.length >= 2 && searchResults && searchResults.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((p: any) => (
                    <button
                      key={p.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left"
                      onClick={() => addReplacement(p)}
                    >
                      <Plus className="w-3 h-3 text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{p.sku || "—"} · {formatBDT(p.selling_price || 0)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Replacement list */}
            {replacementItems.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-3 border border-dashed border-border/50 rounded-xl">
                No replacement items added. Search above or auto-fill.
              </p>
            ) : (
              <div className="space-y-1.5">
                {replacementItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 rounded-xl p-2.5 border bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.product_name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{item.sku || "—"}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Label className="text-[10px] text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        className="h-7 w-14 text-xs text-center rounded-lg"
                        value={item.quantity}
                        min={1}
                        onChange={(e) => updateReplacementQty(idx, parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <span className="text-xs font-mono w-16 text-right shrink-0">
                      {formatBDT(item.unit_price * item.quantity)}
                    </span>
                    <button onClick={() => removeReplacement(idx)} className="p-1 rounded hover:bg-destructive/10">
                      <X className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-right text-muted-foreground">
              Replacement: {replacementItems.length} item(s) · <strong>{formatBDT(replaceTotal)}</strong>
            </p>
          </div>

          {/* Price Difference */}
          {(selectedItems.length > 0 && replacementItems.length > 0) && (
            <div className={`rounded-xl p-3 border text-center ${priceDiff > 0 ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20" : priceDiff < 0 ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20" : "bg-muted/30 border-border/30"}`}>
              <p className="text-[10px] text-muted-foreground">
                {priceDiff > 0 ? "Customer to Pay" : priceDiff < 0 ? "Refund to Customer" : "No Price Difference"}
              </p>
              <p className={`text-sm font-bold ${priceDiff > 0 ? "text-amber-700" : priceDiff < 0 ? "text-emerald-700" : ""}`}>
                {priceDiff !== 0 ? formatBDT(Math.abs(priceDiff)) : "৳0.00"}
              </p>
            </div>
          )}

          {/* 6) Handling */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Handling *</Label>
            <RadioGroup value={handling} onValueChange={setHandling} className="space-y-1.5">
              {HANDLING_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${handling === opt.value ? "bg-muted/60 border-primary/30" : "border-border hover:bg-muted/30"}`}
                >
                  <RadioGroupItem value={opt.value} />
                  <span className="text-xs">{opt.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {createEx.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowRightLeft className="w-3.5 h-3.5" />
              )}
              Confirm & Create Exchange Case
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
