import { useState } from "react";
import { useCreateGRN } from "@/hooks/use-purchasing";
import { useSuppliers, usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileBox, Ship } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface LocalItem {
  product_id?: string;
  sku: string;
  product_name: string;
  qty_ordered: number;
  qty_already_received: number;
  qty_received: number;
  unit_cost: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GRNCreateModal({ open, onOpenChange }: Props) {
  const { data: suppliers } = useSuppliers();
  const { data: pos } = usePurchaseOrders();
  const createGRN = useCreateGRN();

  const [sourceType, setSourceType] = useState<"PO" | "IMPORT" | "MANUAL">("PO");
  const [supplierId, setSupplierId] = useState("");
  const [poId, setPoId] = useState("");
  const [importShipmentId, setImportShipmentId] = useState("");
  const [importShipments, setImportShipments] = useState<any[]>([]);
  const [receiptDate, setReceiptDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [receiptType, setReceiptType] = useState("LOCAL");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LocalItem[]>([{ sku: "", product_name: "", qty_ordered: 0, qty_already_received: 0, qty_received: 0, unit_cost: 0 }]);

  const addItem = () => setItems((p) => [...p, { sku: "", product_name: "", qty_ordered: 0, qty_already_received: 0, qty_received: 0, unit_cost: 0 }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof LocalItem, value: any) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));

  // Load import shipments for selector
  const loadImportShipments = async () => {
    const { data } = await supabase
      .from("import_shipments")
      .select("id, import_number, supplier_id, status, suppliers(name)")
      .in("status", ["arrived", "cleared", "received"])
      .order("created_at", { ascending: false });
    setImportShipments(data || []);
  };

  const loadFromPO = async (poIdVal: string) => {
    setPoId(poIdVal);
    const po = pos?.find((p) => p.id === poIdVal);
    if (po) {
      setSupplierId(po.supplier_id || "");
      setReceiptType(po.supplier_id ? "LOCAL" : "IMPORT");
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
          qty_ordered: i.quantity || 0,
          qty_already_received: i.received_quantity || 0,
          qty_received: Math.max(0, (i.quantity || 0) - (i.received_quantity || 0)),
          unit_cost: Number(i.unit_price_usd || i.unit_price_cny || 0),
        }))
      );
    }
  };

  const loadFromImport = async (shipmentId: string) => {
    setImportShipmentId(shipmentId);
    setReceiptType("IMPORT");
    const shipment = importShipments.find((s) => s.id === shipmentId);
    if (shipment) setSupplierId(shipment.supplier_id || "");

    // Get linked POs
    const { data: links } = await supabase
      .from("import_shipment_pos")
      .select("po_id")
      .eq("import_shipment_id", shipmentId);

    if (links && links.length > 0) {
      const poIds = links.map((l) => l.po_id);
      const { data: poItems } = await supabase
        .from("purchase_order_items")
        .select("*, products(name, sku), purchase_orders(po_number)")
        .in("purchase_order_id", poIds);

      if (poItems && poItems.length > 0) {
        setItems(
          poItems.map((i) => ({
            product_id: i.product_id || undefined,
            sku: (i.products as any)?.sku || "",
            product_name: i.product_name || (i.products as any)?.name || "",
            qty_ordered: i.quantity || 0,
            qty_already_received: i.received_quantity || 0,
            qty_received: Math.max(0, (i.quantity || 0) - (i.received_quantity || 0)),
            unit_cost: Number(i.unit_price_usd || i.unit_price_cny || 0),
          }))
        );
      }
    }
  };

  const handleCreate = () => {
    if (!supplierId) {
      toast({ title: "Select a supplier", variant: "destructive" });
      return;
    }
    const validItems = items.filter((i) => i.qty_received > 0);
    if (validItems.length === 0) {
      toast({ title: "Add at least one item with qty > 0", variant: "destructive" });
      return;
    }
    createGRN.mutate(
      {
        supplier_id: supplierId,
        po_id: poId || undefined,
        import_shipment_id: importShipmentId || undefined,
        receipt_date: receiptDate,
        receipt_type: receiptType,
        notes,
        items: validItems.map((i) => ({
          product_id: i.product_id,
          sku: i.sku,
          product_name: i.product_name,
          qty_received: i.qty_received,
          unit_cost: i.unit_cost,
        })),
      },
      { onSuccess: () => { onOpenChange(false); resetForm(); } }
    );
  };

  const resetForm = () => {
    setSourceType("PO");
    setSupplierId("");
    setPoId("");
    setImportShipmentId("");
    setReceiptDate(format(new Date(), "yyyy-MM-dd"));
    setReceiptType("LOCAL");
    setNotes("");
    setItems([{ sku: "", product_name: "", qty_ordered: 0, qty_already_received: 0, qty_received: 0, unit_cost: 0 }]);
  };

  const grandTotal = items.reduce((s, i) => s + i.qty_received * i.unit_cost, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBox className="w-5 h-5 text-primary" />
            Create Goods Receive Note
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Source Type Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Source</label>
            <div className="flex gap-2">
              {(["PO", "IMPORT", "MANUAL"] as const).map((t) => (
                <Button
                  key={t}
                  variant={sourceType === t ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setSourceType(t);
                    if (t === "IMPORT") loadImportShipments();
                    if (t === "MANUAL") {
                      setPoId("");
                      setImportShipmentId("");
                      setItems([{ sku: "", product_name: "", qty_ordered: 0, qty_already_received: 0, qty_received: 0, unit_cost: 0 }]);
                    }
                  }}
                >
                  {t === "PO" && <><FileBox className="w-3.5 h-3.5" /> From PO</>}
                  {t === "IMPORT" && <><Ship className="w-3.5 h-3.5" /> From Import</>}
                  {t === "MANUAL" && "Manual Entry"}
                </Button>
              ))}
            </div>
          </div>

          {/* Source Selector */}
          <div className="grid grid-cols-2 gap-3">
            {sourceType === "PO" && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Purchase Order *</label>
                <Select value={poId} onValueChange={loadFromPO}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select PO" /></SelectTrigger>
                  <SelectContent>
                    {pos?.filter((p) => p.status !== "closed").map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.po_number} — {(p.suppliers as any)?.name || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {sourceType === "IMPORT" && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Import Shipment *</label>
                <Select value={importShipmentId} onValueChange={loadFromImport}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select Import" /></SelectTrigger>
                  <SelectContent>
                    {importShipments.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.import_number} — {(s.suppliers as any)?.name || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {sourceType === "MANUAL" && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Supplier *</label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Metadata */}
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

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Receive Items</h3>
              {sourceType === "MANUAL" && (
                <Button size="sm" variant="ghost" onClick={addItem} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add Item
                </Button>
              )}
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">SKU</TableHead>
                    <TableHead className="text-xs">Product</TableHead>
                    {sourceType !== "MANUAL" && <TableHead className="text-xs w-20">Ordered</TableHead>}
                    {sourceType !== "MANUAL" && <TableHead className="text-xs w-20">Prev Rcv</TableHead>}
                    <TableHead className="text-xs w-24">Receiving</TableHead>
                    <TableHead className="text-xs w-28">Unit Cost (৳)</TableHead>
                    <TableHead className="text-xs w-28">Line Total</TableHead>
                    {sourceType === "MANUAL" && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, i) => {
                    const remaining = Math.max(0, item.qty_ordered - item.qty_already_received);
                    const isOver = sourceType !== "MANUAL" && item.qty_received > remaining;
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          {sourceType === "MANUAL" ? (
                            <Input value={item.sku} onChange={(e) => updateItem(i, "sku", e.target.value)} className="h-8 text-xs" placeholder="SKU" />
                          ) : (
                            <span className="text-xs font-mono text-primary">{item.sku || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {sourceType === "MANUAL" ? (
                            <Input value={item.product_name} onChange={(e) => updateItem(i, "product_name", e.target.value)} className="h-8 text-xs" placeholder="Name" />
                          ) : (
                            <span className="text-xs">{item.product_name}</span>
                          )}
                        </TableCell>
                        {sourceType !== "MANUAL" && <TableCell className="text-xs text-muted-foreground">{item.qty_ordered}</TableCell>}
                        {sourceType !== "MANUAL" && (
                          <TableCell>
                            {item.qty_already_received > 0 ? (
                              <Badge variant="secondary" className="text-[10px]">{item.qty_already_received}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <Input
                            type="number"
                            value={item.qty_received || ""}
                            onChange={(e) => updateItem(i, "qty_received", Number(e.target.value))}
                            className={`h-8 text-xs ${isOver ? "border-destructive" : ""}`}
                            min={0}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.unit_cost || ""}
                            onChange={(e) => updateItem(i, "unit_cost", Number(e.target.value))}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-sm font-semibold">
                          ৳{(item.qty_received * item.unit_cost).toLocaleString()}
                        </TableCell>
                        {sourceType === "MANUAL" && (
                          <TableCell>
                            {items.length > 1 && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(i)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-muted-foreground">
                {items.filter((i) => i.qty_received > 0).length} of {items.length} items receiving
              </p>
              <span className="text-sm font-bold">Grand Total: ৳{grandTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Posting info */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">📋 On Post (after creation)</p>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>• <strong>Dr</strong> Inventory Asset — ৳{grandTotal.toLocaleString()}</p>
              <p>• <strong>Cr</strong> Supplier Payable — ৳{grandTotal.toLocaleString()}</p>
              <p>• Stock IN event for each SKU • WAC recalculated • PO received qty updated</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={createGRN.isPending}>
            {createGRN.isPending ? "Creating..." : "Create GRN (Draft)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
