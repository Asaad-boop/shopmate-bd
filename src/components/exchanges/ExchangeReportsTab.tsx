import { useExchangeReport } from "@/hooks/use-exchanges";
import { formatBDT } from "@/lib/format";
import { KpiCard } from "@/components/ui/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ArrowRightLeft, TrendingDown, Truck, DollarSign, Percent } from "lucide-react";

export function ExchangeReportsTab() {
  const { data: report, isLoading } = useExchangeReport();

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard title="Total Exchanges" value={String(report?.totalExchanges || 0)} icon={<ArrowRightLeft className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="Exchange Rate" value={`${(report?.exchangeRate || 0).toFixed(1)}%`} icon={<Percent className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="Courier Cost Loss" value={formatBDT(report?.courierCostLoss || 0)} icon={<Truck className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="Damaged Loss" value={formatBDT(report?.damagedLoss || 0)} icon={<TrendingDown className="w-5 h-5" />} loading={isLoading} />
        <KpiCard title="Net Exchange Cost" value={formatBDT(report?.netCost || 0)} icon={<DollarSign className="w-5 h-5" />} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Exchange Reasons */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-3">Top Exchange Reasons</h3>
          <Table>
            <TableHeader>
              <TableRow><TableHead className="text-xs">Reason</TableHead><TableHead className="text-xs text-right">Count</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {(report?.topReasons || []).map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-xs">{r.reason}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{r.count}</TableCell>
                </TableRow>
              ))}
              {(!report?.topReasons || report.topReasons.length === 0) && (
                <TableRow><TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-6">No data</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Product-wise Exchange */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-3">Product-wise Exchange Volume</h3>
          <Table>
            <TableHeader>
              <TableRow><TableHead className="text-xs">Product</TableHead><TableHead className="text-xs text-right">Units Exchanged</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {(report?.topProducts || []).map((p, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-xs">{p.name}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{p.count}</TableCell>
                </TableRow>
              ))}
              {(!report?.topProducts || report.topProducts.length === 0) && (
                <TableRow><TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-6">No data</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-card rounded-xl border border-border p-5 max-w-md">
        <h3 className="text-sm font-semibold mb-3">Exchange Cost Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span>Completed Exchanges</span><span className="font-mono">{report?.completed || 0}</span></div>
          <div className="flex justify-between"><span>Courier Cost Loss</span><span className="font-mono text-red-600">{formatBDT(report?.courierCostLoss || 0)}</span></div>
          <div className="flex justify-between"><span>Damaged Product Loss</span><span className="font-mono text-red-600">{formatBDT(report?.damagedLoss || 0)}</span></div>
          <div className="flex justify-between"><span>Price Difference (gain/loss)</span><span className="font-mono">{formatBDT(report?.priceDiffTotal || 0)}</span></div>
          <Separator />
          <div className="flex justify-between font-bold"><span>Net Exchange Cost</span><span className="font-mono">{formatBDT(report?.netCost || 0)}</span></div>
        </div>
      </div>
    </div>
  );
}
