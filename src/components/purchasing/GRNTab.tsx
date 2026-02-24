import { useState } from "react";
import { useGoodsReceipts, useCreateGRN, usePostGRN, useCashBankAccounts } from "@/hooks/use-purchasing";
import { useSuppliers } from "@/hooks/use-purchase-orders";
import { usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, CheckCircle2, Package, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface LocalItem {
  product_id?: string;
  sku: string;
  product_name: string;
  qty_received: number;
  unit_cost: number;
}

export function GRNTab() {
  const { data: grns, isLoading } = useGoodsReceipts();
  const { data: suppliers } = useSuppliers();
  const { data: pos } = usePurchaseOrders();
  const createGRN = useCreateGRN();
  const postGRN = usePostGRN();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [supplierId, setSupplierId] = useState("");
  const [poId, setPoId] = useState("");
  const [receiptDate, setReceiptDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [receiptType, setReceiptType] = useState("LOCAL");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LocalItem[]>([{ sku: "", product_name: "", qty_received: 0, unit_cost: 0 }]);

  const addItem = () => setItems((p) => [...p, { sku: "", product_name: "", qty_received: 0, unit_cost: 0 }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof LocalItem, value: any) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));

  const loadFromPO = async (poIdVal: string) => {
    setPoId(poIdVal);
    const po = pos?.find((p) => p.id === poIdVal);
    if (po) {
      setSupplierId(po.supplier_id || "");
      setReceiptType("IMPORT");
    }
    const { data: poItems } = await supabase
      .from("purchase_order_items")
      .select("*, products(name, sku)")
      .eq("purchase_order_id", poIdVal);
    if (poItems && poItems.length > 0) {
      setItems(
        poItems.map((i) => ({
          product_id: i.product_id || undefined,
          sku: (i.products as any)?.sku || "",
          product_name: i.product_name || (i.products as any)?.name || "",
          qty_received: i.quantity - (i.received_quantity || 0),
          unit_cost: Number(i.unit_price_usd || i.unit_price_cny || 0),
        }))
      );
    }
  };

  const handleCreate = () => {
    if (!supplierId) {
      toast({ title: "Select a supplier", variant: "destructive" });
      return;
    }
    const validItems = items.filter((i) => i.qty_received > 0);
    if (validItems.length === 0) {
      toast({ title: "Add at least one item", variant: "destructive" });
      return;
    }
    createGRN.mutate(
      { supplier_id: supplierId, po_id: poId || undefined, receipt_date: receiptDate, receipt_type: receiptType, notes, items: validItems },
      {
        onSuccess: () => {
          setModalOpen(false);
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setSupplierId("");
    setPoId("");
    setReceiptDate(format(new Date(), "yyyy-MM-dd"));
    setReceiptType("LOCAL");
    setNotes("");
    setItems([{ sku: "", product_name: "", qty_received: 0, unit_cost: 0 }]);
  };

  const filtered = grns?.filter(
    (g) => !search || g.grn_number.toLowerCase().includes(search.toLowerCase()) || (g.suppliers as any)?.name?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const statusBadge = (s: string) => {
    if (s === "posted") return <Badge className="bg-success/10 text-success text-[10px]">✅ Posted</Badge>;
    if (s === "reversed") return <Badge className="bg-destructive/10 text-destructive text-[10px]">⛔ Reversed</Badge>;
    return <Badge className="bg-muted text-muted-foreground text-[10px]">📋 Draft</Badge>;
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search GRN..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { resetForm(); setModalOpen(true); }}>
          <Plus className="w-4 h-4" /> New GRN
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Package className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No goods receipts yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRN #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((g, i) => {
                const itemCount = (g.goods_receipt_items as any[])?.length || 0;
                return (
                  <TableRow key={g.id} className="animate-row-in" style={{ animationDelay: `${i * 30}ms` }}>
                    <TableCell className="font-bold text-primary">{g.grn_number}</TableCell>
                    <TableCell className="text-sm">{(g.suppliers as any)?.name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(g.purchase_orders as any)?.po_number || "—"}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${g.receipt_type === "IMPORT" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {g.receipt_type === "IMPORT" ? "🚢 Import" : "🏠 Local"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{format(new Date(g.receipt_date), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-sm">{itemCount}</TableCell>
                    <TableCell className="text-sm font-semibold">৳{(g.total_product_cost || 0).toLocaleString()}</TableCell>
                    <TableCell>{statusBadge(g.status)}</TableCell>
                    <TableCell>
                      {g.status === "draft" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => postGRN.mutate(g.id)}
                          disabled={postGRN.isPending}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Post
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create GRN Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Goods Receipt Note</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Supplier *</label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">From PO (optional)</label>
                <Select value={poId} onValueChange={loadFromPO}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select PO" /></SelectTrigger>
                  <SelectContent>
                    {pos?.filter((p) => p.status !== "received").map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.po_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Receipt Date</label>
                <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
                <Select value={receiptType} onValueChange={setReceiptType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOCAL">🏠 Local</SelectItem>
                    <SelectItem value="IMPORT">🚢 Import</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9" placeholder="Optional..." />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Items</h3>
                <Button size="sm" variant="ghost" onClick={addItem} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add Item
                </Button>
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-28">Unit Cost</TableHead>
                      <TableHead className="w-28">Line Total</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input value={item.sku} onChange={(e) => updateItem(i, "sku", e.target.value)} className="h-8 text-xs" placeholder="SKU" />
                        </TableCell>
                        <TableCell>
                          <Input value={item.product_name} onChange={(e) => updateItem(i, "product_name", e.target.value)} className="h-8 text-xs" placeholder="Product name" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.qty_received || ""} onChange={(e) => updateItem(i, "qty_received", Number(e.target.value))} className="h-8 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.unit_cost || ""} onChange={(e) => updateItem(i, "unit_cost", Number(e.target.value))} className="h-8 text-xs" />
                        </TableCell>
                        <TableCell className="text-sm font-semibold">
                          ৳{(item.qty_received * item.unit_cost).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {items.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(i)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-right mt-2">
                <span className="text-sm font-bold">
                  Total: ৳{items.reduce((s, i) => s + i.qty_received * i.unit_cost, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createGRN.isPending}>
              {createGRN.isPending ? "Creating..." : "Create GRN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
