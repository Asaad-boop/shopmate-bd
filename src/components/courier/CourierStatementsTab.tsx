import { useState, useRef } from "react";
import { useCouriers, useCourierStatements, useStatementLines, useImportStatement } from "@/hooks/use-courier";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBDT, formatDate } from "@/lib/format";
import { Upload, FileSpreadsheet, Eye, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "@/hooks/use-toast";

const COLUMN_KEYS = ["tracking_id", "order_id", "delivery_status", "customer_total_amount", "delivery_fee", "cod_fee", "discount", "total_cost", "net_payable", "return_cost", "payout_amount"] as const;

export function CourierStatementsTab() {
  const { data: couriers } = useCouriers();
  const { data: statements, isLoading } = useCourierStatements();
  const importStmt = useImportStatement();

  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState<{ headers: string[]; rows: any[] } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importForm, setImportForm] = useState({ courier_id: "", date_from: "", date_to: "", ref: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const [viewId, setViewId] = useState<string | null>(null);
  const { data: viewLines } = useStatementLines(viewId);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (json.length < 2) { toast({ title: "Empty file", variant: "destructive" }); return; }
        const headers = json[0].map(String);
        const rows = json.slice(1).map((row) => {
          const obj: any = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        });
        setImportData({ headers, rows });
        // Auto-map by name match
        const autoMap: Record<string, string> = {};
        COLUMN_KEYS.forEach((key) => {
          const found = headers.find((h) => h.toLowerCase().replace(/[\s_-]/g, "") === key.replace(/_/g, ""));
          if (found) autoMap[key] = found;
        });
        setMapping(autoMap);
        setImportForm({ ...importForm, ref: file.name });
      } catch {
        toast({ title: "Failed to parse file", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = () => {
    if (!importForm.courier_id || !importForm.date_from || !importForm.date_to || !importData) return;
    const lines = importData.rows.map((row) => {
      const mapped: any = {};
      COLUMN_KEYS.forEach((key) => {
        const col = mapping[key];
        if (col && row[col] !== undefined) {
          mapped[key] = ["tracking_id", "order_id", "delivery_status"].includes(key)
            ? String(row[col])
            : Number(row[col]) || 0;
        }
      });
      return mapped;
    }).filter((l) => l.tracking_id);

    importStmt.mutate({
      courier_id: importForm.courier_id,
      statement_date_from: importForm.date_from,
      statement_date_to: importForm.date_to,
      statement_ref: importForm.ref,
      lines,
    });
    setShowImport(false);
    setImportData(null);
  };

  const matchBadge = (status: string) => {
    if (status === "matched") return <Badge className="bg-emerald-100 text-emerald-800 text-[10px]"><CheckCircle className="w-3 h-3 mr-0.5" />Matched</Badge>;
    if (status === "mismatch") return <Badge className="bg-orange-100 text-orange-800 text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" />Mismatch</Badge>;
    return <Badge variant="secondary" className="text-[10px]"><XCircle className="w-3 h-3 mr-0.5" />Unmatched</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Courier Statements</CardTitle>
          <Button size="sm" onClick={() => setShowImport(true)}><Upload className="w-3.5 h-3.5 mr-1" /> Import</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Courier</TableHead>
                  <TableHead className="text-xs">Period</TableHead>
                  <TableHead className="text-xs">Ref</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Imported</TableHead>
                  <TableHead className="text-xs w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(statements || []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{s.couriers?.name}</TableCell>
                    <TableCell className="text-xs">{formatDate(s.statement_date_from)} — {formatDate(s.statement_date_to)}</TableCell>
                    <TableCell className="text-xs font-mono">{s.statement_ref || "-"}</TableCell>
                    <TableCell><Badge variant={s.status === "matched" ? "default" : "secondary"} className="text-[10px]">{s.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(s.imported_at)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewId(s.id)}><Eye className="w-3.5 h-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Import Courier Statement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Courier</Label>
                <Select value={importForm.courier_id} onValueChange={(v) => setImportForm({ ...importForm, courier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select courier" /></SelectTrigger>
                  <SelectContent>
                    {(couriers || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Reference</Label>
                <Input value={importForm.ref} onChange={(e) => setImportForm({ ...importForm, ref: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Date From</Label>
                <Input type="date" value={importForm.date_from} onChange={(e) => setImportForm({ ...importForm, date_from: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Date To</Label>
                <Input type="date" value={importForm.date_to} onChange={(e) => setImportForm({ ...importForm, date_to: e.target.value })} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Upload CSV/Excel</Label>
              <Input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} />
            </div>

            {importData && (
              <>
                <div className="text-sm font-medium">Column Mapping ({importData.rows.length} rows)</div>
                <div className="grid grid-cols-2 gap-2">
                  {COLUMN_KEYS.map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs w-32 text-muted-foreground truncate">{key}</span>
                      <Select value={mapping[key] || ""} onValueChange={(v) => setMapping({ ...mapping, [key]: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— skip —</SelectItem>
                          {importData.headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleImport} disabled={!importData || !importForm.courier_id || importStmt.isPending}>
              <Upload className="w-3.5 h-3.5 mr-1" /> Import & Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Lines Dialog */}
      <Dialog open={!!viewId} onOpenChange={() => setViewId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Statement Lines</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Tracking</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Total Cost</TableHead>
                <TableHead className="text-xs">Net Payable</TableHead>
                <TableHead className="text-xs">Match</TableHead>
                <TableHead className="text-xs">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(viewLines || []).map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs font-mono">{l.tracking_id || "-"}</TableCell>
                  <TableCell className="text-xs">{l.delivery_status || "-"}</TableCell>
                  <TableCell className="text-xs">{formatBDT(l.total_cost)}</TableCell>
                  <TableCell className="text-xs">{formatBDT(l.net_payable)}</TableCell>
                  <TableCell>{matchBadge(l.match_status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{l.mismatch_reason || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </>
  );
}
