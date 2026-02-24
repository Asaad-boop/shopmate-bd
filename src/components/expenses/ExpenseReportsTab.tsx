import { useState } from "react";
import { useExpenseReportByCategory, useAllocationSummary } from "@/hooks/use-expenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBDT } from "@/lib/format";
import { BarChart3, PieChart, TrendingUp, Package } from "lucide-react";

export function ExpenseReportsTab() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data: catReport, isLoading: catLoading } = useExpenseReportByCategory(dateFrom || undefined, dateTo || undefined);
  const { data: allocSummary, isLoading: allocLoading } = useAllocationSummary();

  const totalExpenses = (catReport || []).reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-2">
        <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From" />
        <Input type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><BarChart3 className="w-3.5 h-3.5" /> Total Expenses</div>
            <div className="text-2xl font-bold">{formatBDT(totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><PieChart className="w-3.5 h-3.5" /> Categories</div>
            <div className="text-2xl font-bold">{(catReport || []).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="w-3.5 h-3.5" /> Total Allocated</div>
            <div className="text-2xl font-bold">{formatBDT(allocSummary?.totalAllocated || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Package className="w-3.5 h-3.5" /> Unallocated</div>
            <div className="text-2xl font-bold text-destructive">{formatBDT(totalExpenses - (allocSummary?.totalAllocated || 0))}</div>
          </CardContent>
        </Card>
      </div>

      {/* Category Totals */}
      <Card>
        <CardHeader><CardTitle className="text-base">Expenses by Category</CardTitle></CardHeader>
        <CardContent>
          {catLoading ? <Skeleton className="h-40 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs text-right">Count</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(catReport || []).map((c) => (
                  <TableRow key={c.category}>
                    <TableCell className="text-sm font-medium">{c.category}</TableCell>
                    <TableCell className="text-xs text-right">{c.count}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">{formatBDT(c.total)}</TableCell>
                    <TableCell className="text-xs text-right">{totalExpenses ? ((c.total / totalExpenses) * 100).toFixed(1) : 0}%</TableCell>
                  </TableRow>
                ))}
                {(catReport || []).length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">No posted expenses</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Top SKUs by allocated cost */}
      <Card>
        <CardHeader><CardTitle className="text-base">Top SKUs by Allocated Cost</CardTitle></CardHeader>
        <CardContent>
          {allocLoading ? <Skeleton className="h-40 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">SKU</TableHead>
                  <TableHead className="text-xs text-right">Allocated Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(allocSummary?.topSkus || []).map((s, i) => (
                  <TableRow key={s.sku}>
                    <TableCell className="text-xs">{i + 1}</TableCell>
                    <TableCell className="text-xs font-mono">{s.sku}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">{formatBDT(s.amount)}</TableCell>
                  </TableRow>
                ))}
                {(allocSummary?.topSkus || []).length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8 text-sm">No allocations posted</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
