import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface ParsedRow {
  legacy_order_id: string;
  order_date: string;
  customer_name: string;
  phone: string;
  address: string;
  district: string;
  thana: string;
  sku: string;
  qty: number;
  unit_price: number;
  product_total: number;
  customer_shipping: number;
  customer_total: number;
  courier_name: string;
  tracking_id: string;
  courier_status: string;
  delivered_date: string;
  returned_date: string;
}

const EXPECTED_FIELDS: (keyof ParsedRow)[] = [
  "legacy_order_id", "order_date", "customer_name", "phone", "address", "district", "thana",
  "sku", "qty", "unit_price", "product_total", "customer_shipping", "customer_total",
  "courier_name", "tracking_id", "courier_status", "delivered_date", "returned_date",
];

export default function ImportLegacyOrders() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing" | "done">("upload");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ imported: 0, failed: 0, duplicates: 0, total: 0, batchId: "" });
  const [errors, setErrors] = useState<string[]>([]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: "binary", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (json.length === 0) {
        toast({ title: "Empty file", variant: "destructive" });
        return;
      }
      const headers = Object.keys(json[0] as any);
      setRawHeaders(headers);
      setRawData(json);

      // Auto-map by similarity
      const autoMap: Record<string, string> = {};
      for (const field of EXPECTED_FIELDS) {
        const norm = field.toLowerCase().replace(/_/g, "");
        const match = headers.find((h) => h.toLowerCase().replace(/[\s_-]/g, "") === norm);
        if (match) autoMap[field] = match;
      }
      setMappings(autoMap);
      setStep("map");
    };
    reader.readAsBinaryString(f);
  }, [toast]);

  const setMapping = (field: string, header: string) => {
    setMappings((prev) => ({ ...prev, [field]: header }));
  };

  const mappedRows = useMemo<ParsedRow[]>(() => {
    if (step !== "preview" && step !== "importing") return [];
    return rawData.map((row) => {
      const mapped: any = {};
      for (const field of EXPECTED_FIELDS) {
        const col = mappings[field];
        mapped[field] = col ? row[col] ?? "" : "";
      }
      mapped.qty = Number(mapped.qty) || 0;
      mapped.unit_price = Number(mapped.unit_price) || 0;
      mapped.product_total = Number(mapped.product_total) || 0;
      mapped.customer_shipping = Number(mapped.customer_shipping) || 0;
      mapped.customer_total = Number(mapped.customer_total) || 0;
      return mapped as ParsedRow;
    });
  }, [rawData, mappings, step]);

  // Group by legacy_order_id
  const groupedOrders = useMemo(() => {
    const map = new Map<string, ParsedRow[]>();
    for (const row of mappedRows) {
      const key = String(row.legacy_order_id).trim();
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return map;
  }, [mappedRows]);

  const handleImport = async () => {
    setStep("importing");
    setProgress(0);
    setErrors([]);

    // Create batch
    const batchId = crypto.randomUUID();
    let imported = 0;
    let failed = 0;
    let duplicates = 0;
    const errorList: string[] = [];
    const entries = Array.from(groupedOrders.entries());
    const total = entries.length;

    for (let i = 0; i < entries.length; i++) {
      const [legacyId, rows] = entries[i];
      const first = rows[0];

      try {
        // Check duplicate
        const { data: existing } = await (supabase
          .from("orders")
          .select("id") as any)
          .eq("order_source", "LEGACY")
          .eq("legacy_order_id", legacyId)
          .maybeSingle();

        if (existing) {
          duplicates++;
          setProgress(Math.round(((i + 1) / total) * 100));
          continue;
        }

        // Find/create customer
        const phone = String(first.phone).trim();
        let customerId: string | null = null;
        if (phone) {
          const { data: cust } = await supabase
            .from("customers")
            .select("id")
            .eq("phone", phone)
            .maybeSingle();
          if (cust) {
            customerId = cust.id;
          } else {
            const { data: newCust } = await supabase
              .from("customers")
              .insert({
                full_name: first.customer_name || "Unknown",
                phone,
                address: first.address || null,
                district: first.district || null,
                thana: first.thana || null,
                source: "legacy_import",
              })
              .select("id")
              .single();
            customerId = newCust?.id || null;
          }
        }

        // Determine status from courier info
        let status = "pending";
        const cs = String(first.courier_status).toLowerCase();
        if (first.delivered_date || cs.includes("deliver")) status = "delivered";
        else if (first.returned_date || cs.includes("return")) status = "returned";
        else if (cs.includes("cancel")) status = "cancelled";
        else if (cs.includes("ship") || cs.includes("transit")) status = "shipped";

        // Format date
        let orderDate: any = first.order_date;
        if (orderDate && typeof orderDate === "object" && (orderDate as any).toISOString) orderDate = (orderDate as any).toISOString().slice(0, 10);
        else if (typeof orderDate === "number") {
          const d = new Date((orderDate - 25569) * 86400000);
          orderDate = d.toISOString().slice(0, 10);
        }

        let deliveredDate: any = first.delivered_date;
        if (deliveredDate && typeof deliveredDate === "object" && (deliveredDate as any).toISOString) deliveredDate = (deliveredDate as any).toISOString().slice(0, 10);
        let returnedDate: any = first.returned_date;
        if (returnedDate && typeof returnedDate === "object" && (returnedDate as any).toISOString) returnedDate = (returnedDate as any).toISOString().slice(0, 10);

        const orderNumber = `LGC-${legacyId}`;

        // Insert order
        const { data: newOrder, error: orderErr } = await supabase
          .from("orders")
          .insert({
            order_number: orderNumber,
            channel: "legacy",
            order_source: "LEGACY",
            legacy_order_id: legacyId,
            legacy_import_batch_id: batchId,
            posting_mode: "DISABLED",
            inventory_mode: "DISABLED",
            courier_mode: "DISABLED",
            legacy_finalized: false,
            customer_id: customerId,
            order_date: orderDate || new Date().toISOString().slice(0, 10),
            delivery_address: first.address || null,
            delivery_district: first.district || null,
            delivery_thana: first.thana || null,
            delivery_charge: first.customer_shipping || 0,
            subtotal: rows.reduce((s, r) => s + r.product_total, 0),
            total_amount: first.customer_total || rows.reduce((s, r) => s + r.product_total, 0) + (first.customer_shipping || 0),
            payment_method: "cod",
            status,
            legacy_courier_name: first.courier_name || null,
            legacy_tracking_id: first.tracking_id || null,
            legacy_courier_status: first.courier_status || null,
            legacy_delivered_date: deliveredDate || null,
            legacy_returned_date: returnedDate || null,
          } as any)
          .select("id")
          .single();

        if (orderErr) throw orderErr;

        // Insert order items — match SKU to products
        for (const row of rows) {
          const sku = String(row.sku).trim();
          let productId: string | null = null;
          if (sku) {
            const { data: prod } = await supabase
              .from("products")
              .select("id")
              .eq("sku", sku)
              .maybeSingle();
            productId = prod?.id || null;
          }

          await supabase.from("order_items").insert({
            order_id: newOrder!.id,
            product_id: productId,
            quantity: row.qty || 1,
            unit_price: row.unit_price || 0,
            total_price: row.product_total || (row.qty * row.unit_price) || 0,
            product_name_fallback: sku || "Legacy Item",
          });
        }

        imported++;
      } catch (err: any) {
        failed++;
        errorList.push(`Order ${legacyId}: ${err.message}`);
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    // Save batch record
    await supabase.from("legacy_import_batches" as any).insert({
      id: batchId,
      file_name: file?.name || "unknown",
      total_rows: total,
      imported_count: imported,
      failed_count: failed,
      duplicate_count: duplicates,
      errors: errorList,
      status: "completed",
    });

    setResults({ imported, failed, duplicates, total, batchId });
    setErrors(errorList);
    setStep("done");
    toast({ title: `✅ Import complete: ${imported} orders imported` });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import Legacy Orders</h1>
          <p className="text-sm text-muted-foreground">Import historical orders from CSV/Excel. No GL/inventory impact until finalized.</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2">
        {["Upload", "Map Columns", "Preview", "Import"].map((s, i) => (
          <Badge
            key={s}
            variant={
              (step === "upload" && i === 0) || (step === "map" && i === 1) ||
              (step === "preview" && i === 2) || ((step === "importing" || step === "done") && i === 3)
                ? "default" : "secondary"
            }
          >
            {i + 1}. {s}
          </Badge>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Upload File</CardTitle>
            <CardDescription>Supported: .csv, .xlsx, .xls</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="legacy-file" className="cursor-pointer">
              <div className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary transition-colors">
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">Click or drag to upload</p>
                <p className="text-sm text-muted-foreground mt-1">CSV or Excel file with legacy order data</p>
              </div>
            </Label>
            <Input id="legacy-file" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <CardDescription>
              {rawData.length} rows found in "{file?.name}". Map your columns to the required fields.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {EXPECTED_FIELDS.map((field) => (
                <div key={field} className="flex items-center gap-2">
                  <Label className="w-40 text-xs font-mono shrink-0">{field}</Label>
                  <Select value={mappings[field] || "__skip__"} onValueChange={(v) => setMapping(field, v === "__skip__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Skip" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__skip__">— Skip —</SelectItem>
                      {rawHeaders.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mappings[field] && <CheckCircle className="w-4 h-4 text-success shrink-0" />}
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button onClick={() => setStep("preview")} disabled={!mappings.legacy_order_id}>
                Preview Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {groupedOrders.size} unique orders from {mappedRows.length} rows. Legacy orders will be read-only with GL/inventory disabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Legacy ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(groupedOrders.entries()).slice(0, 50).map(([id, rows]) => {
                    const first = rows[0];
                    const cs = String(first.courier_status).toLowerCase();
                    let status = "pending";
                    if (first.delivered_date || cs.includes("deliver")) status = "delivered";
                    else if (first.returned_date || cs.includes("return")) status = "returned";
                    else if (cs.includes("cancel")) status = "cancelled";

                    return (
                      <TableRow key={id}>
                        <TableCell className="font-mono text-xs">{id}</TableCell>
                        <TableCell className="text-xs">{String(first.order_date).slice(0, 10)}</TableCell>
                        <TableCell className="text-sm">{first.customer_name}</TableCell>
                        <TableCell className="text-xs">{first.phone}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{rows.length} item(s)</Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">৳{first.customer_total}</TableCell>
                        <TableCell className="text-xs">{first.courier_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={status === "delivered" ? "default" : "secondary"} className="text-xs">{status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {groupedOrders.size > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2">Showing first 50 of {groupedOrders.size} orders</p>
              )}
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleImport}>
                <Upload className="w-4 h-4 mr-1" /> Import {groupedOrders.size} Orders
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Importing */}
      {step === "importing" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Importing…</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-3" />
            <p className="text-sm text-muted-foreground">{progress}% complete</p>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Results */}
      {step === "done" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-success" /> Import Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{results.total}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-success/10">
                <p className="text-2xl font-bold text-success">{results.imported}</p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-500/10">
                <p className="text-2xl font-bold text-amber-600">{results.duplicates}</p>
                <p className="text-xs text-muted-foreground">Duplicates Skipped</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-destructive/10">
                <p className="text-2xl font-bold text-destructive">{results.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
            {errors.length > 0 && (
              <div className="max-h-[200px] overflow-y-auto border rounded-lg p-3 space-y-1">
                {errors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {e}
                  </p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/orders/legacy-batches")}>View Batches</Button>
              <Button onClick={() => navigate("/orders")}>Go to Orders</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
