import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, PackageCheck, AlertCircle } from "lucide-react";
import { useConfirmReturnReceipt, type ReturnCase, type ReceivedItem } from "@/hooks/use-return-cases";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnCase: ReturnCase;
}

const RETURN_TYPES = [
  { value: "exchange_return", label: "Exchange return" },
  { value: "courier_return", label: "Courier return" },
  { value: "customer_handover", label: "Customer handover (manual)" },
];

const CONDITIONS = [
  { value: "good", label: "Good", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "damaged", label: "Damaged", color: "text-amber-700 bg-amber-50 border-amber-200" },
  { value: "unusable", label: "Unusable", color: "text-destructive bg-red-50 border-red-200" },
];

export function ReturnReceivedModal({ open, onOpenChange, returnCase }: Props) {
  const confirmMut = useConfirmReturnReceipt();
  const [returnType, setReturnType] = useState(returnCase.exchange_case_id ? "exchange_return" : "");
  const [condition, setCondition] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [notes, setNotes] = useState("");

  const [receivedLines, setReceivedLines] = useState(() =>
    returnCase.expected_items.map((item) => ({
      ...item,
      received_qty: item.quantity,
      item_condition: "good" as string,
    }))
  );

  const updateReceivedQty = (idx: number, qty: number) => {
    setReceivedLines((prev) =>
      prev.map((l, i) => i === idx ? { ...l, received_qty: Math.max(0, Math.min(qty, l.quantity)) } : l)
    );
  };

  const updateItemCondition = (idx: number, cond: string) => {
    setReceivedLines((prev) =>
      prev.map((l, i) => i === idx ? { ...l, item_condition: cond } : l)
    );
  };

  const totalExpected = useMemo(() => returnCase.expected_items.reduce((s, i) => s + i.quantity, 0), [returnCase]);
  const totalReceived = useMemo(() => receivedLines.reduce((s, l) => s + l.received_qty, 0), [receivedLines]);
  const isPartial = totalReceived < totalExpected && totalReceived > 0;

  const canSubmit = !!returnType && !!condition && totalReceived > 0 && !confirmMut.isPending;

  const handleConfirm = () => {
    if (!canSubmit) return;

    const received: ReceivedItem[] = receivedLines
      .filter((l) => l.received_qty > 0)
      .map((l) => ({
        product_id: l.product_id,
        product_name: l.product_name,
        sku: l.sku,
        quantity: l.received_qty,
        condition: l.item_condition || condition,
      }));

    confirmMut.mutate(
      {
        return_case_id: returnCase.id,
        parent_order_id: returnCase.parent_order_id,
        exchange_case_id: returnCase.exchange_case_id,
        return_type: returnType,
        received_items: received,
        condition,
        warehouse_location: warehouse || undefined,
        notes: notes || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="w-5 h-5 text-emerald-600" />
            Mark Return Received
          </DialogTitle>
          <DialogDescription className="text-xs">
            Confirm physical receipt of returned items. This will update inventory.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Return Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Return Type *</Label>
            <Select value={returnType} onValueChange={setReturnType}>
              <SelectTrigger className="h-9 text-xs rounded-xl">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {RETURN_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Items Received */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Items to Receive</Label>
            <div className="space-y-1.5">
              {receivedLines.map((item, idx) => (
                <div key={idx} className="rounded-xl p-3 border border-border/50 bg-muted/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.product_name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{item.sku || "—"}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Label className="text-[10px] text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        className="h-7 w-14 text-xs text-center rounded-lg"
                        value={item.received_qty}
                        min={0}
                        max={item.quantity}
                        onChange={(e) => updateReceivedQty(idx, parseInt(e.target.value) || 0)}
                      />
                      <span className="text-[10px] text-muted-foreground">/ {item.quantity}</span>
                    </div>
                  </div>
                  <Select value={item.item_condition} onValueChange={(v) => updateItemCondition(idx, v)}>
                    <SelectTrigger className="h-7 text-[10px] rounded-lg w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Expected: {totalExpected} · Received: {totalReceived}</span>
              {isPartial && (
                <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700">
                  Partial Receipt
                </Badge>
              )}
            </div>
          </div>

          {/* Overall Condition */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Overall Condition *</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {CONDITIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCondition(c.value)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-medium border transition-all",
                    condition === c.value ? c.color + " ring-1 ring-offset-1" : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {condition && condition !== "good" && (
              <p className="text-[10px] text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {condition === "damaged" ? "Items will go to Damaged Stock (not counted in Available)" : "Items marked unusable — no stock increase"}
              </p>
            )}
          </div>

          {/* Warehouse */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Warehouse Location <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              className="h-9 text-xs rounded-xl"
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              placeholder="e.g. Shelf A3, Bin 12"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              className="text-sm rounded-xl"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional observations..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 gap-1.5 rounded-xl"
              disabled={!canSubmit}
              onClick={handleConfirm}
            >
              {confirmMut.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <PackageCheck className="w-3.5 h-3.5" />
              )}
              Confirm Receipt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
