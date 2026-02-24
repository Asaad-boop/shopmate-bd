import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSupplierPayableReport } from "@/hooks/use-reports-engine";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

export function SupplierPayableTab() {
  const { data, isLoading } = useSupplierPayableReport();

  if (isLoading) return <Skeleton className="h-[300px]" />;

  const totalOutstanding = (data || []).reduce((s, d: any) => s + d.outstanding, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="border-border/50"><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase">Total Outstanding</p>
          <p className="text-xl font-bold text-red-600" style={mono}>{formatBDT(totalOutstanding)}</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase">Suppliers</p>
          <p className="text-xl font-bold" style={mono}>{(data || []).length}</p>
        </CardContent></Card>
      </div>

      <Card className="border-border/50">
        <CardHeader><CardTitle style={heading}>Supplier Payable Summary</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Total Purchase</TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data || []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No suppliers</TableCell></TableRow>
              )}
              {(data || []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{s.country || "BD"}</Badge></TableCell>
                  <TableCell className="text-right" style={mono}>{formatBDT(s.totalPurchase)}</TableCell>
                  <TableCell className="text-right" style={mono}>{formatBDT(s.totalPaid)}</TableCell>
                  <TableCell className={cn("text-right font-medium", s.outstanding > 0 ? "text-red-600" : "text-emerald-600")} style={mono}>
                    {formatBDT(s.outstanding)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
