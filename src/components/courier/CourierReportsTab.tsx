import { useCourierReportStats } from "@/hooks/use-courier";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBDT } from "@/lib/format";
import { BarChart3, TrendingUp, ArrowDownRight, Truck } from "lucide-react";

export function CourierReportsTab() {
  const { data: stats, isLoading } = useCourierReportStats();

  const totals = (stats || []).reduce(
    (acc, s) => ({
      delivered: acc.delivered + s.delivered,
      returned: acc.returned + s.returned,
      total_cost: acc.total_cost + s.total_cost,
      total_cod_fee: acc.total_cod_fee + s.total_cod_fee,
      total_net_payable: acc.total_net_payable + s.total_net_payable,
      total_return_cost: acc.total_return_cost + s.total_return_cost,
    }),
    { delivered: 0, returned: 0, total_cost: 0, total_cod_fee: 0, total_net_payable: 0, total_return_cost: 0 }
  );

  if (isLoading) return <Skeleton className="h-80 w-full" />;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Truck className="w-3.5 h-3.5" /> Total Delivered</div>
            <div className="text-2xl font-bold">{totals.delivered}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><ArrowDownRight className="w-3.5 h-3.5" /> Total Returned</div>
            <div className="text-2xl font-bold text-destructive">{totals.returned}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><BarChart3 className="w-3.5 h-3.5" /> Total Courier Cost</div>
            <div className="text-2xl font-bold">{formatBDT(totals.total_cost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="w-3.5 h-3.5" /> Total Net Payable</div>
            <div className="text-2xl font-bold text-primary">{formatBDT(totals.total_net_payable)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Courier breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Courier Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Courier</TableHead>
                <TableHead className="text-xs text-right">Delivered</TableHead>
                <TableHead className="text-xs text-right">Returned</TableHead>
                <TableHead className="text-xs text-right">Success %</TableHead>
                <TableHead className="text-xs text-right">Total Cost</TableHead>
                <TableHead className="text-xs text-right">COD Fee</TableHead>
                <TableHead className="text-xs text-right">Return Cost</TableHead>
                <TableHead className="text-xs text-right">Net Payable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stats || []).map((s) => {
                const total = s.delivered + s.returned;
                const successPct = total > 0 ? ((s.delivered / total) * 100).toFixed(1) : "-";
                return (
                  <TableRow key={s.courier}>
                    <TableCell className="text-xs font-medium">{s.courier}</TableCell>
                    <TableCell className="text-xs text-right">{s.delivered}</TableCell>
                    <TableCell className="text-xs text-right text-destructive">{s.returned}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">{successPct}%</TableCell>
                    <TableCell className="text-xs text-right">{formatBDT(s.total_cost)}</TableCell>
                    <TableCell className="text-xs text-right">{formatBDT(s.total_cod_fee)}</TableCell>
                    <TableCell className="text-xs text-right text-destructive">{formatBDT(s.total_return_cost)}</TableCell>
                    <TableCell className="text-xs text-right font-semibold text-primary">{formatBDT(s.total_net_payable)}</TableCell>
                  </TableRow>
                );
              })}
              {(stats || []).length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-sm">No data yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
