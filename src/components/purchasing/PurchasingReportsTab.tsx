import { useMemo } from "react";
import { useGoodsReceipts, useSupplierPayments, useLandedCosts, usePurchasingStats } from "@/hooks/use-purchasing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Wallet, TrendingUp, AlertTriangle } from "lucide-react";

export function PurchasingReportsTab() {
  const { data: stats, isLoading } = usePurchasingStats();
  const { data: grns } = useGoodsReceipts();
  const { data: landedCosts } = useLandedCosts();

  // Top suppliers by purchase value
  const topSuppliers = useMemo(() => {
    if (!grns) return [];
    const supplierMap = new Map<string, { name: string; total: number; count: number }>();
    grns.filter((g) => g.status === "posted").forEach((g) => {
      const name = (g.suppliers as any)?.name || "Unknown";
      const existing = supplierMap.get(name) || { name, total: 0, count: 0 };
      existing.total += g.total_product_cost || 0;
      existing.count++;
      supplierMap.set(name, existing);
    });
    return Array.from(supplierMap.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [grns]);

  // Landed cost summary by type
  const landedSummary = useMemo(() => {
    if (!landedCosts) return [];
    const typeMap = new Map<string, number>();
    landedCosts.filter((c) => c.status === "posted").forEach((c) => {
      typeMap.set(c.cost_type, (typeMap.get(c.cost_type) || 0) + (c.amount || 0));
    });
    return Array.from(typeMap.entries()).map(([type, total]) => ({ type, total })).sort((a, b) => b.total - a.total);
  }, [landedCosts]);

  if (isLoading) return <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;

  const kpis = [
    { label: "Total GRNs", value: stats?.totalGRNs || 0, icon: Package, color: "text-primary bg-primary/10" },
    { label: "Purchase Value", value: `৳${((stats?.totalPurchaseValue || 0) / 1000).toFixed(0)}k`, icon: TrendingUp, color: "text-info bg-info/10" },
    { label: "Total Paid", value: `৳${((stats?.totalPaid || 0) / 1000).toFixed(0)}k`, icon: Wallet, color: "text-success bg-success/10" },
    { label: "Outstanding", value: `৳${((stats?.totalOutstanding || 0) / 1000).toFixed(0)}k`, icon: AlertTriangle, color: "text-warning bg-warning/10" },
  ];

  return (
    <div className="space-y-5 mt-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl bg-card border border-border p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.color}`}>
                <k.icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
            </div>
            <p className="text-xl font-bold text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Suppliers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Top Suppliers by Purchase Value</CardTitle>
          </CardHeader>
          <CardContent>
            {topSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>GRNs</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSuppliers.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="text-sm font-medium">{s.name}</TableCell>
                      <TableCell className="text-sm">{s.count}</TableCell>
                      <TableCell className="text-sm font-semibold">৳{s.total.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Landed Cost Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Landed Cost by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {landedSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cost Type</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {landedSummary.map((c) => (
                    <TableRow key={c.type}>
                      <TableCell className="text-sm font-medium">{c.type}</TableCell>
                      <TableCell className="text-sm font-semibold">৳{c.total.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
