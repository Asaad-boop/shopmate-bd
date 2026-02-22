import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ClipboardList, Ship, Package, Clock, Wallet,
  Plus, Download, Printer, AlertTriangle,
} from "lucide-react";
import { differenceInDays, formatDistanceToNow } from "date-fns";

// ─── Status config ───
const statusIcons: Record<string, { emoji: string; bg: string; label: string }> = {
  draft: { emoji: "📋", bg: "bg-muted", label: "Draft" },
  ordered: { emoji: "📦", bg: "bg-primary/10", label: "Ordered" },
  shipped: { emoji: "🚢", bg: "bg-info/10", label: "In Transit" },
  in_transit: { emoji: "🚢", bg: "bg-info/10", label: "In Transit" },
  customs: { emoji: "🛃", bg: "bg-warning/10", label: "Customs" },
  arrived_bd: { emoji: "📍", bg: "bg-success/10", label: "Arrived in BD" },
  received: { emoji: "✅", bg: "bg-success/10", label: "Received" },
};

const statusPillClass: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  ordered: "bg-primary/10 text-primary",
  shipped: "bg-info/10 text-info",
  in_transit: "bg-info/10 text-info",
  customs: "bg-warning/10 text-warning",
  arrived_bd: "bg-success/10 text-success",
  received: "bg-success/10 text-success",
};

function getEtaInfo(arrivalDate: string | null) {
  if (!arrivalDate) return { label: "No ETA", color: "text-muted-foreground", days: null };
  const days = differenceInDays(new Date(arrivalDate), new Date());
  if (days < 0) return { label: `⚠️ Overdue ${Math.abs(days)}d`, color: "text-destructive", days };
  if (days === 0) return { label: "✅ Arriving today", color: "text-success", days };
  if (days <= 3) return { label: `⏰ ${days}d left`, color: "text-destructive", days };
  if (days <= 7) return { label: `⏰ ${days}d left`, color: "text-warning", days };
  return { label: `⏰ ${days}d left`, color: "text-success", days };
}

// ─── Hooks ───
function useImportStats() {
  return useQuery({
    queryKey: ["import-dashboard-stats"],
    queryFn: async () => {
      const { data: pos, error } = await supabase
        .from("purchase_orders")
        .select("id, status, grand_total_bdt, remaining_payment_bdt, total_landed_cost_bdt");
      if (error) throw error;

      const { data: items } = await supabase
        .from("purchase_order_items")
        .select("quantity, purchase_order_id");

      const activePoIds = new Set(pos?.filter(p => p.status !== "received").map(p => p.id) || []);
      const upcomingPcs = items?.filter(i => activePoIds.has(i.purchase_order_id!)).reduce((s, i) => s + (i.quantity || 0), 0) || 0;

      return {
        total: pos?.length || 0,
        inTransit: pos?.filter(p => p.status === "shipped" || p.status === "in_transit").length || 0,
        upcomingPcs,
        pendingPayment: pos?.filter(p => (p.remaining_payment_bdt || 0) > 0).reduce((s, p) => s + (p.remaining_payment_bdt || 0), 0) || 0,
        totalInvested: pos?.reduce((s, p) => s + (p.total_landed_cost_bdt || p.grand_total_bdt || 0), 0) || 0,
        activePOs: pos?.filter(p => p.status !== "received" && p.status !== "draft").length || 0,
      };
    },
  });
}

function useUpcomingShipments() {
  return useQuery({
    queryKey: ["import-dashboard-shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name), agents(name), purchase_order_items(quantity)")
        .neq("status", "received")
        .order("expected_arrival_date", { ascending: true });
      if (error) throw error;
      return data?.map(po => ({
        ...po,
        totalQty: (po.purchase_order_items as any[])?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0,
      })) || [];
    },
  });
}

function useUpcomingProducts() {
  return useQuery({
    queryKey: ["import-dashboard-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("*, products(name, sku, image_url), purchase_orders!inner(po_number, expected_arrival_date, status, agent_id, supplier_id, agents(name), suppliers(name))")
        .neq("purchase_orders.status", "received")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

function usePaymentsDue() {
  return useQuery({
    queryKey: ["import-dashboard-payments-due"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, po_number, grand_total_bdt, remaining_payment_bdt, advance_paid_bdt, total_landed_cost_bdt, agents(name), suppliers(name)")
        .gt("remaining_payment_bdt", 0);
      if (error) throw error;
      return data || [];
    },
  });
}

function useActivityLog() {
  return useQuery({
    queryKey: ["import-dashboard-activity"],
    queryFn: async () => {
      const [{ data: timeline }, { data: payments }, { data: recentPOs }] = await Promise.all([
        supabase.from("po_timeline").select("*, purchase_orders(po_number)").order("created_at", { ascending: false }).limit(10),
        supabase.from("po_payments").select("*, purchase_orders(po_number)").order("created_at", { ascending: false }).limit(10),
        supabase.from("purchase_orders").select("id, po_number, created_at, status").order("created_at", { ascending: false }).limit(5),
      ]);

      const items: { type: string; text: string; sub: string; time: string; color: string }[] = [];

      timeline?.forEach(t => {
        const poNum = (t.purchase_orders as any)?.po_number || "";
        items.push({
          type: "timeline",
          text: t.note || `Stage ${t.stage} ${t.completed_at ? "completed" : "started"}`,
          sub: poNum,
          time: t.created_at || "",
          color: t.completed_at ? "bg-success" : "bg-info",
        });
      });

      payments?.forEach(p => {
        const poNum = (p.purchase_orders as any)?.po_number || "";
        items.push({
          type: "payment",
          text: `Payment ৳${(p.amount || 0).toLocaleString()} via ${p.payment_method || "—"}`,
          sub: `${poNum} • ${p.payment_type || ""}`,
          time: p.created_at || "",
          color: "bg-success",
        });
      });

      recentPOs?.forEach(po => {
        items.push({
          type: "po",
          text: `New PO Created: ${po.po_number}`,
          sub: `Status: ${po.status}`,
          time: po.created_at || "",
          color: "bg-warning",
        });
      });

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return items.slice(0, 20);
    },
  });
}

// ─── Print Checklist Modal ───
function PrintChecklistModal({
  open,
  onOpenChange,
  selectedPoId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedPoId?: string;
}) {
  const [poId, setPoId] = useState(selectedPoId || "");
  const [checkedRows, setCheckedRows] = useState<Set<string>>(new Set());
  const [receivedQty, setReceivedQty] = useState<Record<string, number>>({});
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: activePOs } = useQuery({
    queryKey: ["print-checklist-pos"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, agents(name), suppliers(name), purchase_order_items(quantity)")
        .neq("status", "received")
        .order("created_at", { ascending: false });
      return data?.map(po => ({
        ...po,
        totalQty: (po.purchase_order_items as any[])?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0,
      })) || [];
    },
  });

  const currentPoId = poId || selectedPoId || activePOs?.[0]?.id || "";

  const { data: poDetail } = useQuery({
    queryKey: ["print-checklist-detail", currentPoId],
    enabled: open && !!currentPoId,
    queryFn: async () => {
      const { data: po } = await supabase
        .from("purchase_orders")
        .select("*, agents(name), suppliers(name)")
        .eq("id", currentPoId)
        .single();

      const { data: items } = await supabase
        .from("purchase_order_items")
        .select("*, products(name, sku, image_url)")
        .eq("purchase_order_id", currentPoId)
        .order("created_at", { ascending: true });

      return { po, items: items || [] };
    },
  });

  const po = poDetail?.po;
  const items = poDetail?.items || [];
  const totalExpected = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalValue = items.reduce((s, i) => s + ((i.unit_price_cny || 0) * (i.quantity || 0)), 0);
  const agentName = (po?.agents as any)?.name || (po?.suppliers as any)?.name || "—";

  const toggleCheck = (id: string) => {
    setCheckedRows(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handlePrint = () => window.print();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] max-h-[85vh] overflow-y-auto p-0 print-modal-content">
        <DialogHeader className="px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold">🖨️ Print Receiving Checklist</DialogTitle>
            <Button size="sm" className="gap-1.5 no-print" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Print
            </Button>
          </div>
        </DialogHeader>

        {/* PO Selector */}
        <div className="px-6 pb-3 no-print">
          <Select value={currentPoId} onValueChange={setPoId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select PO..." />
            </SelectTrigger>
            <SelectContent>
              {activePOs?.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.po_number} — {(p.agents as any)?.name || (p.suppliers as any)?.name || "—"} ({p.totalQty} pcs)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Print Sheet */}
        <div id="print-sheet" className="print-sheet">
          {/* Sheet Header */}
          <div className="bg-gradient-to-r from-[hsl(222,47%,16%)] to-[hsl(244,60%,30%)] text-white p-5 print-header" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
            <h2 className="text-lg font-bold mb-1">📦 Receiving Checklist — {po?.po_number || "..."}</h2>
            <p className="text-sm opacity-80 mb-3">{agentName} • Check each item upon receiving</p>
            <div className="grid grid-cols-5 gap-2 text-xs">
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="opacity-70">Products</p>
                <p className="font-bold text-base">{items.length}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="opacity-70">Total Qty</p>
                <p className="font-bold text-base">{totalExpected}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="opacity-70">Value</p>
                <p className="font-bold text-base">{formatBDT(totalValue)}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="opacity-70">ETA</p>
                <p className="font-bold text-base">{po?.expected_arrival_date || "—"}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-2 text-center">
                <p className="opacity-70">Printed</p>
                <p className="font-bold text-base">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</p>
              </div>
            </div>
          </div>

          {/* Checklist Table */}
          <div className="p-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground/10">
                  <th className="w-8 py-2 text-left">✓</th>
                  <th className="py-2 text-left">Product</th>
                  <th className="w-20 py-2 text-center">Expected</th>
                  <th className="w-20 py-2 text-center">Received</th>
                  <th className="w-24 py-2 text-center">Condition</th>
                  <th className="w-28 py-2 text-left">Note</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const product = item.products as any;
                  const isChecked = checkedRows.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-border/50 transition-colors ${isChecked ? "bg-success/5" : ""}`}
                    >
                      <td className="py-2">
                        <button
                          onClick={() => toggleCheck(item.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs transition-all ${
                            isChecked
                              ? "bg-success border-success text-success-foreground"
                              : "border-input bg-background"
                          }`}
                        >
                          {isChecked && "✓"}
                        </button>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {product?.image_url ? (
                            <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">📦</div>
                          )}
                          <div>
                            <p className="font-semibold text-foreground text-xs">{product?.name || item.product_name || "—"}</p>
                            <p className="text-[10px] text-primary font-medium">{product?.sku || "—"}</p>
                            {item.variant_note && <p className="text-[10px] text-muted-foreground">{item.variant_note}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 text-center">
                        <span className="text-lg font-bold text-primary">{item.quantity}</span>
                      </td>
                      <td className="py-2 text-center">
                        <Input
                          type="number"
                          className="h-7 w-16 text-center text-xs mx-auto print-input"
                          value={receivedQty[item.id] ?? ""}
                          onChange={(e) => setReceivedQty(p => ({ ...p, [item.id]: Number(e.target.value) }))}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <select
                          className="h-7 text-xs rounded border border-input bg-background px-1 print-input"
                          value={conditions[item.id] || "good"}
                          onChange={(e) => setConditions(p => ({ ...p, [item.id]: e.target.value }))}
                        >
                          <option value="good">✅ Good</option>
                          <option value="damaged">⚠️ Damaged</option>
                          <option value="missing">❌ Missing</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <Input
                          className="h-7 text-xs print-input"
                          value={notes[item.id] || ""}
                          onChange={(e) => setNotes(p => ({ ...p, [item.id]: e.target.value }))}
                          placeholder="Note..."
                        />
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Select a PO to see items</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Sheet Footer */}
          <div className="border-t border-border p-4 flex items-end justify-between">
            <p className="text-sm font-semibold">Total Expected: <span className="text-primary">{totalExpected} pcs</span></p>
            <div className="flex gap-6">
              {["Received By", "Checked By", "Date"].map(label => (
                <div key={label} className="text-center">
                  <div className="w-28 border-b-2 border-foreground/30 mb-1 h-6" />
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───
export default function ImportDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useImportStats();
  const { data: shipments, isLoading: shipmentsLoading } = useUpcomingShipments();
  const { data: products, isLoading: productsLoading } = useUpcomingProducts();
  const { data: paymentsDue, isLoading: paymentsLoading } = usePaymentsDue();
  const { data: activityLog, isLoading: activityLoading } = useActivityLog();
  const [printOpen, setPrintOpen] = useState(false);
  const [printPoId, setPrintPoId] = useState<string | undefined>();

  const openPrintForPO = (poId?: string) => {
    setPrintPoId(poId);
    setPrintOpen(true);
  };

  const statCards = [
    { label: "Total POs", value: stats?.total ?? 0, icon: ClipboardList, iconClass: "text-primary bg-primary/10" },
    { label: "In Transit", value: stats?.inTransit ?? 0, icon: Ship, iconClass: "text-info bg-info/10" },
    { label: "Upcoming Products", value: `${stats?.upcomingPcs ?? 0} pcs`, icon: Package, iconClass: "text-primary bg-primary/10" },
    { label: "Pending Payment", value: formatBDT(stats?.pendingPayment ?? 0), icon: Clock, iconClass: "text-destructive bg-destructive/10" },
    { label: "Total Invested", value: formatBDT(stats?.totalInvested ?? 0), icon: Wallet, iconClass: "text-primary bg-primary/10" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border -mx-6 px-6 py-3 flex items-center justify-between" style={{ height: 54 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">🇨🇳 Import Dashboard</h1>
          <Badge className="bg-primary/10 text-primary text-xs font-semibold">{stats?.activePOs ?? 0} Active POs</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openPrintForPO()}>
            <Printer className="w-4 h-4" /> Print Checklist
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/purchase-orders/new")}>
            <Plus className="w-4 h-4" /> New PO
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className="rounded-2xl bg-card border border-border p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 animate-row-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.iconClass}`}>
                <card.icon className="w-4 h-4" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            </div>
            {statsLoading ? (
              <Skeleton className="h-7 w-20 rounded-lg" />
            ) : (
              <p className="text-xl font-bold text-foreground">{card.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
        {/* Left Column */}
        <div className="space-y-5">
          {/* Upcoming Shipments */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                🚢 Upcoming Shipments
                <Badge variant="secondary" className="text-xs">{shipments?.length ?? 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {shipmentsLoading ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              ) : shipments?.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Ship className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No active shipments</p>
                </div>
              ) : (
                shipments?.map((po, i) => {
                  const st = statusIcons[po.status || "draft"] || statusIcons.draft;
                  const eta = getEtaInfo(po.expected_arrival_date);
                  const agentName = (po.agents as any)?.name || (po.suppliers as any)?.name || "—";
                  const totalValue = po.grand_total_bdt || po.total_landed_cost_bdt || 0;

                  return (
                    <div
                      key={po.id}
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border hover:shadow-md hover:border-primary/20 transition-all cursor-pointer animate-row-in"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${st.bg}`}>
                        {st.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{po.po_number}</span>
                          <span className="text-xs text-muted-foreground truncate">{agentName}</span>
                        </div>
                        <Badge className={`text-[10px] font-semibold mt-0.5 ${statusPillClass[po.status || "draft"] || ""}`}>
                          {st.label}
                        </Badge>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-0.5">
                        <p className={`text-xs font-semibold ${eta.color}`}>{eta.label}</p>
                        <p className="text-xs font-semibold text-foreground">{formatBDT(totalValue)}</p>
                        <p className="text-xs font-bold text-primary">↓ {po.totalQty} pcs</p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Upcoming Products Table */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                📦 Upcoming Products
                <Badge variant="secondary" className="text-xs">{products?.length ?? 0}</Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openPrintForPO()}>
                <Printer className="w-3.5 h-3.5" /> Print Checklist
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {productsLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                </div>
              ) : products?.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No upcoming products</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>PO / Agent</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>ETA</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products?.map((item, i) => {
                        const product = item.products as any;
                        const po = item.purchase_orders as any;
                        const eta = getEtaInfo(po?.expected_arrival_date);
                        const st = statusIcons[po?.status || "draft"] || statusIcons.draft;
                        const agentName = po?.agents?.name || po?.suppliers?.name || "—";
                        const value = (item.unit_price_cny || 0) * (item.quantity || 0);

                        return (
                          <TableRow
                            key={item.id}
                            className="cursor-pointer animate-row-in"
                            style={{ animationDelay: `${i * 30}ms` }}
                            onClick={() => openPrintForPO(po?.id)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {product?.image_url ? (
                                  <img src={product.image_url} alt="" className="w-9 h-9 rounded-lg object-cover border border-border" />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">📦</div>
                                )}
                                <div>
                                  <p className="text-xs font-semibold text-foreground truncate max-w-[140px]">{product?.name || item.product_name || "—"}</p>
                                  <p className="text-[10px] text-primary font-medium">{product?.sku || "—"}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs font-medium">{po?.po_number}</p>
                              <p className="text-[10px] text-muted-foreground">{agentName}</p>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-primary/10 text-primary font-bold">{item.quantity}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold">{formatBDT(value)}</TableCell>
                            <TableCell>
                              <span className={`text-xs font-medium ${eta.color}`}>{eta.label}</span>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] font-semibold ${statusPillClass[po?.status || "draft"] || ""}`}>
                                {st.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Payment Due */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">💰 Payment Due</span>
                {!paymentsLoading && (
                  <span className="text-destructive font-bold text-base">{formatBDT(paymentsDue?.reduce((s, p) => s + (p.remaining_payment_bdt || 0), 0) || 0)}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {paymentsLoading ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              ) : paymentsDue?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">All payments settled! 🎉</p>
                </div>
              ) : (
                paymentsDue?.map((po, i) => {
                  const agentName = (po.agents as any)?.name || (po.suppliers as any)?.name || "—";
                  const total = po.grand_total_bdt || po.total_landed_cost_bdt || 0;
                  const remaining = po.remaining_payment_bdt || 0;
                  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;

                  return (
                    <div
                      key={po.id}
                      className="p-3 rounded-xl border border-border hover:border-warning/30 transition-all animate-row-in"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <p className="text-xs font-semibold text-foreground">{agentName}</p>
                          <p className="text-[10px] text-muted-foreground">{po.po_number}</p>
                        </div>
                        <p className="text-sm font-bold text-destructive">{formatBDT(remaining)}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-destructive rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{pct}% due</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-warning hover:text-warning font-semibold ml-2"
                          onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        >
                          Pay Now
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                📜 Activity Log
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {activityLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                </div>
              ) : activityLog?.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">No activity yet</p>
              ) : (
                <div className="space-y-0">
                  {activityLog?.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0 animate-row-in" style={{ animationDelay: `${i * 30}ms` }}>
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${entry.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{entry.text}</p>
                        <p className="text-[10px] text-muted-foreground">{entry.sub}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {entry.time ? formatDistanceToNow(new Date(entry.time), { addSuffix: true }) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Print Modal */}
      <PrintChecklistModal open={printOpen} onOpenChange={setPrintOpen} selectedPoId={printPoId} />
    </div>
  );
}
