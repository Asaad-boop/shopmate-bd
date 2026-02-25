import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDateTime } from "@/lib/format";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Package, Truck, RotateCcw, ScanLine, CheckCircle2,
  XCircle, Loader2, Volume2, Printer, AlertTriangle,
  Wifi, RefreshCw, Barcode,
} from "lucide-react";

/* ── Sound effects via Web Audio API ── */
const audioCtx = typeof window !== "undefined" ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playBeep(freq: number, duration: number, type: OscillatorType = "sine") {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);
    osc.stop(audioCtx.currentTime + duration / 1000);
  } catch { /* ignore audio errors */ }
}

function playSuccess() { playBeep(880, 150); setTimeout(() => playBeep(1320, 200), 160); }
function playError() { playBeep(220, 300, "square"); }

/* ── Status color map ── */
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  packed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  shipped: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  in_transit: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  returned: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

/* ── Scan mode config ── */
type ScanModeType = "pack" | "ship" | "return" | "verify";

const SCAN_MODES: { key: ScanModeType; label: string; icon: any; action: string; targetStatus: string }[] = [
  { key: "pack", label: "Packing", icon: Package, action: "pack", targetStatus: "packed" },
  { key: "ship", label: "Dispatch", icon: Truck, action: "ship", targetStatus: "shipped" },
  { key: "verify", label: "Verify", icon: Wifi, action: "", targetStatus: "" },
  { key: "return", label: "Return", icon: RotateCcw, action: "return", targetStatus: "returned" },
];

/* ── Scan history entry ── */
interface ScanEntry {
  id: string;
  timestamp: Date;
  scanText: string;
  invoiceId: string;
  customerName: string;
  action: string;
  success: boolean;
  message: string;
}

/* ── Main Component ── */
export default function ScanToUpdate() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ScanModeType>("pack");
  const [scanInput, setScanInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Settings
  const [autoPrint, setAutoPrint] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [returnReason, setReturnReason] = useState("undelivered");

  // History & stats
  const [history, setHistory] = useState<ScanEntry[]>([]);

  // Stats
  const todayStats = useMemo(() => {
    const today = new Date().toDateString();
    const todayEntries = history.filter((h) => h.timestamp.toDateString() === today && h.success);
    return {
      scans: todayEntries.length,
      packed: todayEntries.filter((h) => h.action === "pack").length,
      shipped: todayEntries.filter((h) => h.action === "ship").length,
      returned: todayEntries.filter((h) => h.action === "return").length,
    };
  }, [history]);

  // Keep input focused
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.activeElement !== inputRef.current && !scanning) {
        inputRef.current?.focus();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [scanning]);

  // Focus on mode change
  useEffect(() => {
    inputRef.current?.focus();
    setLastResult(null);
    setLastError(null);
    setLastAction(null);
  }, [mode]);

  // ── Scan handler ──
  const handleScan = useCallback(async () => {
    const text = scanInput.trim();
    if (!text) return;
    setScanInput("");
    setScanning(true);
    setLastError(null);
    setLastAction(null);

    try {
      // Step 1: Find order
      const { data: rawData, error: findError } = await supabase.rpc("find_order_by_scan", { p_scan_text: text });
      const orderData = rawData as any;
      if (findError) throw findError;
      if (!orderData) {
        setLastResult(null);
        setLastError(`No order found for "${text}"`);
        if (soundEnabled) playError();
        addHistory(text, "", "", mode, false, "Not found");
        setScanning(false);
        inputRef.current?.focus();
        return;
      }

      setLastResult(orderData);

      // Verify mode: just show info, no action
      if (mode === "verify") {
        if (soundEnabled) playSuccess();
        addHistory(text, orderData.invoice_id || "", orderData.customer_name || "", "verify", true, `Status: ${orderData.status}`);
        setScanning(false);
        inputRef.current?.focus();
        return;
      }

      // Step 2: Apply action
      const modeConfig = SCAN_MODES.find((m) => m.key === mode)!;
      const reason = mode === "return" ? returnReason : undefined;

      const { data: rawAction, error: actionError } = await supabase.rpc("apply_scan_action", {
        p_order_id: orderData.id,
        p_action: modeConfig.action,
        p_reason: reason || null,
      });

      if (actionError) throw actionError;

      const result = rawAction as any;
      if (!result?.success) {
        setLastError(result?.error || "Action failed");
        if (soundEnabled) playError();
        addHistory(text, orderData.invoice_id || "", orderData.customer_name || "", mode, false, result?.error || "Failed");
      } else {
        setLastAction(`${result.old_status} → ${result.new_status}`);
        setLastResult({ ...orderData, status: result.new_status });
        if (soundEnabled) playSuccess();
        addHistory(text, orderData.invoice_id || "", orderData.customer_name || "", mode, true, `${result.old_status} → ${result.new_status}`);
      }
    } catch (err: any) {
      setLastError(err.message || "Unexpected error");
      if (soundEnabled) playError();
      addHistory(text, "", "", mode, false, err.message || "Error");
    } finally {
      setScanning(false);
      inputRef.current?.focus();
    }
  }, [scanInput, mode, returnReason, soundEnabled]);

  const addHistory = (scanText: string, invoiceId: string, customerName: string, action: string, success: boolean, message: string) => {
    setHistory((prev) => [{
      id: crypto.randomUUID(),
      timestamp: new Date(),
      scanText, invoiceId, customerName, action, success, message,
    }, ...prev.slice(0, 99)]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
    }
  };

  const currentMode = SCAN_MODES.find((m) => m.key === mode)!;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanLine className="w-6 h-6" /> Scan to Update
          </h1>
          <p className="text-sm text-muted-foreground">Scan barcodes to update order statuses instantly</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── Left: Scanner ── */}
        <div className="lg:col-span-8 space-y-4">
          {/* Mode tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as ScanModeType)}>
            <TabsList className="w-full grid grid-cols-4 h-12">
              {SCAN_MODES.map((m) => (
                <TabsTrigger key={m.key} value={m.key} className="text-sm gap-2 data-[state=active]:shadow-md">
                  <m.icon className="w-4 h-4" />
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Scan Input */}
          <Card className="border-2 border-dashed border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Barcode className="w-8 h-8 text-primary/60 flex-shrink-0" />
                <Input
                  ref={inputRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={mode === "verify" ? "Scan tracking ID to verify..." : `Scan invoice or tracking ID to ${currentMode.label.toLowerCase()}...`}
                  className="h-14 text-xl font-mono border-0 focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40"
                  autoFocus
                  disabled={scanning}
                />
                {scanning && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
              </div>

              {/* Mode-specific options */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                {mode === "pack" && (
                  <div className="flex items-center gap-2">
                    <Switch id="auto-print" checked={autoPrint} onCheckedChange={setAutoPrint} />
                    <Label htmlFor="auto-print" className="text-xs cursor-pointer flex items-center gap-1">
                      <Printer className="w-3 h-3" /> Auto-print after pack
                    </Label>
                  </div>
                )}
                {mode === "return" && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Reason:</Label>
                    <Select value={returnReason} onValueChange={setReturnReason}>
                      <SelectTrigger className="h-7 text-xs w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="undelivered">Undelivered</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                        <SelectItem value="customer_refusal">Customer Refusal</SelectItem>
                        <SelectItem value="wrong_address">Wrong Address</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                  <Switch id="sound-toggle" checked={soundEnabled} onCheckedChange={setSoundEnabled} />
                  <Label htmlFor="sound-toggle" className="text-xs cursor-pointer flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Sound
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Result Card ── */}
          {lastError && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-6 text-center">
                <XCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
                <p className="text-lg font-semibold text-destructive">{lastError}</p>
                <p className="text-sm text-muted-foreground mt-1">Check the scanned value and try again</p>
              </CardContent>
            </Card>
          )}

          {lastResult && !lastError && (
            <Card className={`border-2 ${lastAction ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-primary/30"}`}>
              <CardContent className="p-4">
                {lastAction && (
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{lastAction}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Invoice</span>
                    <p className="font-mono font-bold text-sm">{lastResult.invoice_id || lastResult.order_number || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Customer</span>
                    <p className="font-semibold text-sm">{lastResult.customer_name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Phone</span>
                    <p className="font-mono text-sm">{lastResult.customer_phone || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</span>
                    <Badge className={`${STATUS_COLORS[lastResult.status] || ""} text-xs mt-0.5`}>
                      {lastResult.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
                    <p className="font-bold text-sm">{formatBDT(lastResult.total_amount)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Courier</span>
                    <p className="text-sm">{lastResult.courier_name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tracking</span>
                    <p className="font-mono text-xs">{lastResult.shipment_tracking_id || lastResult.pathao_tracking_code || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Advance</span>
                    {(lastResult.advance_amount || 0) > 0 ? (
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-sm text-emerald-600">{formatBDT(lastResult.advance_amount)}</span>
                        {lastResult.advance_method && <Badge variant="secondary" className="text-[10px] h-4">{lastResult.advance_method}</Badge>}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>
                </div>

                {/* Verify mode: show sync button */}
                {mode === "verify" && (
                  <div className="mt-3 pt-3 border-t flex items-center gap-3">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Wifi className="w-3 h-3" /> Sync: {lastResult.courier_sync_status || "N/A"}
                    </Badge>
                    <Badge variant="outline" className="text-xs gap-1">
                      Shipment: {lastResult.shipment_status || "N/A"}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Scan History ── */}
          {history.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Recent Scans</CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setHistory([])}>Clear</Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {history.slice(0, 20).map((h) => (
                    <div key={h.id} className={`flex items-center gap-2 text-xs py-1.5 px-2 rounded ${h.success ? "bg-muted/30" : "bg-destructive/5"}`}>
                      {h.success ? <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" /> : <XCircle className="w-3 h-3 text-destructive flex-shrink-0" />}
                      <span className="font-mono text-muted-foreground w-[60px] flex-shrink-0">{h.timestamp.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                      <span className="font-mono font-semibold truncate w-[120px]">{h.invoiceId || h.scanText}</span>
                      <span className="truncate flex-1 text-muted-foreground">{h.customerName}</span>
                      <Badge variant={h.success ? "secondary" : "destructive"} className="text-[10px] h-4 flex-shrink-0">{h.action}</Badge>
                      <span className="text-muted-foreground truncate max-w-[140px]">{h.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right: Stats + Info ── */}
        <div className="lg:col-span-4 space-y-3">
          {/* Today's stats */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm">Today's Stats</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <KpiCard title="Total Scans" value={todayStats.scans.toString()} icon={<ScanLine className="w-4 h-4" />} className="p-2" />
                <KpiCard title="Packed" value={todayStats.packed.toString()} icon={<Package className="w-4 h-4" />} className="p-2" />
                <KpiCard title="Shipped" value={todayStats.shipped.toString()} icon={<Truck className="w-4 h-4" />} className="p-2" />
                <KpiCard title="Returned" value={todayStats.returned.toString()} icon={<RotateCcw className="w-4 h-4" />} className="p-2" />
              </div>
            </CardContent>
          </Card>

          {/* Mode guide */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <currentMode.icon className="w-4 h-4" /> {currentMode.label} Mode
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {mode === "pack" && (
                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p>Scan invoice barcode to mark order as <Badge className="bg-blue-100 text-blue-800 text-[10px] h-4">PACKED</Badge></p>
                  <p>Valid from: <span className="font-semibold">pending, ready_to_ship</span></p>
                  <p>Stock will be reserved upon packing.</p>
                </div>
              )}
              {mode === "ship" && (
                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p>Scan to mark as <Badge className="bg-indigo-100 text-indigo-800 text-[10px] h-4">SHIPPED</Badge></p>
                  <p>Valid from: <span className="font-semibold">packed, ready_to_ship, pending</span></p>
                  <p>Order will be handed to courier.</p>
                </div>
              )}
              {mode === "verify" && (
                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p>Scan tracking ID to verify courier status.</p>
                  <p>No status change — view-only mode.</p>
                  <p>Shows courier sync status and last update.</p>
                </div>
              )}
              {mode === "return" && (
                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p>Scan to mark as <Badge className="bg-red-100 text-red-800 text-[10px] h-4">RETURNED</Badge></p>
                  <p>Valid from: <span className="font-semibold">shipped, in_transit, delivered, delivery_failed</span></p>
                  <div className="flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span>Select return reason before scanning.</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Keyboard shortcuts */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm">Shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between"><span>Scan & Submit</span><kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">Enter</kbd></div>
              <div className="flex justify-between"><span>Focus scan input</span><span className="text-[10px]">Auto-focus</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
