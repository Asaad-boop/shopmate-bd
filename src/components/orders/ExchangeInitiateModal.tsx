import { useState, useMemo } from "react";
import { useCreateExchange } from "@/hooks/use-exchanges";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/lib/format";
import { ArrowRightLeft, Loader2, Package, AlertCircle } from "lucide-react";

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

const EXCHANGE_TYPES = [
  { value: "same", label: "Same Product Replacement" },
  { value: "different", label: "Different Product Replacement" },
  { value: "partial", label: "Partial Exchange" },
];

export function ExchangeInitiateModal({ open, onOpenChange, order, orderItems }: Props) {
  const createEx = useCreateExchange();
  const [exchangeType, setExchangeType] = useState("");
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
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

  const selectedItems = useMemo(() => returnLines.filter((l) => l.selected && l.quantity > 0), [returnLines]);
  const returnTotal = useMemo(() => selectedItems.reduce((s, i) => s + i.unit_price * i.quantity, 0), [selectedItems]);

  const reasonValid = reason.trim().length >= 10;
  const canSubmit = !!exchangeType && reasonValid && selectedItems.length > 0 && !createEx.isPending;

  const customer = order?.customers as any;
  const invoiceDisplay = order?.invoice_id || order?.order_number || "";

  const toggleItem = (idx: number) => {
    setReturnLines((prev) => prev.map((l, i) => i === idx ? { ...l, selected: !l.selected } : l));
  };

  const updateQty = (idx: number, qty: number) => {
    setReturnLines((prev) =>
      prev.map((l, i) => i === idx ? { ...l, quantity: Math.max(1, Math.min(qty, l.max_qty)) } : l)
    );
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    createEx.mutate(
      {
        order_id: order.id,
        reason,
        exchange_type: exchangeType,
        customer_phone: customer?.phone,
        customer_name: customer?.full_name,
        notes: internalNote || undefined,
        return_items: selectedItems.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          sku: i.sku,
          quantity: i.quantity,
          unit_price: i.unit_price,
          condition: "good",
        })),
        replacement_items: [],
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto rounded-2xl">
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
          {/* Exchange Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Exchange Type *</Label>
            <Select value={exchangeType} onValueChange={setExchangeType}>
              <SelectTrigger className="h-9 text-xs rounded-xl">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {EXCHANGE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Items to Exchange */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Items to Exchange
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
              Selected: {selectedItems.length} item(s) · Value: <strong>{formatBDT(returnTotal)}</strong>
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Reason *</Label>
            <Textarea
              className="text-sm rounded-xl"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why this exchange is needed (min 10 characters)..."
            />
            {reason.length > 0 && !reasonValid && (
              <p className="text-[10px] text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Minimum 10 characters required ({reason.trim().length}/10)
              </p>
            )}
          </div>

          {/* Internal Note */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Internal Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              className="text-sm rounded-xl"
              rows={2}
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="Any internal remarks..."
            />
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
              Confirm & Create Exchange
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
