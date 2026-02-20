import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  onConfirm: (items: { productId: string; quantity: number; condition: string; description: string }[]) => void;
  loading?: boolean;
}

interface OrderItem {
  product_id: string;
  quantity: number;
  products: { name: string } | null;
}

export function DamageReturnModal({ open, onOpenChange, orderId, orderNumber, onConfirm, loading }: Props) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && orderId) {
      supabase
        .from("order_items")
        .select("product_id, quantity, products(name)")
        .eq("order_id", orderId)
        .then(({ data }) => {
          setItems((data as any) || []);
          const conds: Record<string, string> = {};
          const descs: Record<string, string> = {};
          data?.forEach((i: any) => {
            conds[i.product_id] = "completely_damaged";
            descs[i.product_id] = "";
          });
          setConditions(conds);
          setDescriptions(descs);
        });
    }
  }, [open, orderId]);

  const handleConfirm = () => {
    const damageItems = items.map((i) => ({
      productId: i.product_id,
      quantity: i.quantity,
      condition: conditions[i.product_id] || "completely_damaged",
      description: descriptions[i.product_id] || "",
    }));
    onConfirm(damageItems);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Damage Return</DialogTitle>
              <DialogDescription>Order #{orderNumber}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(80vh - 180px)" }}>
          <div className="rounded-xl bg-warning/10 border border-warning/20 p-3">
            <p className="text-sm text-warning font-medium">
              ⚠️ Damage Return এ stock ফেরত আসবে না। শুধু damage log এ রেকর্ড হবে।
            </p>
          </div>

          {items.map((item, idx) => (
            <div
              key={item.product_id}
              className="rounded-xl border p-4 space-y-3 animate-row-in"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{(item.products as any)?.name}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Qty: {item.quantity}</span>
              </div>

              <RadioGroup
                value={conditions[item.product_id]}
                onValueChange={(v) => setConditions((p) => ({ ...p, [item.product_id]: v }))}
                className="flex gap-4"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="completely_damaged" id={`cd-${item.product_id}`} />
                  <Label htmlFor={`cd-${item.product_id}`} className="text-xs cursor-pointer">Completely Damaged</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="partially_damaged" id={`pd-${item.product_id}`} />
                  <Label htmlFor={`pd-${item.product_id}`} className="text-xs cursor-pointer">Partially Damaged</Label>
                </div>
              </RadioGroup>

              <Textarea
                placeholder="Damage description..."
                value={descriptions[item.product_id] || ""}
                onChange={(e) => setDescriptions((p) => ({ ...p, [item.product_id]: e.target.value }))}
                rows={2}
                className="text-xs resize-none rounded-lg"
              />
            </div>
          ))}
        </div>

        <DialogFooter className="px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? "Processing..." : "Confirm Damage Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}