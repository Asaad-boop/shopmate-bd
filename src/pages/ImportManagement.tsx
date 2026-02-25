import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KpiCard } from "@/components/ui/kpi-card";
import { Plus, Search, Ship, Package, DollarSign, CheckCircle2, Truck, Eye } from "lucide-react";
import { format } from "date-fns";
import { useSuppliers, useAgents } from "@/hooks/use-purchase-orders";
import ImportDetailDrawer from "@/components/imports/ImportDetailDrawer";

const STATUS_CONFIG: Record<string, { label: string; icon: string; className: string }> = {
  in_transit: { label: "In Transit", icon: "🚢", className: "bg-info/10 text-info" },
  arrived: { label: "Arrived", icon: "📍", className: "bg-warning/10 text-warning" },
  cleared: { label: "Cleared", icon: "🛃", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  received: { label: "Received", icon: "✅", className: "bg-success/10 text-success" },
};

function useImportShipments() {
  return useQuery({
    queryKey: ["import-shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_shipments")
        .select("*, suppliers(name), agents(name), import_shipment_pos(po_id, purchase_orders(po_number))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export default function ImportManagement() {
  const { data: shipments, isLoading } = useImportShipments();
  const { data: suppliers } = useSuppliers();
  const { data: agents } = useAgents();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Create form
  const [form, setForm] = useState({
    import_number: "", supplier_id: "", agent_id: "", status: "in_transit",
    freight_cost: 0, customs_cost: 0, local_transport: 0, other_charges: 0, notes: "",
  });

  const filtered = useMemo(() => {
    if (!shipments) return [];
    return shipments.filter(s => {
      const matchSearch = !search ||
        s.import_number.toLowerCase().includes(search.toLowerCase()) ||
        (s.suppliers as any)?.name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [shipments, search, statusFilter]);

  // KPIs
  const stats = useMemo(() => {
    if (!shipments) return { total: 0, inTransit: 0, totalLanded: 0, received: 0 };
    return {
      total: shipments.length,
      inTransit: shipments.filter(s => s.status === "in_transit").length,
      totalLanded: shipments.reduce((s, r) => s + (r.total_landed_cost || 0), 0),
      received: shipments.filter(s => s.status === "received").length,
    };
  }, [shipments]);

  const handleCreate = async () => {
    if (!form.import_number) {
      toast({ title: "Import number is required", variant: "destructive" });
      return;
    }
    try {
      await supabase.from("import_shipments").insert({
        import_number: form.import_number,
        supplier_id: form.supplier_id || null,
        agent_id: form.agent_id || null,
        status: form.status,
        freight_cost: form.freight_cost,
        customs_cost: form.customs_cost,
        local_transport: form.local_transport,
        other_charges: form.other_charges,
        notes: form.notes || null,
      } as any);
      queryClient.invalidateQueries({ queryKey: ["import-shipments"] });
      toast({ title: "Import shipment created!" });
      setCreateOpen(false);
      setForm({
        import_number: `IMP-${Date.now().toString(36).toUpperCase()}`,
        supplier_id: "", agent_id: "", status: "in_transit",
        freight_cost: 0, customs_cost: 0, local_transport: 0, other_charges: 0, notes: "",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border -mx-6 px-6 py-3 flex items-center justify-between" style={{ height: 52 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Ship className="w-5 h-5" /> Import Management
          </h1>
          <Badge variant="secondary" className="text-xs font-semibold">{shipments?.length ?? 0}</Badge>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => {
          setForm({ ...form, import_number: `IMP-${Date.now().toString(36).toUpperCase()}` });
          setCreateOpen(true);
        }}>
          <Plus className="w-4 h-4" /> New Import
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total Imports" value={String(stats.total)} icon={<Ship className="w-5 h-5" />} />
        <KpiCard title="In Transit" value={String(stats.inTransit)} icon={<Truck className="w-5 h-5" />} />
        <KpiCard title="Total Landed Cost" value={`৳${stats.totalLanded.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} />
        <KpiCard title="Received" value={String(stats.received)} icon={<CheckCircle2 className="w-5 h-5" />} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search imports..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[
            { key: "all", label: "All" },
            { key: "in_transit", label: "In Transit" },
            { key: "arrived", label: "Arrived" },
            { key: "cleared", label: "Cleared" },
            { key: "received", label: "Received" },
          ].map(p => (
            <Button key={p.key} variant={statusFilter === p.key ? "default" : "ghost"} size="sm" className="h-8 text-xs rounded-full" onClick={() => setStatusFilter(p.key)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Package className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No imports found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Import ID</TableHead>
                <TableHead>Supplier / Agent</TableHead>
                <TableHead>Linked POs</TableHead>
                <TableHead>Freight</TableHead>
                <TableHead>Customs</TableHead>
                <TableHead>Transport</TableHead>
                <TableHead>Other</TableHead>
                <TableHead>Total Landed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => {
                const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.in_transit;
                const linkedPOs = (s.import_shipment_pos as any[]) || [];
                return (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailId(s.id)}>
                    <TableCell className="font-bold text-primary text-sm">{s.import_number}</TableCell>
                    <TableCell className="text-sm">
                      {(s.suppliers as any)?.name || (s.agents as any)?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {linkedPOs.length > 0 ? linkedPOs.map((lp: any) => (
                          <Badge key={lp.po_id} variant="outline" className="text-[10px]">
                            {lp.purchase_orders?.po_number || "PO"}
                          </Badge>
                        )) : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">৳{(s.freight_cost || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">৳{(s.customs_cost || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">৳{(s.local_transport || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">৳{(s.other_charges || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm font-semibold">৳{(s.total_landed_cost || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] font-semibold ${sc.className}`}>{sc.icon} {sc.label}</Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailId(s.id)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Import Shipment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Import Number *" value={form.import_number} onChange={e => set("import_number", e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.supplier_id || "_none"} onValueChange={v => set("supplier_id", v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Supplier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No Supplier</SelectItem>
                  {suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.agent_id || "_none"} onValueChange={v => set("agent_id", v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Agent" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No Agent</SelectItem>
                  {agents?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="arrived">Arrived</SelectItem>
                <SelectItem value="cleared">Cleared</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs font-bold text-muted-foreground pt-2">Cost Breakdown</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Freight Cost (৳)</label>
                <Input type="number" value={form.freight_cost || ""} onChange={e => set("freight_cost", Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Customs Cost (৳)</label>
                <Input type="number" value={form.customs_cost || ""} onChange={e => set("customs_cost", Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Local Transport (৳)</label>
                <Input type="number" value={form.local_transport || ""} onChange={e => set("local_transport", Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Other Charges (৳)</label>
                <Input type="number" value={form.other_charges || ""} onChange={e => set("other_charges", Number(e.target.value))} />
              </div>
            </div>
            <div className="rounded-xl bg-primary/5 p-3 flex justify-between text-sm font-semibold">
              <span>Total Landed Cost</span>
              <span>৳{(form.freight_cost + form.customs_cost + form.local_transport + form.other_charges).toLocaleString()}</span>
            </div>
            <Textarea placeholder="Notes..." value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Drawer */}
      <ImportDetailDrawer
        shipmentId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
