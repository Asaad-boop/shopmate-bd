import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Package, Ship, ClipboardCheck, Wallet, TrendingUp, DollarSign,
  ArrowRight, AlertTriangle, ExternalLink, Truck, Factory, Archive,
  CheckCircle2, FileText
} from "lucide-react";

function formatBDT(n: number) {
  return `৳${n.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function useProcurementDashboard() {
  return useQuery({
    queryKey: ["procurement-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("procurement_dashboard_report" as any);
      if (error) throw error;
      return data as any;
    },
    staleTime: 60_000,
  });
}

const PIPELINE_STAGES = [
  { key: "draft", label: "Draft", icon: FileText, color: "bg-muted text-muted-foreground" },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { key: "production", label: "Production", icon: Factory, color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  { key: "in_transit", label: "In Transit", icon: Ship, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  { key: "received", label: "Received", icon: ClipboardCheck, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { key: "closed", label: "Closed", icon: Archive, color: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400" },
];

export default function ProcurementDashboard() {
  const { data, isLoading } = useProcurementDashboard();
  const navigate = useNavigate();

  const kpi = data?.kpi || {};
  const pipeline = data?.pipeline || {};
  const recentGrns = data?.recent_grns || [];
  const importCosts = data?.import_costs || {};
  const shipmentCosts = data?.shipment_costs || [];
  const costTrend = data?.cost_trend || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Procurement Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Purchase pipeline, imports, and supplier dues overview</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/purchase-orders")}>
            <Package className="w-4 h-4 mr-1" />Purchase Orders
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/purchasing")}>
            <ClipboardCheck className="w-4 h-4 mr-1" />GRN & Payments
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          title="Open POs"
          value={String(kpi.open_pos ?? "—")}
          icon={<Package className="w-4 h-4" />}
          loading={isLoading}
        />
        <KpiCard
          title="In Transit"
          value={String(kpi.in_transit ?? "—")}
          icon={<Ship className="w-4 h-4" />}
          loading={isLoading}
          className={kpi.in_transit > 0 ? "border-amber-500/30" : ""}
        />
        <KpiCard
          title="Received (Month)"
          value={String(kpi.received_this_month ?? "—")}
          icon={<ClipboardCheck className="w-4 h-4" />}
          loading={isLoading}
        />
        <KpiCard
          title="Supplier Payable"
          value={kpi.total_supplier_payable != null ? formatBDT(kpi.total_supplier_payable) : "—"}
          icon={<Wallet className="w-4 h-4" />}
          loading={isLoading}
          className={kpi.total_supplier_payable > 0 ? "border-destructive/30" : ""}
          subtitle={kpi.overdue_payable_count > 0 ? `${kpi.overdue_payable_count} overdue` : undefined}
        />
        <KpiCard
          title="Value Added (Month)"
          value={kpi.inventory_value_added != null ? formatBDT(kpi.inventory_value_added) : "—"}
          icon={<TrendingUp className="w-4 h-4" />}
          loading={isLoading}
        />
        <KpiCard
          title="Avg Cost/Unit"
          value={kpi.avg_cost_per_unit != null ? formatBDT(kpi.avg_cost_per_unit) : "—"}
          icon={<DollarSign className="w-4 h-4" />}
          loading={isLoading}
        />
      </div>

      {/* Purchase Pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            Purchase Pipeline
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/purchase-orders")}>
              View All <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1">
            {PIPELINE_STAGES.map((stage, idx) => {
              const count = pipeline[stage.key] ?? 0;
              return (
                <div key={stage.key} className="flex items-center flex-1">
                  <div className={cn(
                    "flex-1 rounded-lg p-3 text-center transition-all",
                    count > 0 ? stage.color : "bg-muted/30 text-muted-foreground/50"
                  )}>
                    <stage.icon className="w-5 h-5 mx-auto mb-1" />
                    <p className="text-xl font-bold">{count}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wide">{stage.label}</p>
                  </div>
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground/30 mx-0.5 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supplier Payable Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Supplier Payables
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/finance/payables")}>
                Details <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">Total Outstanding</p>
                  <p className="text-2xl font-bold">{formatBDT(kpi.total_supplier_payable || 0)}</p>
                </div>
                <Wallet className="w-8 h-8 text-muted-foreground/30" />
              </div>
              {(kpi.overdue_payable_count || 0) > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <span className="text-sm"><strong>{kpi.overdue_payable_count}</strong> GRNs overdue (&gt;30 days)</span>
                  <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => navigate("/purchasing?tab=payables")}>
                    View <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              )}
              {/* Avg cost trend */}
              {costTrend.length > 1 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Avg Cost/Unit Trend (6 months)</p>
                  <div className="flex items-end gap-1 h-16">
                    {costTrend.map((m: any) => {
                      const maxCost = Math.max(...costTrend.map((t: any) => t.avg_cost || 0));
                      const heightPct = maxCost > 0 ? ((m.avg_cost || 0) / maxCost) * 100 : 0;
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-[9px] text-muted-foreground">{formatBDT(m.avg_cost || 0)}</span>
                          <div
                            className="w-full rounded-t bg-primary/60 transition-all"
                            style={{ height: `${Math.max(heightPct, 4)}%` }}
                          />
                          <span className="text-[9px] text-muted-foreground">{m.month?.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Import Cost Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Import Costs (This Month)
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/purchasing?tab=landed-costs")}>
                Manage <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "Freight", value: importCosts.freight || 0 },
                { label: "Customs Duty", value: importCosts.customs || 0 },
                { label: "C&F Charges", value: importCosts.cnf || 0 },
                { label: "Agent Fees", value: importCosts.agent_fees || 0 },
                { label: "Local Transport", value: importCosts.transport || 0 },
                { label: "Other Charges", value: importCosts.other || 0 },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold">{formatBDT(value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm font-bold">Total Landed Costs</span>
                <span className="text-sm font-bold text-primary">{formatBDT(importCosts.total_landed || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent GRNs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            Recent Goods Received (This Month)
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/purchasing?tab=grn")}>
              All GRNs <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRN #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentGrns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No GRNs this month</TableCell>
                </TableRow>
              ) : recentGrns.map((g: any) => (
                <TableRow key={g.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate("/purchasing?tab=grn")}>
                  <TableCell className="font-mono text-xs font-medium">{g.grn_number}</TableCell>
                  <TableCell className="text-sm">{g.supplier_name || "—"}</TableCell>
                  <TableCell className="text-xs">{g.receipt_date ? format(new Date(g.receipt_date), "dd MMM yy") : "—"}</TableCell>
                  <TableCell className="text-right text-xs">{g.item_count}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatBDT(g.total_cost || 0)}</TableCell>
                  <TableCell>
                    <Badge variant={g.status === "posted" ? "default" : "secondary"} className="text-xs">
                      {g.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Landed Cost per Shipment */}
      {shipmentCosts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Landed Cost per Shipment</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Product</TableHead>
                  <TableHead className="text-right">Freight</TableHead>
                  <TableHead className="text-right">Customs</TableHead>
                  <TableHead className="text-right">C&F</TableHead>
                  <TableHead className="text-right">Transport</TableHead>
                  <TableHead className="text-right">Grand Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipmentCosts.slice(0, 10).map((s: any) => (
                  <TableRow key={s.po_id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/purchase-orders/${s.po_id}`)}>
                    <TableCell className="font-mono text-xs font-medium">{s.po_number}</TableCell>
                    <TableCell className="text-sm">{s.supplier || "—"}</TableCell>
                    <TableCell className="text-right text-xs">{formatBDT(s.product_cost || 0)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBDT(s.freight)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBDT(s.customs)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBDT(s.cnf)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBDT(s.transport)}</TableCell>
                    <TableCell className="text-right text-sm font-bold">{formatBDT(s.grand_total)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{s.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
