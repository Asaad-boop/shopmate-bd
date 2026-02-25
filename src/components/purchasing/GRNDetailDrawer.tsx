import { useGoodsReceipt, useGRNItems, usePostGRN } from "@/hooks/use-purchasing";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Package, ArrowDownToLine, BookOpen, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Props {
  grnId: string | null;
  onClose: () => void;
}

export function GRNDetailDrawer({ grnId, onClose }: Props) {
  const { data: grn, isLoading } = useGoodsReceipt(grnId || undefined);
  const { data: items } = useGRNItems(grnId || undefined);
  const postGRN = usePostGRN();
  const [confirmPost, setConfirmPost] = useState(false);

  const totalCost = items?.reduce((s, i) => s + (i.line_total || 0), 0) || 0;
  const totalQty = items?.reduce((s, i) => s + (i.qty_received || 0), 0) || 0;

  const handlePost = () => {
    if (!grnId) return;
    postGRN.mutate(grnId, {
      onSuccess: () => {
        setConfirmPost(false);
      },
    });
  };

  const statusColor = (s: string) => {
    if (s === "posted") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (s === "reversed") return "bg-destructive/10 text-destructive border-destructive/20";
    return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  };

  return (
    <>
      <Sheet open={!!grnId} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {isLoading ? <Skeleton className="h-5 w-40" /> : grn?.grn_number}
            </SheetTitle>
          </SheetHeader>

          {isLoading ? (
            <div className="space-y-3 mt-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : grn ? (
            <div className="space-y-5 mt-4">
              {/* Status & Meta */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${statusColor(grn.status)} text-xs border`}>
                  {grn.status === "posted" ? "✅ Posted" : grn.status === "reversed" ? "⛔ Reversed" : "📋 Draft"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {grn.receipt_type === "IMPORT" ? "🚢 Import" : "🏠 Local"}
                </Badge>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Supplier" value={(grn.suppliers as any)?.name || "—"} />
                <InfoRow label="Receipt Date" value={format(new Date(grn.receipt_date), "dd MMM yyyy")} />
                <InfoRow label="Linked PO" value={(grn.purchase_orders as any)?.po_number || "—"} />
                <InfoRow label="Journal" value={grn.journal_id ? `#${grn.journal_id.slice(0, 8)}` : "—"} />
              </div>

              {grn.notes && (
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-xs text-muted-foreground">{grn.notes}</p>
                </div>
              )}

              <Separator />

              {/* Items */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <ArrowDownToLine className="w-4 h-4 text-primary" /> Received Items ({items?.length || 0})
                </h3>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">SKU</TableHead>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-xs w-16 text-right">Qty</TableHead>
                        <TableHead className="text-xs w-24 text-right">Unit Cost</TableHead>
                        <TableHead className="text-xs w-24 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs text-primary">{item.sku || "—"}</TableCell>
                          <TableCell className="text-xs">{item.product_name || (item.products as any)?.name || "—"}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">{item.qty_received}</TableCell>
                          <TableCell className="text-xs text-right">৳{(item.unit_cost || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">৳{(item.line_total || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-between mt-3 px-1">
                  <span className="text-xs text-muted-foreground">{totalQty} units total</span>
                  <span className="text-sm font-bold">৳{totalCost.toLocaleString()}</span>
                </div>
              </div>

              <Separator />

              {/* Posting Preview */}
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" /> GL Impact
                </h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dr Inventory Asset</span>
                    <span className="font-semibold text-emerald-600">৳{totalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cr Supplier Payable</span>
                    <span className="font-semibold text-destructive">৳{totalCost.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Action */}
              {grn.status === "draft" && (
                <Button className="w-full gap-2" onClick={() => setConfirmPost(true)}>
                  <CheckCircle2 className="w-4 h-4" /> Post GRN — Update Inventory & GL
                </Button>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Confirm Post Dialog */}
      <Dialog open={confirmPost} onOpenChange={setConfirmPost}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm GRN Posting
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>This action will:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>Create <strong>Stock IN</strong> entries for {totalQty} units across {items?.length || 0} SKUs</li>
              <li>Update <strong>Weighted Average Cost</strong> for each product</li>
              <li>Post journal: <strong>Dr Inventory / Cr Supplier Payable</strong></li>
              <li>Update PO received quantities (if linked)</li>
            </ul>
            <p className="text-xs text-amber-600 mt-3">⚠️ This action cannot be undone directly — use reversal if needed.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmPost(false)}>Cancel</Button>
            <Button onClick={handlePost} disabled={postGRN.isPending}>
              {postGRN.isPending ? "Posting..." : "Confirm & Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
