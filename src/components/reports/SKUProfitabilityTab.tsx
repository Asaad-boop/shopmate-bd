import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSKUProfitability } from "@/hooks/use-reports-engine";
import { formatBDT } from "@/lib/format";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

export function SKUProfitabilityTab() {
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const { data: skus, isLoading } = useSKUProfitability(dateFrom, dateTo);

  const filtered = (skus || []).filter((s: any) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px] h-8 text-xs" /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px] h-8 text-xs" /></div>
        <div><Label className="text-xs">Search SKU</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter..." className="w-[180px] h-8 text-xs" /></div>
      </div>

      {isLoading ? <Skeleton className="h-[400px]" /> : (
        <Card className="border-border/50">
          <CardHeader><CardTitle style={heading}>SKU Profitability Analysis</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Delivery</TableHead>
                    <TableHead className="text-right">COD Fee</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
                  )}
                  {filtered.map((s: any, i: number) => (
                    <TableRow key={s.product_id}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {s.image_url ? <img src={s.image_url} className="w-7 h-7 rounded-lg object-cover border" /> : <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center"><Package className="w-3.5 h-3.5 text-muted-foreground" /></div>}
                          <div><p className="text-sm font-medium">{s.name}</p><p className="text-[10px] text-muted-foreground">{s.sku}</p></div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right" style={mono}>{s.orders}</TableCell>
                      <TableCell className="text-right" style={mono}>{s.delivered_qty}</TableCell>
                      <TableCell className="text-right text-red-500" style={mono}>{s.returned_qty}</TableCell>
                      <TableCell className="text-right" style={mono}>{formatBDT(s.revenue)}</TableCell>
                      <TableCell className="text-right text-muted-foreground" style={mono}>{formatBDT(s.cogs)}</TableCell>
                      <TableCell className="text-right text-muted-foreground" style={mono}>{formatBDT(s.delivery_cost)}</TableCell>
                      <TableCell className="text-right text-muted-foreground" style={mono}>{formatBDT(s.cod_fee)}</TableCell>
                      <TableCell className="text-right text-muted-foreground" style={mono}>{formatBDT(s.allocated_cost)}</TableCell>
                      <TableCell className={cn("text-right font-medium", s.netProfit >= 0 ? "text-emerald-600" : "text-red-500")} style={mono}>{formatBDT(s.netProfit)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={cn("text-xs font-mono", s.margin >= 40 ? "bg-emerald-100 text-emerald-800" : s.margin >= 20 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800")}>
                          {s.margin}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
