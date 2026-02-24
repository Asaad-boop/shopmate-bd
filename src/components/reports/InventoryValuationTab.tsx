import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInventoryValuation } from "@/hooks/use-reports-engine";
import { formatBDT } from "@/lib/format";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

export function InventoryValuationTab() {
  const { data, isLoading } = useInventoryValuation();

  if (isLoading) return <Skeleton className="h-[400px]" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="border-border/50"><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase">Total Stock Value</p>
          <p className="text-xl font-bold" style={mono}>{formatBDT(data?.totalValue || 0)}</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase">Total Units</p>
          <p className="text-xl font-bold" style={mono}>{(data?.totalUnits || 0).toLocaleString()}</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase">SKU Count</p>
          <p className="text-xl font-bold" style={mono}>{(data?.items || []).length}</p>
        </CardContent></Card>
      </div>

      <Card className="border-border/50">
        <CardHeader><CardTitle style={heading}>Inventory Valuation by SKU</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items || []).length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No inventory data</TableCell></TableRow>
              )}
              {(data?.items || []).map((item: any, i: number) => (
                <TableRow key={item.product_id}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="text-sm">{item.name}</TableCell>
                  <TableCell className="text-right" style={mono}>{item.on_hand}</TableCell>
                  <TableCell className="text-right text-muted-foreground" style={mono}>{item.reserved}</TableCell>
                  <TableCell className="text-right" style={mono}>{item.available}</TableCell>
                  <TableCell className="text-right" style={mono}>{formatBDT(item.avg_cost)}</TableCell>
                  <TableCell className="text-right font-medium" style={mono}>{formatBDT(item.total_value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
