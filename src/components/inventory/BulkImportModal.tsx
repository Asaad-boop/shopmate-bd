import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: any[];
}

interface CsvRow {
  sku: string;
  quantity: string;
  cost_price: string;
  matched?: boolean;
  productId?: string;
  productName?: string;
}

export default function BulkImportModal({ open, onOpenChange, products }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ updated: number; notFound: number } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      // Skip header if first line contains "sku"
      const start = lines[0]?.toLowerCase().includes("sku") ? 1 : 0;
      const parsed: CsvRow[] = lines.slice(start).map((line) => {
        const [sku, quantity, cost_price] = line.split(",").map((s) => s.trim().replace(/"/g, ""));
        const match = products?.find((p) => p.sku.toLowerCase() === sku?.toLowerCase());
        return {
          sku: sku || "",
          quantity: quantity || "0",
          cost_price: cost_price || "0",
          matched: !!match,
          productId: match?.id,
          productName: match?.name,
        };
      });
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validRows = rows.filter((r) => r.matched && r.productId);
    if (validRows.length === 0) {
      toast({ title: "No valid SKUs to import", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      for (const row of validRows) {
        const qty = parseInt(row.quantity) || 0;
        const cost = parseFloat(row.cost_price) || 0;
        await supabase
          .from("products")
          .update({
            stock_quantity: qty,
            landed_cost_bdt: cost > 0 ? cost : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.productId!);

        await supabase.from("inventory_movements").insert({
          product_id: row.productId!,
          movement_type: "manual_adjustment",
          quantity: qty,
          notes: "Bulk CSV import",
          reference_type: "csv_import",
        });
      }
      const notFound = rows.filter((r) => !r.matched).length;
      setResult({ updated: validRows.length, notFound });
      toast({ title: `✅ ${validRows.length} products updated${notFound > 0 ? `, ${notFound} SKU not found` : ""}` });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
    } catch (e: any) {
      toast({ title: "Import error", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = (o: boolean) => {
    if (!o) { setRows([]); setResult(null); }
    onOpenChange(o);
  };

  const matchedCount = rows.filter((r) => r.matched).length;
  const notFoundCount = rows.filter((r) => !r.matched).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Stock from CSV</DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="py-12 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Upload a CSV file</p>
              <p className="text-sm text-muted-foreground mt-1">Format: SKU, Quantity, Cost Price</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Choose CSV File
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex gap-3">
              <Badge className="bg-success/15 text-success">{matchedCount} matched</Badge>
              {notFoundCount > 0 && (
                <Badge variant="destructive">{notFoundCount} not found</Badge>
              )}
            </div>

            {result && (
              <div className="p-3 rounded-lg bg-success/10 text-success text-sm font-medium">
                ✅ Import complete: {result.updated} products updated
                {result.notFound > 0 && `, ${result.notFound} SKU not found`}
              </div>
            )}

            {/* Preview */}
            <div className="overflow-x-auto border rounded-lg max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Cost Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{r.sku}</TableCell>
                      <TableCell className="text-sm">{r.productName || "—"}</TableCell>
                      <TableCell className="font-medium">{r.quantity}</TableCell>
                      <TableCell>{r.cost_price}</TableCell>
                      <TableCell>
                        {r.matched ? (
                          <Badge className="bg-success/15 text-success">✓ Matched</Badge>
                        ) : (
                          <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Not Found</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          {rows.length > 0 && !result && (
            <Button onClick={handleImport} disabled={importing || matchedCount === 0}>
              {importing ? "Importing..." : `Import ${matchedCount} Products`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
