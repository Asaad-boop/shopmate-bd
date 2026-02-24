import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCourierPerformanceReport } from "@/hooks/use-reports-engine";
import { formatBDT } from "@/lib/format";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Truck } from "lucide-react";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

export function CourierPerformanceTab() {
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const { data, isLoading } = useCourierPerformanceReport(dateFrom, dateTo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px] h-8 text-xs" /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px] h-8 text-xs" /></div>
      </div>

      {isLoading ? <Skeleton className="h-[300px]" /> : (
        <Card className="border-border/50">
          <CardHeader><CardTitle style={heading}>Courier Performance</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Courier</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Delivered %</TableHead>
                  <TableHead className="text-right">RTO %</TableHead>
                  <TableHead className="text-right">Delivery Cost</TableHead>
                  <TableHead className="text-right">COD Fee</TableHead>
                  <TableHead className="text-right">Net Payable</TableHead>
                  <TableHead className="text-right">Avg Cost/Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data || []).length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
                )}
                {(data || []).map((c: any) => (
                  <TableRow key={c.name}>
                    <TableCell><div className="flex items-center gap-2"><Truck className="w-4 h-4 text-muted-foreground" /><span className="font-medium">{c.name}</span></div></TableCell>
                    <TableCell className="text-right" style={mono}>{c.total}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={cn("text-xs font-mono", c.deliveredPct >= 80 ? "bg-emerald-100 text-emerald-800" : c.deliveredPct >= 60 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800")}>{c.deliveredPct}%</Badge>
                    </TableCell>
                    <TableCell className="text-right text-red-500" style={mono}>{c.rtoPct}%</TableCell>
                    <TableCell className="text-right" style={mono}>{formatBDT(c.totalCost)}</TableCell>
                    <TableCell className="text-right" style={mono}>{formatBDT(c.totalCodFee)}</TableCell>
                    <TableCell className="text-right" style={mono}>{formatBDT(c.netPayable)}</TableCell>
                    <TableCell className="text-right" style={mono}>{formatBDT(c.avgCost)}</TableCell>
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
