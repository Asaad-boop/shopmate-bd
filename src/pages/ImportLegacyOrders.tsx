import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2, Download, XCircle } from "lucide-react";
import * as XLSX from "xlsx";
import {
  parseProductsCell,
  parseSkusCell,
  mapStatus,
  validateOrder,
  generateErrorCsv,
  downloadCsv,
  parseExcelDate,
  type ParsedOrderRow,
  type ValidatedOrder,
  type ValidationError,
  type ValidationWarning,
} from "@/lib/legacy-import-parser";

/* ─── Column mapping fields ─── */
const FIELD_DEFS = [
  { key: "invoice_number", label: "Invoice Number", required: true },
  { key: "order_date", label: "Order Date" },
  { key: "customer_name", label: "Customer Name" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "district", label: "District" },
  { key: "thana", label: "Thana" },
  { key: "products", label: "Products (comma-separated)", required: true },
  { key: "sku", label: "SKU (comma-separated)" },
  { key: "unit_price", label: "Unit Price" },
  { key: "collectable_amount", label: "Collectable Amount (Customer Total)" },
  { key: "customer_shipping", label: "Delivery Charge (Customer)" },
  { key: "advance", label: "Advance (Prepaid Amount)" },
  { key: "partial_amount", label: "Partial Amount" },
  { key: "courier_name", label: "Courier Name" },
  { key: "tracking_id", label: "Tracking ID" },
  { key: "status", label: "Status" },
  { key: "delivered_date", label: "Delivered Date" },
  { key: "returned_date", label: "Returned Date" },
] as const;

/* Fields auto-filled by courier sync — shown as info, always skipped */
const COURIER_AUTO_FIELDS = [
  { key: "cod_charge", label: "COD Charge" },
  { key: "courier_delivery_fee", label: "Courier Delivery Fee" },
  { key: "courier_discount", label: "Courier Discount" },
  { key: "courier_total_cost", label: "Courier Total Cost" },
  { key: "courier_net_payable", label: "Courier Net Payable" },
];

type FieldKey = (typeof FIELD_DEFS)[number]["key"];

export default function ImportLegacyOrders() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing" | "done">("upload");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ total: 0, success: 0, failed: 0, skuMismatch: 0, qtyMismatch: 0, duplicates: 0, batchId: "" });
  const [allErrors, setAllErrors] = useState<ValidationError[]>([]);
  const [allWarnings, setAllWarnings] = useState<ValidationWarning[]>([]);
  const [validatedOrders, setValidatedOrders] = useState<ValidatedOrder[]>([]);
  const [strictSkuMatch, setStrictSkuMatch] = useState(true);

  /* ─── Step 1: File Upload ─── */
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
      for (const fd of FIELD_DEFS) {
        const norm = fd.key.toLowerCase().replace(/_/g, "");
        const match = headers.find((h) => h.toLowerCase().replace(/[\s_-]/g, "") === norm);
        if (match) autoMap[fd.key] = match;
      }
      setMappings(autoMap);
      setStep("map");
    };
    reader.readAsBinaryString(f);
  }, [toast]);

  const setMapping = (field: string, header: string) => {
    setMappings((prev) => ({ ...prev, [field]: header === "__skip__" ? "" : header }));
  };

  /* ─── Step 2 → 3: Parse & Validate ─── */
  const handlePreview = useCallback(async () => {
    // Fetch known SKUs
    const { data: products } = await supabase.from("products").select("id, sku");
    const knownSkus = new Set((products || []).map((p) => (p.sku || "").toUpperCase()));

    // Fetch existing invoice numbers (legacy)
    const { data: existingOrders } = await (supabase.from("orders").select("order_number") as any)
      .eq("order_source", "LEGACY");
    const existingInvoices = new Set<string>((existingOrders || []).map((o: any) => String(o.order_number)));

    const seenInvoices = new Set<string>();
    const validated: ValidatedOrder[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const g = (key: string) => {
        const col = mappings[key];
        return col ? String(row[col] ?? "").trim() : "";
      };
      const gn = (key: string) => Number(g(key)) || 0;

      const parsed: ParsedOrderRow = {
        invoiceNumber: g("invoice_number"),
        orderDate: parseExcelDate(mappings["order_date"] ? row[mappings["order_date"]] : ""),
        customerName: g("customer_name"),
        phone: g("phone"),
        address: g("address"),
        district: g("district"),
        thana: g("thana"),
        products: parseProductsCell(g("products")),
        skus: parseSkusCell(g("sku")),
        unitPrice: gn("unit_price"),
        customerTotal: gn("collectable_amount"),
        customerShipping: gn("customer_shipping"),
        courierCodFee: 0,        // Always 0 — sourced from courier sync
        courierDeliveryFee: 0,   // Always 0 — sourced from courier sync
        advance: gn("advance"),
        partialAmount: gn("partial_amount"),
        courierName: g("courier_name"),
        trackingId: g("tracking_id"),
        rawStatus: g("status"),
        mappedStatus: mapStatus(g("status")),
        deliveredDate: parseExcelDate(mappings["delivered_date"] ? row[mappings["delivered_date"]] : ""),
        returnedDate: parseExcelDate(mappings["returned_date"] ? row[mappings["returned_date"]] : ""),
      };

      validated.push(validateOrder(parsed, i + 2, existingInvoices, knownSkus, seenInvoices, strictSkuMatch));
    }

    setValidatedOrders(validated);
    setAllErrors(validated.flatMap((v) => v.errors));
    setAllWarnings(validated.flatMap((v) => v.warnings));
    setStep("preview");
  }, [rawData, mappings, strictSkuMatch]);

  const validCount = useMemo(() => validatedOrders.filter((v) => v.isValid).length, [validatedOrders]);
  const invalidCount = useMemo(() => validatedOrders.filter((v) => !v.isValid).length, [validatedOrders]);

  /* ─── Step 4: Import ─── */
  const handleImport = async () => {
    setStep("importing");
    setProgress(0);

    const batchId = crypto.randomUUID();
    let success = 0;
    let failed = 0;
    let skuMismatch = 0;
    let qtyMismatch = 0;
    let duplicates = 0;
    const importErrors: ValidationError[] = [];
    const validOnly = validatedOrders.filter((v) => v.isValid);

    // Pre-fetch SKU → product_id map
    const { data: products } = await supabase.from("products").select("id, sku");
    const skuMap = new Map((products || []).map((p) => [(p.sku || "").toUpperCase(), p.id]));

    for (let i = 0; i < validOnly.length; i++) {
      const { row } = validOnly[i];
      try {
        // Find/create customer
        const phone = row.phone;
        let customerId: string | null = null;
        if (phone) {
          const { data: cust } = await supabase.from("customers").select("id").eq("phone", phone).maybeSingle();
          if (cust) {
            customerId = cust.id;
          } else {
            const { data: newCust } = await supabase
              .from("customers")
              .insert({ full_name: row.customerName || "Unknown", phone, address: row.address || null, district: row.district || null, thana: row.thana || null, source: "legacy_import" })
              .select("id")
              .single();
            customerId = newCust?.id || null;
          }
        }

        const orderNumber = row.invoiceNumber || `LGC-${crypto.randomUUID().slice(0, 8)}`;
        const subtotal = row.products.reduce((s, p) => s + p.qty * row.unitPrice, 0);

        const { data: newOrder, error: orderErr } = await supabase
          .from("orders")
          .insert({
            order_number: orderNumber,
            channel: "legacy",
            order_source: "LEGACY",
            legacy_order_id: row.invoiceNumber,
            legacy_import_batch_id: batchId,
            posting_mode: "DISABLED",
            inventory_mode: "DISABLED",
            courier_mode: "DISABLED",
            legacy_finalized: false,
            legacy_status: row.rawStatus || null,   // Preserved read-only
            customer_id: customerId,
            order_date: row.orderDate || new Date().toISOString().slice(0, 10),
            delivery_address: row.address || null,
            delivery_district: row.district || null,
            delivery_thana: row.thana || null,
            delivery_charge: row.customerShipping || 0,
            subtotal,
            total_amount: row.customerTotal || subtotal + (row.customerShipping || 0),
            payment_method: "cod",
            status: row.mappedStatus,
            legacy_courier_name: row.courierName || null,
            legacy_tracking_id: row.trackingId || null,
            legacy_courier_status: row.rawStatus || null,
            advance_amount: row.advance || 0,
            legacy_delivered_date: row.deliveredDate || null,
            legacy_returned_date: row.returnedDate || null,
          } as any)
          .select("id")
          .single();

        if (orderErr) throw orderErr;

        // Insert order items — one per parsed product
        for (let pi = 0; pi < row.products.length; pi++) {
          const prod = row.products[pi];
          const sku = row.skus[pi] || "";
          const productId = sku ? skuMap.get(sku.toUpperCase()) || null : null;

          await supabase.from("order_items").insert({
            order_id: newOrder!.id,
            product_id: productId,
            quantity: prod.qty,
            unit_price: row.unitPrice || 0,
            total_price: prod.qty * (row.unitPrice || 0),
            product_name_fallback: prod.productName || sku || "Legacy Item",
          });
        }

        success++;
      } catch (err: any) {
        failed++;
        importErrors.push({ row: validOnly[i].rowIndex, invoiceNumber: row.invoiceNumber, field: "import", message: err.message });
      }
      setProgress(Math.round(((i + 1) / validOnly.length) * 100));
    }

    // Count specific error types from pre-validation
    const preErrors = validatedOrders.filter((v) => !v.isValid);
    for (const v of preErrors) {
      for (const e of v.errors) {
        if (e.field === "sku" && e.message.includes("count")) skuMismatch++;
        if (e.field === "qty") qtyMismatch++;
        if (e.field === "invoice_number" && e.message.includes("Duplicate")) duplicates++;
      }
    }

    // Save batch
    await supabase.from("legacy_import_batches" as any).insert({
      id: batchId,
      file_name: file?.name || "unknown",
      total_rows: validatedOrders.length,
      imported_count: success,
      failed_count: failed + invalidCount,
      duplicate_count: duplicates,
      errors: [...allErrors, ...importErrors].map((e) => `Row ${e.row}: [${e.field}] ${e.message}`),
      status: "completed",
    });

    setResults({ total: validatedOrders.length, success, failed: failed + invalidCount, skuMismatch, qtyMismatch, duplicates, batchId });
    setAllErrors((prev) => [...prev, ...importErrors]);
    setStep("done");
    toast({ title: `Import complete: ${success} orders imported` });
  };

  const handleDownloadErrors = () => {
    if (allErrors.length === 0) return;
    const csv = generateErrorCsv(allErrors);
    downloadCsv(csv, `import-errors-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import Legacy Orders</h1>
          <p className="text-sm text-muted-foreground">Smart parser: auto-splits products & SKUs, validates totals, maps statuses.</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2">
        {["Upload", "Map Columns", "Validate & Preview", "Import"].map((s, i) => (
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
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Upload Excel File</CardTitle>
            <CardDescription>Supported: .xlsx, .xls, .csv</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="legacy-file" className="cursor-pointer">
              <div className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary transition-colors">
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">Click or drag to upload</p>
                <p className="text-sm text-muted-foreground mt-1">Excel file with legacy order data</p>
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
              {rawData.length} rows found in "{file?.name}". Map your spreadsheet columns to system fields.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FIELD_DEFS.map((fd) => (
                <div key={fd.key} className="flex items-center gap-2">
                  <Label className="w-48 text-xs font-mono shrink-0">
                    {fd.label}
                    {"required" in fd && fd.required && <span className="text-destructive ml-0.5">*</span>}
                  </Label>
                  <Select value={mappings[fd.key] || "__skip__"} onValueChange={(v) => setMapping(fd.key, v)}>
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
                  {mappings[fd.key] && <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />}
                </div>
              ))}
            </div>

            {/* Auto-filled by Courier section */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 mt-4">
              <p className="text-xs font-semibold text-amber-800 mb-2">🚚 Auto-filled by Courier Sync / Statement Import</p>
              <p className="text-[11px] text-amber-700 mb-2">These fields are never imported from Excel. They will be populated automatically when courier data is synced or statements are imported.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {COURIER_AUTO_FIELDS.map((f) => (
                  <div key={f.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 bg-amber-100 text-amber-700">Skip</Badge>
                    <span>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Parsing hint */}
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1 mt-4">
              <p className="font-semibold text-foreground">Smart Parsing Rules:</p>
              <p>• <strong>Products:</strong> Split by comma. Pattern <code>2x Product Name</code> extracts qty=2. No prefix → qty=1.</p>
              <p>• <strong>SKUs:</strong> Split by comma, matched 1:1 with products by position.</p>
              <p>• <strong>Status:</strong> Auto-mapped (Delivered→DELIVERED, Return→RETURNED, Partial→PARTIAL_DELIVERED, etc.)</p>
              <p>• <strong>Legacy Status:</strong> Original status from Excel is preserved in a read-only field and never overwritten.</p>
            </div>

            {/* Validation toggles */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 mt-4">
              <p className="text-xs font-semibold text-foreground mb-2">Validation Settings</p>
              <div className="flex items-center gap-3">
                <Switch checked={strictSkuMatch} onCheckedChange={setStrictSkuMatch} id="strict-sku" />
                <Label htmlFor="strict-sku" className="text-xs cursor-pointer">
                  Strict SKU-Product match validation
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  {strictSkuMatch
                    ? "Errors when SKU count ≠ product count"
                    : "If 1 SKU & multiple products → same SKU applied to all (warning)"}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button onClick={handlePreview} disabled={!mappings.invoice_number || !mappings.products}>
                Validate & Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview with validation */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Validation Results</CardTitle>
            <CardDescription>
              {validatedOrders.length} rows parsed. <span className="text-green-600 font-medium">{validCount} valid</span>,{" "}
              <span className="text-destructive font-medium">{invalidCount} with errors</span>.
              Only valid rows will be imported.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error summary */}
            {allErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> {allErrors.length} validation error(s)
                  </p>
                  <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                    <Download className="w-3 h-3 mr-1" /> Download Error Report
                  </Button>
                </div>
                <div className="max-h-[150px] overflow-y-auto space-y-1">
                  {allErrors.slice(0, 20).map((e, i) => (
                    <p key={i} className="text-xs text-destructive">
                      Row {e.row}: [{e.field}] {e.message}
                    </p>
                  ))}
                  {allErrors.length > 20 && (
                    <p className="text-xs text-muted-foreground">...and {allErrors.length - 20} more. Download CSV for full list.</p>
                  )}
                </div>
              </div>
            )}

            {/* Warning summary */}
            {allWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-300/50 bg-amber-50/50 p-3 space-y-2">
                <p className="text-sm font-medium text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> {allWarnings.length} warning(s)
                </p>
                <div className="max-h-[100px] overflow-y-auto space-y-1">
                  {allWarnings.slice(0, 10).map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">
                      Row {w.row}: [{w.field}] {w.message}
                    </p>
                  ))}
                  {allWarnings.length > 10 && (
                    <p className="text-xs text-muted-foreground">...and {allWarnings.length - 10} more.</p>
                  )}
                </div>
              </div>
            )}

            {/* Preview table */}
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>SKUs</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validatedOrders.slice(0, 100).map((v) => (
                    <TableRow key={v.rowIndex} className={v.isValid ? "" : "bg-destructive/5"}>
                      <TableCell>
                        {v.isValid
                          ? <CheckCircle className="w-4 h-4 text-green-600" />
                          : <XCircle className="w-4 h-4 text-destructive" />}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{v.row.invoiceNumber}</TableCell>
                      <TableCell className="text-xs">{v.row.orderDate}</TableCell>
                      <TableCell className="text-sm">{v.row.customerName}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {v.row.products.map((p) => `${p.qty}x ${p.productName}`).join(", ")}
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-[120px] truncate">
                        {v.row.skus.join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">৳{v.row.customerTotal}</TableCell>
                      <TableCell>
                        <Badge variant={v.row.mappedStatus === "delivered" ? "default" : "secondary"} className="text-xs">
                          {v.row.mappedStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {validatedOrders.length > 100 && (
                <p className="text-xs text-muted-foreground text-center py-2">Showing first 100 of {validatedOrders.length} rows</p>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                <Upload className="w-4 h-4 mr-1" /> Import {validCount} Valid Orders
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
            <CardTitle className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" /> Import Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Total Rows", value: results.total, color: "bg-muted/50" },
                { label: "Success", value: results.success, color: "bg-green-500/10 text-green-700" },
                { label: "Failed", value: results.failed, color: "bg-destructive/10 text-destructive" },
                { label: "SKU Mismatch", value: results.skuMismatch, color: "bg-amber-500/10 text-amber-700" },
                { label: "Qty Errors", value: results.qtyMismatch, color: "bg-orange-500/10 text-orange-700" },
                { label: "Duplicates", value: results.duplicates, color: "bg-blue-500/10 text-blue-700" },
              ].map((stat) => (
                <div key={stat.label} className={`text-center p-3 rounded-lg ${stat.color}`}>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {allErrors.length > 0 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                  <Download className="w-4 h-4 mr-1" /> Download Error Report CSV
                </Button>
                <span className="text-xs text-muted-foreground">{allErrors.length} error(s) logged</span>
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
