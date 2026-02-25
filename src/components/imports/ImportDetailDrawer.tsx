import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KpiCard } from "@/components/ui/kpi-card";
import { Lock, Save, Plus, DollarSign, Package, Truck, FileText } from "lucide-react";
import { usePurchaseOrders } from "@/hooks/use-purchase-orders";

interface Props {
  shipmentId: string | null;
  onClose: () => void;
}

export default function ImportDetailDrawer({ shipmentId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [linkPOOpen, setLinkPOOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);

  // Fetch shipment
  const { data: shipment, isLoading } = useQuery({
    queryKey: ["import-shipment", shipmentId],
    enabled: !!shipmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_shipments")
        .select("*, suppliers(name), agents(name)")
        .eq("id", shipmentId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Linked POs with items
  const { data: linkedPOs } = useQuery({
    queryKey: ["import-linked-pos", shipmentId],
    enabled: !!shipmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_shipment_pos")
        .select("po_id, purchase_orders(id, po_number, grand_total_bdt, status, purchase_order_items(id, product_id, product_name, quantity, unit_price_cny, products(name, sku)))")
        .eq("import_shipment_id", shipmentId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Existing allocations
  const { data: allocations } = useQuery({
    queryKey: ["import-allocations", shipmentId],
    enabled: !!shipmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landed_cost_allocations")
        .select("*, landed_cost_allocation_lines(*, products:product_id(name, sku))")
        .eq("import_shipment_id", shipmentId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Edit state
  const [costs, setCosts] = useState({
    freight_cost: 0, customs_cost: 0, local_transport: 0, other_charges: 0, status: "in_transit",
  });

  const startEdit = () => {
    if (!shipment) return;
    setCosts({
      freight_cost: shipment.freight_cost || 0,
      customs_cost: shipment.customs_cost || 0,
      local_transport: shipment.local_transport || 0,
      other_charges: shipment.other_charges || 0,
      status: shipment.status,
    });
    setEditing(true);
  };

  const saveCosts = async () => {
    if (!shipmentId) return;
    try {
      await supabase.from("import_shipments").update(costs as any).eq("id", shipmentId);
      queryClient.invalidateQueries({ queryKey: ["import-shipment", shipmentId] });
      queryClient.invalidateQueries({ queryKey: ["import-shipments"] });
      toast({ title: "Costs updated!" });
      setEditing(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // All SKUs from linked POs
  const allSkus = useMemo(() => {
    if (!linkedPOs) return [];
    const items: any[] = [];
    linkedPOs.forEach(lp => {
      const po = lp.purchase_orders as any;
      if (!po?.purchase_order_items) return;
      po.purchase_order_items.forEach((item: any) => {
        items.push({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name || item.products?.name || "Unknown",
          sku: item.products?.sku || "—",
          quantity: item.quantity || 0,
          unit_cost: item.unit_price_cny || 0,
          total_cost: (item.quantity || 0) * (item.unit_price_cny || 0),
          po_number: po.po_number,
        });
      });
    });
    return items;
  }, [linkedPOs]);

  const totalLanded = shipment?.total_landed_cost || 0;
  const isFinalized = shipment?.is_finalized || false;

  return (
    <>
      <Sheet open={!!shipmentId} onOpenChange={v => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {isLoading || !shipment ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-lg">{shipment.import_number}</SheetTitle>
                  <div className="flex gap-2">
                    {isFinalized && <Badge variant="secondary" className="gap-1"><Lock className="w-3 h-3" /> Finalized</Badge>}
                    <Badge className={`text-xs ${
                      shipment.status === "received" ? "bg-success/10 text-success" :
                      shipment.status === "cleared" ? "bg-purple-100 text-purple-700" :
                      shipment.status === "arrived" ? "bg-warning/10 text-warning" :
                      "bg-info/10 text-info"
                    }`}>{shipment.status?.toUpperCase()}</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {(shipment.suppliers as any)?.name || (shipment.agents as any)?.name || "No supplier/agent"}
                </p>
              </SheetHeader>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <KpiCard title="Total Landed Cost" value={`৳${totalLanded.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} />
                <KpiCard title="Linked POs" value={String(linkedPOs?.length || 0)} icon={<FileText className="w-5 h-5" />} />
              </div>

              <Tabs defaultValue="costs">
                <TabsList className="w-full">
                  <TabsTrigger value="costs" className="flex-1">Cost Breakdown</TabsTrigger>
                  <TabsTrigger value="pos" className="flex-1">Linked POs</TabsTrigger>
                  <TabsTrigger value="allocation" className="flex-1">Allocation</TabsTrigger>
                </TabsList>

                {/* Cost Breakdown */}
                <TabsContent value="costs" className="mt-3 space-y-3">
                  {editing ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Freight (৳)</label>
                          <Input type="number" value={costs.freight_cost || ""} onChange={e => setCosts(p => ({ ...p, freight_cost: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Customs (৳)</label>
                          <Input type="number" value={costs.customs_cost || ""} onChange={e => setCosts(p => ({ ...p, customs_cost: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Local Transport (৳)</label>
                          <Input type="number" value={costs.local_transport || ""} onChange={e => setCosts(p => ({ ...p, local_transport: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Other (৳)</label>
                          <Input type="number" value={costs.other_charges || ""} onChange={e => setCosts(p => ({ ...p, other_charges: Number(e.target.value) }))} />
                        </div>
                      </div>
                      <Select value={costs.status} onValueChange={v => setCosts(p => ({ ...p, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_transit">In Transit</SelectItem>
                          <SelectItem value="arrived">Arrived</SelectItem>
                          <SelectItem value="cleared">Cleared</SelectItem>
                          <SelectItem value="received">Received</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveCosts} className="gap-1"><Save className="w-3.5 h-3.5" /> Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <CostRow label="Freight" amount={shipment.freight_cost} />
                      <CostRow label="Customs" amount={shipment.customs_cost} />
                      <CostRow label="Local Transport" amount={shipment.local_transport} />
                      <CostRow label="Other Charges" amount={shipment.other_charges} />
                      <Separator />
                      <div className="flex justify-between text-sm font-bold">
                        <span>Total Landed Cost</span>
                        <span>৳{totalLanded.toLocaleString()}</span>
                      </div>
                      {!isFinalized && (
                        <Button size="sm" variant="outline" onClick={startEdit} className="gap-1 mt-2">
                          Edit Costs
                        </Button>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* Linked POs */}
                <TabsContent value="pos" className="mt-3 space-y-3">
                  {!linkedPOs?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No POs linked</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PO #</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linkedPOs.map(lp => {
                          const po = lp.purchase_orders as any;
                          return (
                            <TableRow key={lp.po_id}>
                              <TableCell className="font-mono text-sm font-bold text-primary">{po?.po_number}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">{po?.status}</Badge></TableCell>
                              <TableCell className="text-sm text-right">৳{(po?.grand_total_bdt || 0).toLocaleString()}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                  {!isFinalized && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setLinkPOOpen(true)}>
                      <Plus className="w-3.5 h-3.5" /> Link PO
                    </Button>
                  )}
                </TabsContent>

                {/* Allocation */}
                <TabsContent value="allocation" className="mt-3 space-y-3">
                  {isFinalized ? (
                    <>
                      <Badge variant="secondary" className="gap-1 mb-2"><Lock className="w-3 h-3" /> Landed cost finalized & locked</Badge>
                      {allocations?.map(alloc => (
                        <div key={alloc.id} className="rounded-xl border border-border p-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">Method: {alloc.allocation_method}</span>
                            <span className="font-bold">৳{(alloc.total_landed_cost || 0).toLocaleString()}</span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>SKU</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Allocated Cost</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(alloc.landed_cost_allocation_lines as any[])?.map((line: any) => (
                                <TableRow key={line.id}>
                                  <TableCell className="text-xs font-mono">{line.sku || line.products?.sku || "—"}</TableCell>
                                  <TableCell className="text-xs">{line.products?.name || "—"}</TableCell>
                                  <TableCell className="text-xs text-right">{line.qty_received}</TableCell>
                                  <TableCell className="text-xs text-right font-medium">৳{(line.allocated_cost || 0).toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Allocate ৳{totalLanded.toLocaleString()} across {allSkus.length} SKUs from linked POs.
                      </p>
                      {allSkus.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Link POs first to see SKUs</p>
                      ) : (
                        <Button className="gap-1.5" onClick={() => setAllocateOpen(true)}>
                          <Package className="w-4 h-4" /> Allocate Landed Cost
                        </Button>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Link PO Modal */}
      <LinkPOModal
        open={linkPOOpen}
        onOpenChange={setLinkPOOpen}
        shipmentId={shipmentId}
        existingPoIds={(linkedPOs || []).map(lp => lp.po_id)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["import-linked-pos", shipmentId] });
        }}
      />

      {/* Allocation Modal */}
      <AllocationModal
        open={allocateOpen}
        onOpenChange={setAllocateOpen}
        shipmentId={shipmentId}
        totalLanded={totalLanded}
        skus={allSkus}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["import-allocations", shipmentId] });
          queryClient.invalidateQueries({ queryKey: ["import-shipment", shipmentId] });
          queryClient.invalidateQueries({ queryKey: ["import-shipments"] });
        }}
      />
    </>
  );
}

function CostRow({ label, amount }: { label: string; amount: number | null }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">৳{(amount || 0).toLocaleString()}</span>
    </div>
  );
}

// ─── Link PO Modal ───
function LinkPOModal({ open, onOpenChange, shipmentId, existingPoIds, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  shipmentId: string | null; existingPoIds: string[];
  onSuccess: () => void;
}) {
  const { data: allPOs } = usePurchaseOrders();
  const [selectedPO, setSelectedPO] = useState("");

  const availablePOs = allPOs?.filter(po => !existingPoIds.includes(po.id)) || [];

  const handleLink = async () => {
    if (!selectedPO || !shipmentId) return;
    try {
      await supabase.from("import_shipment_pos").insert({
        import_shipment_id: shipmentId,
        po_id: selectedPO,
      } as any);
      toast({ title: "PO linked!" });
      onSuccess();
      onOpenChange(false);
      setSelectedPO("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Link Purchase Order</DialogTitle></DialogHeader>
        <Select value={selectedPO} onValueChange={setSelectedPO}>
          <SelectTrigger><SelectValue placeholder="Select PO..." /></SelectTrigger>
          <SelectContent>
            {availablePOs.map(po => (
              <SelectItem key={po.id} value={po.id}>
                {po.po_number} — {(po.suppliers as any)?.name || (po.agents as any)?.name || ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleLink} disabled={!selectedPO}>Link PO</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Allocation Modal ───
function AllocationModal({ open, onOpenChange, shipmentId, totalLanded, skus, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  shipmentId: string | null; totalLanded: number;
  skus: any[]; onSuccess: () => void;
}) {
  const [method, setMethod] = useState("BY_QTY");
  const [saving, setSaving] = useState(false);

  // Calculate allocation per SKU
  const allocatedSkus = useMemo(() => {
    const totalQty = skus.reduce((s, sk) => s + sk.quantity, 0);
    const totalCost = skus.reduce((s, sk) => s + sk.total_cost, 0);

    return skus.map(sk => {
      let share = 0;
      if (method === "BY_QTY" && totalQty > 0) {
        share = sk.quantity / totalQty;
      } else if (method === "BY_VALUE" && totalCost > 0) {
        share = sk.total_cost / totalCost;
      }
      return {
        ...sk,
        share: Math.round(share * 10000) / 100, // percentage
        allocated_cost: Math.round(totalLanded * share),
      };
    });
  }, [skus, method, totalLanded]);

  const handleFinalize = async () => {
    if (!shipmentId) return;
    setSaving(true);
    try {
      // Create allocation header
      const { data: alloc, error: allocErr } = await supabase
        .from("landed_cost_allocations")
        .insert({
          import_shipment_id: shipmentId,
          allocation_method: method,
          total_landed_cost: totalLanded,
          status: "posted",
          posted_at: new Date().toISOString(),
        } as any)
        .select("id")
        .single();
      if (allocErr) throw allocErr;

      // Create allocation lines
      const lines = allocatedSkus
        .filter(sk => sk.product_id && sk.allocated_cost > 0)
        .map(sk => ({
          allocation_id: alloc!.id,
          product_id: sk.product_id,
          sku: sk.sku,
          qty_received: sk.quantity,
          base_value: sk.total_cost,
          allocated_cost: sk.allocated_cost,
        }));

      if (lines.length > 0) {
        const { error: lineErr } = await supabase
          .from("landed_cost_allocation_lines")
          .insert(lines);
        if (lineErr) throw lineErr;
      }

      // Update SKU avg cost (landed_cost_bdt on products)
      for (const sk of allocatedSkus) {
        if (!sk.product_id || sk.allocated_cost <= 0) continue;
        const { data: prod } = await supabase
          .from("products")
          .select("landed_cost_bdt, stock_quantity")
          .eq("id", sk.product_id)
          .single();
        if (prod) {
          const currentLanded = prod.landed_cost_bdt || 0;
          const costPerUnit = sk.quantity > 0 ? sk.allocated_cost / sk.quantity : 0;
          await supabase.from("products").update({
            landed_cost_bdt: currentLanded + costPerUnit,
          }).eq("id", sk.product_id);
        }
      }

      // Mark shipment as finalized
      await supabase.from("import_shipments").update({
        is_finalized: true,
        finalized_at: new Date().toISOString(),
      } as any).eq("id", shipmentId);

      toast({ title: "Landed cost allocated & finalized! SKU costs updated." });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allocate Landed Cost — ৳{totalLanded.toLocaleString()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Allocation Method</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BY_QTY">By Quantity</SelectItem>
                <SelectItem value="BY_VALUE">By Cost Share</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>PO</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Share %</TableHead>
                <TableHead className="text-right">Allocated (৳)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocatedSkus.map((sk, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-mono">{sk.sku}</TableCell>
                  <TableCell className="text-xs">{sk.product_name}</TableCell>
                  <TableCell className="text-xs">{sk.po_number}</TableCell>
                  <TableCell className="text-xs text-right">{sk.quantity}</TableCell>
                  <TableCell className="text-xs text-right">¥{sk.unit_cost}</TableCell>
                  <TableCell className="text-xs text-right">{sk.share}%</TableCell>
                  <TableCell className="text-xs text-right font-semibold">৳{sk.allocated_cost.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="rounded-xl bg-primary/5 p-3 flex justify-between text-sm font-bold">
            <span>Total Allocated</span>
            <span>৳{allocatedSkus.reduce((s, sk) => s + sk.allocated_cost, 0).toLocaleString()}</span>
          </div>

          <p className="text-xs text-muted-foreground">
            ⚠️ Finalizing will update SKU average costs and lock the cost breakdown. This cannot be undone.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleFinalize} disabled={saving} className="gap-1.5">
            <Lock className="w-4 h-4" /> {saving ? "Finalizing..." : "Finalize Landed Cost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
