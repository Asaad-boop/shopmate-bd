import { useProductLedger } from "@/hooks/use-inventory-ledger";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Download, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

const TXN_LABELS: Record<string, { label: string; color: string }> = {
  stock_in: { label: "Stock IN", color: "text-success" },
  stock_out: { label: "Stock OUT", color: "text-destructive" },
  reserve: { label: "Reserve", color: "text-warning" },
  unreserve: { label: "Unreserve", color: "text-info" },
  damage: { label: "Damaged", color: "text-muted-foreground" },
  adjustment: { label: "Adjustment", color: "text-primary" },
};

const REF_LABELS: Record<string, string> = {
  order: "Order",
  grn: "GRN",
  return: "Return",
  exchange: "Exchange",
  opening_balance: "Opening Bal",
  manual_adjustment: "Manual Adj",
  stock_adjustment: "Stock Adj",
  purchase_order: "PO",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name: string; sku: string } | null;
}

export default function StockLedgerDrawer({ open, onOpenChange, product }: Props) {
  const { data: entries, isLoading } = useProductLedger(product?.id);

  const handleExport = () => {
    if (!entries) return;
    const header = "Date,Type,Reference,IN,OUT,Balance,Avg Cost,Note\n";
    const csv = entries.map((e) => {
      const cfg = TXN_LABELS[e.txn_type] || { label: e.txn_type };
      const ref = REF_LABELS[e.reference_type || ""] || e.reference_type || "";
      return `"${formatDateTime(e.created_at)}","${cfg.label}","${ref}",${e.qty_in},${e.qty_out},${e.running_balance},${e.running_avg_cost || ""},"${e.note || ""}"`;
    }).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${product?.sku || "product"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reverse chronological for display
  const reversed = entries ? [...entries].reverse() : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full p-0">
        <SheetHeader className="px-6 py-5 border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg">📒 Stock Ledger</SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {product?.name} <span className="text-primary font-mono">({product?.sku})</span>
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </div>
        </SheetHeader>

        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 100px)" }}>
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : !reversed.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm">No ledger entries yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">IN</TableHead>
                  <TableHead className="text-right">OUT</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Avg Cost</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reversed.map((e, i) => {
                  const cfg = TXN_LABELS[e.txn_type] || { label: e.txn_type, color: "text-muted-foreground" };
                  const refLabel = REF_LABELS[e.reference_type || ""] || e.reference_type || "—";
                  return (
                    <TableRow key={e.id} className="animate-row-in" style={{ animationDelay: `${i * 20}ms` }}>
                      <TableCell className="text-xs whitespace-nowrap">{formatDateTime(e.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {e.qty_in > 0 ? (
                            <ArrowUpCircle className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <ArrowDownCircle className="w-3.5 h-3.5 text-destructive" />
                          )}
                          <span className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{refLabel}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {e.qty_in > 0 ? <span className="text-success font-medium">+{e.qty_in}</span> : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {e.qty_out > 0 ? <span className="text-destructive font-medium">-{e.qty_out}</span> : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-bold">{e.running_balance}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{e.running_avg_cost ? formatBDT(e.running_avg_cost) : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{e.note || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
