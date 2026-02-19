import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

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
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Damage Return — #{orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ⚠️ Damage Return এ stock ফেরত আসবে না। শুধু damage log এ রেকর্ড হবে।
          </p>

          {items.map((item) => (
            <div key={item.product_id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{(item.products as any)?.name}</span>
                <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
              </div>

              <RadioGroup
                value={conditions[item.product_id]}
                onValueChange={(v) => setConditions((p) => ({ ...p, [item.product_id]: v }))}
                className="flex gap-4"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="completely_damaged" id={`cd-${item.product_id}`} />
                  <Label htmlFor={`cd-${item.product_id}`} className="text-xs">Completely Damaged</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="partially_damaged" id={`pd-${item.product_id}`} />
                  <Label htmlFor={`pd-${item.product_id}`} className="text-xs">Partially Damaged</Label>
                </div>
              </RadioGroup>

              <Textarea
                placeholder="Damage description..."
                value={descriptions[item.product_id] || ""}
                onChange={(e) => setDescriptions((p) => ({ ...p, [item.product_id]: e.target.value }))}
                rows={2}
                className="text-xs"
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? "Processing..." : "Confirm Damage Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
