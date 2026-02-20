import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  products: any[];
}

export default function ReorderSuggestions({ products }: Props) {
  const lowStockProducts = products?.filter(
    (p) => (p.stock_quantity || 0) <= (p.reorder_point || 10)
  ) || [];

  if (lowStockProducts.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">✅ All products are well-stocked!</p>
        <p className="text-sm mt-1">No reorder suggestions at this time.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-xl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Current Stock</TableHead>
            <TableHead>Alert Qty</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Suggested Order</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lowStockProducts.map((p) => {
            const stock = p.stock_quantity || 0;
            const alert = p.reorder_point || 10;
            const suggested = p.reorder_quantity || 50;
            const isOut = stock === 0;
            return (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">IMG</div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sku}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={cn("font-bold", isOut ? "text-destructive" : "text-warning")}>{stock}</span>
                </TableCell>
                <TableCell className="text-sm">{alert}</TableCell>
                <TableCell className="text-sm">{(p.suppliers as any)?.name || "—"}</TableCell>
                <TableCell className="font-medium">{suggested}</TableCell>
                <TableCell>
                  {isOut ? (
                    <Badge variant="destructive">Out of Stock</Badge>
                  ) : (
                    <Badge className="bg-warning/15 text-warning border-warning/30">Low Stock</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
