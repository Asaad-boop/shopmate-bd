import { useState, useRef, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet, Check, AlertTriangle, X, Download, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";

interface CustomerImportModalProps {
  open: boolean;
  onClose: () => void;
}

interface ParsedRow {
  [key: string]: string;
}

interface MappedRow {
  full_name: string;
  phone: string;
  address?: string;
  district?: string;
  total_spent?: number;
  last_order_date?: string;
  tags?: string[];
  notes?: string;
}

interface ValidationResult {
  valid: MappedRow[];
  duplicatesInDb: MappedRow[];
  duplicatesInFile: MappedRow[];
  invalid: { row: MappedRow; reason: string }[];
}

const SYSTEM_FIELDS = [
  { key: "full_name", label: "Name *", required: true },
  { key: "phone", label: "Phone *", required: true },
  { key: "address", label: "Address" },
  { key: "district", label: "City / District" },
  { key: "total_spent", label: "Total Spent" },
  { key: "last_order_date", label: "Last Order Date" },
  { key: "tags", label: "Tags" },
  { key: "notes", label: "Notes" },
  { key: "__skip__", label: "— Skip —" },
];

const AUTO_MAP: Record<string, string> = {
  name: "full_name", "customer name": "full_name", "full name": "full_name", "full_name": "full_name",
  phone: "phone", mobile: "phone", "phone number": "phone", "mobile number": "phone", tel: "phone",
  address: "address", "delivery address": "address",
  city: "district", district: "district", area: "district",
  "total spent": "total_spent", "amount spent": "total_spent", total_spent: "total_spent", spent: "total_spent",
  "last order": "last_order_date", "last purchase": "last_order_date", last_order_date: "last_order_date",
  tags: "tags", label: "tags", labels: "tags",
  notes: "notes", note: "notes", remark: "notes", remarks: "notes", comment: "notes",
};

function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s\-\(\)\.]+/g, "");
  if (p.startsWith("+880")) p = "0" + p.slice(4);
  if (p.startsWith("880")) p = "0" + p.slice(3);
  if (p.startsWith("1") && p.length === 10) p = "0" + p;
  return p;
}

function isValidBDPhone(phone: string): boolean {
  return /^01[3-9]\d{8}$/.test(phone);
}

export function CustomerImportModal({ open, onClose }: CustomerImportModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [rawData, setRawData] = useState<ParsedRow[]>([]);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "update">("skip");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; failed: number; errors: { row: MappedRow; reason: string }[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setStep(1);
    setFileName("");
    setRawData([]);
    setFileColumns([]);
    setMapping({});
    setValidation(null);
    setDuplicateAction("skip");
    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const parseFile = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "❌ File too large", description: "Maximum 10MB allowed", variant: "destructive" });
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: ParsedRow[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (json.length === 0) {
          toast({ title: "❌ Empty file", variant: "destructive" });
          return;
        }
        const cols = Object.keys(json[0]);
        setRawData(json);
        setFileColumns(cols);

        // Auto-map columns
        const autoMapping: Record<string, string> = {};
        cols.forEach((col) => {
          const normalized = col.toLowerCase().trim();
          if (AUTO_MAP[normalized]) {
            autoMapping[col] = AUTO_MAP[normalized];
          }
        });
        setMapping(autoMapping);
        setStep(2);
      } catch {
        toast({ title: "❌ Could not parse file", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const mappedData = useMemo((): MappedRow[] => {
    return rawData.map((row) => {
      const mapped: any = {};
      Object.entries(mapping).forEach(([fileCol, sysField]) => {
        if (sysField === "__skip__") return;
        const val = String(row[fileCol] || "").trim();
        if (sysField === "phone") {
          mapped.phone = normalizePhone(val);
        } else if (sysField === "total_spent") {
          mapped.total_spent = parseFloat(val.replace(/[^\d.]/g, "")) || 0;
        } else if (sysField === "tags") {
          mapped.tags = val.split(/[,;|]/).map((t: string) => t.trim()).filter(Boolean);
        } else {
          mapped[sysField] = val;
        }
      });
      return mapped as MappedRow;
    });
  }, [rawData, mapping]);

  const handleValidate = async () => {
    const rows = mappedData;
    const valid: MappedRow[] = [];
    const invalid: { row: MappedRow; reason: string }[] = [];
    const duplicatesInFile: MappedRow[] = [];
    const duplicatesInDb: MappedRow[] = [];

    // Check required fields
    const phonesSeen = new Set<string>();
    const validPhoneRows: MappedRow[] = [];

    rows.forEach((r) => {
      if (!r.full_name || !r.phone) {
        invalid.push({ row: r, reason: "Missing name or phone" });
      } else if (!isValidBDPhone(r.phone)) {
        invalid.push({ row: r, reason: `Invalid phone: ${r.phone}` });
      } else if (phonesSeen.has(r.phone)) {
        duplicatesInFile.push(r);
      } else {
        phonesSeen.add(r.phone);
        validPhoneRows.push(r);
      }
    });

    // Check against DB
    const phones = validPhoneRows.map((r) => r.phone);
    const batchSize = 200;
    const existingPhones = new Set<string>();

    for (let i = 0; i < phones.length; i += batchSize) {
      const batch = phones.slice(i, i + batchSize);
      const { data } = await supabase.from("customers").select("phone").in("phone", batch);
      (data || []).forEach((c) => existingPhones.add(c.phone));
    }

    validPhoneRows.forEach((r) => {
      if (existingPhones.has(r.phone)) {
        duplicatesInDb.push(r);
      } else {
        valid.push(r);
      }
    });

    setValidation({ valid, duplicatesInDb, duplicatesInFile, invalid });
    setStep(3);
  };

  const handleImport = async () => {
    if (!validation) return;
    setImporting(true);

    const toImport = [...validation.valid];
    if (duplicateAction === "update") {
      toImport.push(...validation.duplicatesInDb);
    }

    const batchId = crypto.randomUUID();
    const total = toImport.length;
    setImportProgress({ current: 0, total });

    let imported = 0;
    let skipped = validation.duplicatesInFile.length + (duplicateAction === "skip" ? validation.duplicatesInDb.length : 0);
    let failed = validation.invalid.length;
    const errors: { row: MappedRow; reason: string }[] = [...validation.invalid];
    const batchSize = 100;

    for (let i = 0; i < toImport.length; i += batchSize) {
      const batch = toImport.slice(i, i + batchSize).map((r) => ({
        full_name: r.full_name,
        phone: r.phone,
        address: r.address || null,
        district: r.district || null,
        total_spent: r.total_spent || 0,
        last_order_date: r.last_order_date || null,
        tags: r.tags || [],
        notes: r.notes || null,
        source: "imported",
        imported_at: new Date().toISOString(),
        import_batch_id: batchId,
      }));

      if (duplicateAction === "update") {
        const { error } = await supabase.from("customers").upsert(batch as any, { onConflict: "phone" });
        if (error) {
          batch.forEach((b) => errors.push({ row: b as any, reason: error.message }));
          failed += batch.length;
        } else {
          imported += batch.length;
        }
      } else {
        const { error } = await supabase.from("customers").insert(batch as any);
        if (error) {
          // Try one by one for partial success
          for (const row of batch) {
            const { error: singleErr } = await supabase.from("customers").insert(row as any);
            if (singleErr) {
              errors.push({ row: row as any, reason: singleErr.message });
              failed++;
            } else {
              imported++;
            }
          }
        } else {
          imported += batch.length;
        }
      }

      setImportProgress({ current: Math.min(i + batchSize, total), total });
    }

    // Save batch record
    await (supabase as any).from("import_batches").insert({
      id: batchId,
      file_name: fileName,
      total_rows: rawData.length,
      imported_count: imported,
      skipped_count: skipped,
      failed_count: failed,
      duplicate_action: duplicateAction,
    });

    setImportResult({ imported, skipped, failed, errors });
    setImporting(false);
    setStep(4);
    qc.invalidateQueries({ queryKey: ["crm-customers"] });
    toast({ title: `✅ Imported ${imported} customers` });
  };

  const downloadSampleCSV = () => {
    const csv = "name,phone,address,city,total_spent,last_order_date,tags,notes\nKarim Hossain,01712345678,Dhanmondi Road 5,Dhaka,15000,2025-12-01,vip;loyal,Great customer\nRahima Begum,01898765432,Mirpur 10,Dhaka,3500,2026-01-15,new,First time buyer";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customer_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadErrorReport = () => {
    if (!importResult) return;
    const rows = importResult.errors.map((e) => ({
      name: e.row.full_name,
      phone: e.row.phone,
      reason: e.reason,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "import_errors.xlsx");
  };

  const requiredFieldsMapped = mapping && Object.values(mapping).includes("full_name") && Object.values(mapping).includes("phone");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📥 Import Customers
            <Badge variant="outline" className="text-[10px]">Step {step}/4</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 mb-2">
          {["Upload", "Map", "Preview", "Import"].map((label, i) => (
            <div key={label} className="flex items-center gap-1 flex-1">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                step > i + 1 ? "bg-green-500 text-white" : step === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={cn("text-[10px]", step === i + 1 ? "font-semibold" : "text-muted-foreground")}>{label}</span>
              {i < 3 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* STEP 1: Upload */}
        {step === 1 && (
          <div className="space-y-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-semibold">Drag & drop your file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              <p className="text-[10px] text-muted-foreground mt-3">Supports CSV, Excel (.xlsx, .xls) • Max 10MB</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
            <Button variant="link" size="sm" onClick={downloadSampleCSV} className="text-xs">
              <Download className="w-3 h-3 mr-1" /> Download Sample CSV Template
            </Button>
          </div>
        )}

        {/* STEP 2: Column Mapping */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="w-4 h-4" />
              <span>{fileName} • {rawData.length} rows detected</span>
            </div>

            <div className="space-y-2">
              {fileColumns.map((col) => (
                <div key={col} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
                  <span className="text-sm font-medium flex-1 truncate">"{col}"</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Select
                    value={mapping[col] || "__skip__"}
                    onValueChange={(v) => setMapping({ ...mapping, [col]: v })}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYSTEM_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapping[col] && mapping[col] !== "__skip__" && (
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {!requiredFieldsMapped && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Name and Phone are required fields
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleValidate} disabled={!requiredFieldsMapped}>
                Preview & Validate <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3: Preview & Validate */}
        {step === 3 && validation && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-green-700">{validation.valid.length}</p>
                  <p className="text-[10px] text-green-600">✅ Ready to import</p>
                </CardContent>
              </Card>
              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-orange-700">{validation.duplicatesInDb.length + validation.duplicatesInFile.length}</p>
                  <p className="text-[10px] text-orange-600">⚠️ Duplicates</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-red-700">{validation.invalid.length}</p>
                  <p className="text-[10px] text-red-600">❌ Invalid</p>
                </CardContent>
              </Card>
            </div>

            {/* Duplicate action */}
            {validation.duplicatesInDb.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-orange-50/50 border-orange-200">
                <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <span className="text-xs flex-1">{validation.duplicatesInDb.length} customers already exist in DB</span>
                <Select value={duplicateAction} onValueChange={(v: "skip" | "update") => setDuplicateAction(v)}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip duplicates</SelectItem>
                    <SelectItem value="update">Update existing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Preview table */}
            <div className="border rounded-lg overflow-auto max-h-[250px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Status</TableHead>
                    <TableHead className="text-[10px]">Name</TableHead>
                    <TableHead className="text-[10px]">Phone</TableHead>
                    <TableHead className="text-[10px]">City</TableHead>
                    <TableHead className="text-[10px]">Spent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ...validation.valid.slice(0, 5).map((r) => ({ ...r, _status: "valid" as const })),
                    ...validation.duplicatesInDb.slice(0, 3).map((r) => ({ ...r, _status: "duplicate" as const })),
                    ...validation.invalid.slice(0, 2).map((e) => ({ ...e.row, _status: "invalid" as const, _reason: e.reason })),
                  ].map((r, i) => (
                    <TableRow key={i} className={cn(
                      r._status === "invalid" && "bg-red-50",
                      r._status === "duplicate" && "bg-orange-50"
                    )}>
                      <TableCell>
                        {r._status === "valid" && <Badge className="bg-green-100 text-green-800 text-[9px]">✅</Badge>}
                        {r._status === "duplicate" && <Badge className="bg-orange-100 text-orange-800 text-[9px]">⚠️</Badge>}
                        {r._status === "invalid" && <Badge className="bg-red-100 text-red-800 text-[9px]">❌</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{r.full_name}</TableCell>
                      <TableCell className="text-xs font-mono">{r.phone}</TableCell>
                      <TableCell className="text-xs">{r.district || "—"}</TableCell>
                      <TableCell className="text-xs">৳{(r.total_spent || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button
                onClick={handleImport}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={validation.valid.length === 0 && (duplicateAction === "skip" || validation.duplicatesInDb.length === 0)}
              >
                🚀 Import {duplicateAction === "update"
                  ? validation.valid.length + validation.duplicatesInDb.length
                  : validation.valid.length} Customers
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3.5: Importing progress */}
        {step === 3 && importing && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-3" />
              <p className="text-sm font-semibold">Importing...</p>
              <p className="text-xs text-muted-foreground mt-1">
                {importProgress.current} / {importProgress.total}
              </p>
            </div>
            <Progress value={(importProgress.current / Math.max(importProgress.total, 1)) * 100} />
          </div>
        )}

        {/* STEP 4: Results */}
        {step === 4 && importResult && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-lg font-bold">Import Complete!</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-green-700">{importResult.imported}</p>
                  <p className="text-[10px] text-green-600">✅ Imported</p>
                </CardContent>
              </Card>
              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-orange-700">{importResult.skipped}</p>
                  <p className="text-[10px] text-orange-600">⚠️ Skipped</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-bold text-red-700">{importResult.failed}</p>
                  <p className="text-[10px] text-red-600">❌ Failed</p>
                </CardContent>
              </Card>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {importResult.errors.length > 0 && (
                <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Error Report
                </Button>
              )}
              <Button onClick={handleClose}>Go to Customer List</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
