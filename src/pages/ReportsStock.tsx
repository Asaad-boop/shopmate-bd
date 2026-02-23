import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Archive } from "lucide-react";
import { formatBDT } from "@/lib/format";

export default function ReportsStockPage() {
  const { data: stock, isLoading } = useQuery({
    queryKey: ["stock-on-hand"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_stock_on_hand" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const totalValue = (stock || []).reduce((s: number, p: any) => s + (p.stock_value || 0), 0);
  const totalOnHand = (stock || []).reduce((s: number, p: any) => s + (p.on_hand_qty || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <Archive className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Stock Report</h1>
          <p className="text-sm text-muted-foreground">Ledger-based stock: On Hand, Reserved, Available, Value</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total On Hand</p><p className="text-2xl font-bold font-mono text-foreground">{totalOnHand}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Stock Value</p><p className="text-2xl font-bold font-mono text-foreground">{formatBDT(totalValue)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Products</p><p className="text-2xl font-bold text-foreground">{(stock || []).length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Stock On Hand (Ledger-Derived)</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-[300px]" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Avg Cost</TableHead>
                  <TableHead className="text-right">Stock Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stock || []).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No inventory ledger entries. Stock will appear after stock_in transactions.</TableCell></TableRow>
                ) : (
                  (stock || []).map((p: any) => (
                    <TableRow key={p.product_id}>
                      <TableCell className="font-medium text-sm">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.on_hand_qty}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-orange-600">{p.reserved_qty}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold">{p.available_qty}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatBDT(p.avg_cost || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold">{formatBDT(p.stock_value || 0)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
