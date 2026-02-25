import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDateTime } from "@/lib/format";
import { ConfirmCriticalAction } from "@/components/security/ConfirmCriticalAction";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, Search, Shield, User, DollarSign, Truck,
  RefreshCw, Package, FileText, ArrowLeftRight, Loader2,
  CheckCircle2, XCircle, History, Wrench, RotateCcw,
} from "lucide-react";

/* ── Audit helper ── */
async function auditLog(
  entityType: string, entityId: string, action: string,
  before: any, after: any, reason: string
) {
  await supabase.from("audit_logs").insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    before_json: before,
    after_json: after,
    reason,
  });
}

/* ── Diff Row ── */
function DiffRow({ label, before, after }: { label: string; before: any; after: any }) {
  const changed = String(before ?? "") !== String(after ?? "");
  return (
    <div className={`grid grid-cols-3 text-xs py-1.5 px-2 rounded ${changed ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}>
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className={changed ? "line-through text-destructive" : "text-muted-foreground"}>{String(before ?? "—")}</span>
      <span className={changed ? "font-semibold text-emerald-600" : "text-muted-foreground"}>{String(after ?? "—")}</span>
    </div>
  );
}

/* ── Main page ── */
export default function SuperEdit() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("customer");

  // Confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    title: string; description: string; confirmLabel: string;
    onConfirm: (reason: string) => Promise<void>;
  } | null>(null);
  const [actionPending, setActionPending] = useState(false);

  // Edit state
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [itemEdits, setItemEdits] = useState<any[]>([]);

  // ── Search orders ──
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["super-edit-search", searchQuery],
    enabled: searchQuery.length >= 3,
    queryFn: async () => {
      const q = searchQuery.trim();
      const like = `%${q}%`;
      const { data, error } = await supabase
        .from("orders")
        .select("id, invoice_id, order_number, status, total_amount, customers(full_name, phone)")
        .or(`invoice_id.ilike.${like},order_number.ilike.${like},pathao_tracking_code.ilike.${like},legacy_tracking_id.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5_000,
  });

  // ── Load full order ──
  const { data: order, isLoading: loadingOrder, refetch: refetchOrder } = useQuery({
    queryKey: ["super-edit-order", selectedOrderId],
    enabled: !!selectedOrderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`*, customers(*), order_items(*, products(id, name, sku, stock_quantity, cost_price, selling_price))`)
        .eq("id", selectedOrderId!)
        .single();
      if (error) throw error;
      // Load shipment too
      const { data: shipment } = await supabase
        .from("courier_shipments")
        .select("*, couriers(name)")
        .eq("order_id", selectedOrderId!)
        .maybeSingle();
      // Load journals
      const { data: journals } = await supabase
        .from("journal_entries")
        .select("id, entry_date, description, status, reference_type")
        .eq("reference_id", selectedOrderId!)
        .order("created_at", { ascending: false });
      return { ...data, _shipment: shipment, _journals: journals || [] };
    },
  });

  // Reset edits when order changes
  const selectOrder = useCallback((id: string) => {
    setSelectedOrderId(id);
    setEdits({});
    setItemEdits([]);
    setActiveTab("customer");
  }, []);

  const setEdit = (key: string, value: any) => setEdits((p) => ({ ...p, [key]: value }));
  const getVal = (key: string) => edits[key] !== undefined ? edits[key] : (order as any)?.[key];
  const getCustomerVal = (key: string) => edits[`c_${key}`] !== undefined ? edits[`c_${key}`] : (order as any)?.customers?.[key];

  // ── Confirm wrapper ──
  const requestConfirm = (title: string, description: string, confirmLabel: string, fn: (reason: string) => Promise<void>) => {
    setPendingAction({ title, description, confirmLabel, onConfirm: fn });
    setConfirmOpen(true);
  };

  const handleConfirm = async (reason: string) => {
    if (!pendingAction) return;
    setActionPending(true);
    try {
      await pendingAction.onConfirm(reason);
      toast({ title: "✅ Action completed" });
      refetchOrder();
    } catch (e: any) {
      toast({ title: "❌ Failed", description: e.message, variant: "destructive" });
    } finally {
      setActionPending(false);
      setConfirmOpen(false);
      setPendingAction(null);
    }
  };

  // ── Save Customer Info ──
  const saveCustomerInfo = () => {
    requestConfirm("Update Customer Info", "This will update the customer record linked to this order.", "Save Changes", async (reason) => {
      const cust = (order as any)?.customers;
      const updates: any = {};
      const before: any = {};
      for (const key of ["full_name", "phone", "address", "district", "thana"]) {
        const edited = edits[`c_${key}`];
        if (edited !== undefined && edited !== cust?.[key]) {
          updates[key] = edited;
          before[key] = cust?.[key];
        }
      }
      if (Object.keys(updates).length === 0) throw new Error("No changes detected");
      const { error } = await supabase.from("customers").update(updates).eq("id", cust.id);
      if (error) throw error;
      await auditLog("customer", cust.id, "super_edit_customer", before, updates, reason);
      // Also update order-level address fields
      const orderUpdates: any = {};
      if (updates.district) orderUpdates.delivery_district = updates.district;
      if (updates.thana) orderUpdates.delivery_thana = updates.thana;
      if (updates.address) orderUpdates.delivery_address = updates.address;
      if (Object.keys(orderUpdates).length > 0) {
        await supabase.from("orders").update(orderUpdates).eq("id", order!.id);
      }
    });
  };

  // ── Save Financials ──
  const saveFinancials = () => {
    requestConfirm("Update Order Financials", "Changing financial fields may affect accounting. A correction event will be logged.", "Save Financial Changes", async (reason) => {
      const updates: any = {};
      const before: any = {};
      for (const key of ["total_amount", "advance_amount", "advance_method", "delivery_charge", "discount"]) {
        const edited = edits[key];
        if (edited !== undefined && edited !== (order as any)?.[key]) {
          updates[key] = key === "advance_method" ? edited : Number(edited);
          before[key] = (order as any)?.[key];
        }
      }
      if (Object.keys(updates).length === 0) throw new Error("No changes detected");
      const { error } = await supabase.from("orders").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", order!.id);
      if (error) throw error;
      await auditLog("order", order!.id, "super_edit_financials", before, updates, reason);
    });
  };

  // ── Save Courier ──
  const saveCourier = () => {
    requestConfirm("Update Courier Fields", "Manual courier overrides will be logged as MANUAL_OVERRIDE.", "Save Courier Changes", async (reason) => {
      const shipment = (order as any)?._shipment;
      const updates: any = {};
      const before: any = {};
      if (edits.tracking_id !== undefined) {
        // Update on order level
        await supabase.from("orders").update({ pathao_tracking_code: edits.tracking_id, updated_at: new Date().toISOString() }).eq("id", order!.id);
        before.tracking_id = order!.pathao_tracking_code;
        updates.tracking_id = edits.tracking_id;
      }
      if (shipment) {
        for (const key of ["courier_delivery_fee", "courier_cod_fee", "courier_discount", "courier_return_cost"]) {
          if (edits[`s_${key}`] !== undefined && Number(edits[`s_${key}`]) !== shipment[key]) {
            updates[key] = Number(edits[`s_${key}`]);
            before[key] = shipment[key];
          }
        }
        if (Object.keys(before).length > 1 || (Object.keys(before).length === 1 && !before.tracking_id)) {
          const shipUpdates: any = {};
          for (const k of Object.keys(updates)) {
            if (k !== "tracking_id") shipUpdates[k] = updates[k];
          }
          if (Object.keys(shipUpdates).length > 0) {
            await supabase.from("courier_shipments").update({ ...shipUpdates, updated_at: new Date().toISOString() }).eq("id", shipment.id);
          }
        }
      }
      if (Object.keys(updates).length === 0) throw new Error("No changes detected");
      await auditLog("order", order!.id, "super_edit_courier", before, updates, reason);
    });
  };

  // ── Status Correction ──
  const saveStatus = () => {
    const newStatus = edits.status;
    if (!newStatus || newStatus === order!.status) { toast({ title: "No change", variant: "destructive" }); return; }
    requestConfirm("Status Correction", `Change ERP status from "${order!.status}" to "${newStatus}". This bypasses normal workflow validation.`, "Force Status Change", async (reason) => {
      const before = { status: order!.status };
      const { error } = await supabase.from("orders").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", order!.id);
      if (error) throw error;
      await auditLog("order", order!.id, "super_edit_status", before, { status: newStatus }, reason);
    });
  };

  // ── Repair: Recalculate Net Payable ──
  const repairNetPayable = () => {
    requestConfirm("Recalculate Net Payable", "This will recompute courier_net_payable from customer_total and courier charges for this shipment.", "Recalculate", async (reason) => {
      const s = (order as any)?._shipment;
      if (!s) throw new Error("No shipment found");
      const netPayable = Math.max(0,
        (order!.total_amount || 0) -
        ((s.courier_delivery_fee || 0) + (s.courier_cod_fee || 0) - (s.courier_discount || 0) + (s.courier_return_cost || 0))
      );
      const before = { courier_net_payable: s.courier_net_payable };
      await supabase.from("courier_shipments").update({ courier_net_payable: netPayable, updated_at: new Date().toISOString() }).eq("id", s.id);
      await auditLog("courier_shipment", s.id, "repair_net_payable", before, { courier_net_payable: netPayable }, reason);
    });
  };

  // ── Repair: Rebuild Accounting ──
  const repairAccounting = () => {
    const journals = (order as any)?._journals || [];
    const posted = journals.filter((j: any) => j.status === "posted");
    requestConfirm(
      "Rebuild Accounting",
      `This will reverse ${posted.length} posted journal(s) linked to this order. You must then re-trigger posting from the Posting Queue.`,
      "Reverse & Rebuild",
      async (reason) => {
        for (const j of posted) {
          const { error } = await supabase.rpc("reverse_journal_entry", { p_journal_id: j.id, p_reason: `Super Edit rebuild: ${reason}` });
          if (error) throw error;
        }
        await auditLog("order", order!.id, "repair_accounting", { reversed_journals: posted.map((j: any) => j.id) }, {}, reason);
      }
    );
  };

  // ── Repair: Mark Exception ──
  const markException = () => {
    requestConfirm("Create Exception", "Push this order to the Exceptions Center for review.", "Create Exception", async (reason) => {
      await supabase.from("order_exceptions" as any).insert({
        order_id: order!.id,
        exception_type: "manual_flag",
        severity: "high",
        description: reason,
      });
      await auditLog("order", order!.id, "create_exception", {}, { type: "manual_flag" }, reason);
    });
  };

  // ── Computed diffs ──
  const diffs = useMemo(() => {
    if (!order) return [];
    const items: { label: string; before: any; after: any }[] = [];
    // Customer
    for (const k of ["full_name", "phone", "address", "district", "thana"]) {
      if (edits[`c_${k}`] !== undefined) {
        items.push({ label: `Customer ${k}`, before: (order as any).customers?.[k], after: edits[`c_${k}`] });
      }
    }
    // Order fields
    for (const k of ["total_amount", "advance_amount", "advance_method", "delivery_charge", "discount", "status"]) {
      if (edits[k] !== undefined && String(edits[k]) !== String((order as any)[k] ?? "")) {
        items.push({ label: k, before: (order as any)[k], after: edits[k] });
      }
    }
    return items;
  }, [order, edits]);

  const STATUSES = ["pending", "packed", "ready_to_ship", "shipped", "in_transit", "delivered", "delivery_failed", "return_requested", "return_in_transit", "returned", "partially_delivered", "exchanged", "completed", "cancelled"];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Danger Banner */}
      <Alert variant="destructive" className="border-destructive bg-destructive/5">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="flex items-center gap-2">
          <Shield className="w-4 h-4" /> Danger Zone — Super Edit Console
        </AlertTitle>
        <AlertDescription>
          All changes are permanently audited. Incorrect edits can affect financial reports, stock levels, and courier settlements. Admin access only.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── Left: Search + Select ── */}
        <div className="lg:col-span-3 space-y-3">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Search className="w-4 h-4" /> Find Order</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              <Input
                placeholder="Invoice, tracking, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 text-xs"
              />
              {searching && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Searching...</div>}
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {(searchResults || []).map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => selectOrder(r.id)}
                    className={`w-full text-left p-2 rounded-lg border text-xs transition-colors hover:bg-accent ${selectedOrderId === r.id ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <div className="font-mono font-semibold">{r.invoice_id || r.order_number || r.id.slice(0, 8)}</div>
                    <div className="text-muted-foreground">{(r.customers as any)?.full_name} • {(r.customers as any)?.phone}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] h-4">{r.status}</Badge>
                      <span className="font-semibold">{formatBDT(r.total_amount)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Repair Tools */}
          {order && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Wrench className="w-4 h-4" /> Repair Tools</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-1.5">
                <Button variant="outline" size="sm" className="w-full justify-start text-xs gap-2 h-8" onClick={repairNetPayable}>
                  <RefreshCw className="w-3 h-3" /> Recalculate Net Payable
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs gap-2 h-8" onClick={repairAccounting}>
                  <RotateCcw className="w-3 h-3" /> Rebuild Accounting
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs gap-2 h-8" onClick={markException}>
                  <AlertTriangle className="w-3 h-3" /> Mark as Exception
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Center: Edit Panel ── */}
        <div className="lg:col-span-6">
          {!order && !loadingOrder && (
            <Card className="p-12 text-center text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Search and select an order to begin editing</p>
            </Card>
          )}
          {loadingOrder && (
            <Card className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></Card>
          )}
          {order && (
            <Card>
              <CardHeader className="p-3 pb-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {order.invoice_id || order.order_number || order.id.slice(0, 8)}
                  </CardTitle>
                  <Badge variant="outline">{order.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-2">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full grid grid-cols-4 h-8">
                    <TabsTrigger value="customer" className="text-xs gap-1"><User className="w-3 h-3" /> Customer</TabsTrigger>
                    <TabsTrigger value="financials" className="text-xs gap-1"><DollarSign className="w-3 h-3" /> Financials</TabsTrigger>
                    <TabsTrigger value="courier" className="text-xs gap-1"><Truck className="w-3 h-3" /> Courier</TabsTrigger>
                    <TabsTrigger value="status" className="text-xs gap-1"><ArrowLeftRight className="w-3 h-3" /> Status</TabsTrigger>
                  </TabsList>

                  {/* ── Customer Tab ── */}
                  <TabsContent value="customer" className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Full Name</Label>
                        <Input className="h-8 text-xs mt-1" value={getCustomerVal("full_name") || ""} onChange={(e) => setEdit("c_full_name", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Phone</Label>
                        <Input className="h-8 text-xs mt-1" value={getCustomerVal("phone") || ""} onChange={(e) => setEdit("c_phone", e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Address</Label>
                      <Textarea className="text-xs mt-1" rows={2} value={getCustomerVal("address") || ""} onChange={(e) => setEdit("c_address", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">District</Label>
                        <Input className="h-8 text-xs mt-1" value={getCustomerVal("district") || ""} onChange={(e) => setEdit("c_district", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Thana</Label>
                        <Input className="h-8 text-xs mt-1" value={getCustomerVal("thana") || ""} onChange={(e) => setEdit("c_thana", e.target.value)} />
                      </div>
                    </div>
                    <Button size="sm" className="gap-1.5" onClick={saveCustomerInfo}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Save Customer Info
                    </Button>
                  </TabsContent>

                  {/* ── Financials Tab ── */}
                  <TabsContent value="financials" className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Customer Total</Label>
                        <Input className="h-8 text-xs mt-1" type="number" value={getVal("total_amount") ?? ""} onChange={(e) => setEdit("total_amount", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Delivery Charge</Label>
                        <Input className="h-8 text-xs mt-1" type="number" value={getVal("delivery_charge") ?? ""} onChange={(e) => setEdit("delivery_charge", e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Advance Amount</Label>
                        <Input className="h-8 text-xs mt-1" type="number" value={getVal("advance_amount") ?? ""} onChange={(e) => setEdit("advance_amount", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Advance Method</Label>
                        <Select value={getVal("advance_method") || ""} onValueChange={(v) => setEdit("advance_method", v)}>
                          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Method" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BKASH">bKash</SelectItem>
                            <SelectItem value="NAGAD">Nagad</SelectItem>
                            <SelectItem value="BANK">Bank</SelectItem>
                            <SelectItem value="CASH">Cash</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Discount</Label>
                        <Input className="h-8 text-xs mt-1" type="number" value={getVal("discount") ?? ""} onChange={(e) => setEdit("discount", e.target.value)} />
                      </div>
                    </div>
                    <Button size="sm" className="gap-1.5" onClick={saveFinancials}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Save Financial Changes
                    </Button>
                  </TabsContent>

                  {/* ── Courier Tab ── */}
                  <TabsContent value="courier" className="space-y-3 mt-3">
                    {(() => {
                      const s = (order as any)?._shipment;
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Tracking ID</Label>
                              <Input className="h-8 text-xs mt-1 font-mono" value={edits.tracking_id ?? order.pathao_tracking_code ?? ""} onChange={(e) => setEdit("tracking_id", e.target.value)} />
                            </div>
                            <div>
                              <Label className="text-xs">Courier</Label>
                              <Input className="h-8 text-xs mt-1" value={s?.couriers?.name || "—"} disabled />
                            </div>
                          </div>
                          {s && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Delivery Fee</Label>
                                <Input className="h-8 text-xs mt-1" type="number" value={edits.s_courier_delivery_fee ?? s.courier_delivery_fee ?? ""} onChange={(e) => setEdit("s_courier_delivery_fee", e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">COD Fee</Label>
                                <Input className="h-8 text-xs mt-1" type="number" value={edits.s_courier_cod_fee ?? s.courier_cod_fee ?? ""} onChange={(e) => setEdit("s_courier_cod_fee", e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Discount</Label>
                                <Input className="h-8 text-xs mt-1" type="number" value={edits.s_courier_discount ?? s.courier_discount ?? ""} onChange={(e) => setEdit("s_courier_discount", e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Return Cost</Label>
                                <Input className="h-8 text-xs mt-1" type="number" value={edits.s_courier_return_cost ?? s.courier_return_cost ?? ""} onChange={(e) => setEdit("s_courier_return_cost", e.target.value)} />
                              </div>
                            </div>
                          )}
                          {!s && <p className="text-xs text-muted-foreground">No courier shipment linked to this order.</p>}
                          <Button size="sm" className="gap-1.5" onClick={saveCourier}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Save Courier Changes
                          </Button>
                        </>
                      );
                    })()}
                  </TabsContent>

                  {/* ── Status Tab ── */}
                  <TabsContent value="status" className="space-y-3 mt-3">
                    <div>
                      <Label className="text-xs">Current ERP Status</Label>
                      <div className="mt-1"><Badge variant="outline" className="text-xs">{order.status}</Badge></div>
                    </div>
                    <div>
                      <Label className="text-xs">New Status</Label>
                      <Select value={edits.status || ""} onValueChange={(v) => setEdit("status", v)}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select new status" /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s} disabled={s === order.status}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                        Force-changing status bypasses workflow validation triggers. Stock movements and journals will NOT be auto-created.
                      </AlertDescription>
                    </Alert>
                    <Button size="sm" variant="destructive" className="gap-1.5" onClick={saveStatus} disabled={!edits.status || edits.status === order.status}>
                      <AlertTriangle className="w-3.5 h-3.5" /> Force Status Change
                    </Button>
                  </TabsContent>
                </Tabs>

                {/* ── Items Overview ── */}
                <Separator className="my-3" />
                <div>
                  <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-2"><Package className="w-3.5 h-3.5" /> Order Items</h4>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">SKU</th>
                          <th className="text-left p-2">Product</th>
                          <th className="text-right p-2">Qty</th>
                          <th className="text-right p-2">Price</th>
                          <th className="text-right p-2">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {((order as any).order_items || []).map((item: any) => (
                          <tr key={item.id} className="border-t">
                            <td className="p-2 font-mono">{item.products?.sku || "—"}</td>
                            <td className="p-2">{item.products?.name || "—"}</td>
                            <td className="p-2 text-right">{item.quantity}</td>
                            <td className="p-2 text-right">{formatBDT(item.unit_price)}</td>
                            <td className="p-2 text-right">
                              <span className={`font-semibold ${(item.products?.stock_quantity || 0) < 0 ? "text-destructive" : ""}`}>
                                {item.products?.stock_quantity ?? "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Linked Journals ── */}
                {(order as any)._journals?.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <div>
                      <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-2"><History className="w-3.5 h-3.5" /> Linked Journals</h4>
                      <div className="space-y-1">
                        {(order as any)._journals.map((j: any) => (
                          <div key={j.id} className="flex items-center justify-between text-xs p-1.5 rounded border">
                            <div>
                              <span className="font-mono text-[10px]">{j.id.slice(0, 8)}</span>
                              <span className="ml-2 text-muted-foreground">{j.description?.slice(0, 50)}</span>
                            </div>
                            <Badge variant={j.status === "posted" ? "default" : j.status === "reversed" ? "secondary" : "outline"} className="text-[10px] h-4">
                              {j.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right: Diff Panel ── */}
        <div className="lg:col-span-3">
          <Card className="sticky top-4">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" /> Change Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {diffs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No pending changes</p>
              ) : (
                <div className="space-y-0.5">
                  <div className="grid grid-cols-3 text-[10px] font-semibold text-muted-foreground pb-1 px-2 uppercase tracking-wider">
                    <span>Field</span><span>Before</span><span>After</span>
                  </div>
                  {diffs.map((d, i) => (
                    <DiffRow key={i} label={d.label} before={d.before} after={d.after} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmCriticalAction
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={pendingAction?.title || ""}
        description={pendingAction?.description || ""}
        confirmLabel={pendingAction?.confirmLabel || "Confirm"}
        destructive
        requireReason
        onConfirm={handleConfirm}
        isPending={actionPending}
      />
    </div>
  );
}
