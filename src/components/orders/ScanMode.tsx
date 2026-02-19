import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, orderStatusConfig } from "@/lib/format";
import { ScanLine, Package, Truck, CheckCircle, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ScanLog {
  time: string;
  orderNumber: string;
  action: string;
}

interface Props {
  onStatusChange: (orderId: string, orderNumber: string, newStatus: string) => void;
}

export function ScanMode({ onStatusChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [scanValue, setScanValue] = useState("");
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = async (value: string) => {
    if (!value.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, status, total_amount, customers(full_name)")
      .eq("order_number", value.trim())
      .maybeSingle();

    setFoundOrder(data);
    setSearching(false);
    if (!data) {
      setScanLogs((prev) => [
        { time: new Date().toLocaleTimeString(), orderNumber: value, action: "❌ Not found" },
        ...prev.slice(0, 9),
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleScan(scanValue);
    }
  };

  const handleAction = (action: string, label: string) => {
    if (!foundOrder) return;
    onStatusChange(foundOrder.id, foundOrder.order_number, action);
    setScanLogs((prev) => [
      { time: new Date().toLocaleTimeString(), orderNumber: foundOrder.order_number, action: `✅ ${label}` },
      ...prev.slice(0, 9),
    ]);
    setFoundOrder(null);
    setScanValue("");
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
        <ScanLine className="w-5 h-5 text-primary" />
        <span className="text-sm font-medium">🔍 Scan Mode Active — Barcode scan করুন বা order number লিখুন</span>
      </div>

      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={scanValue}
          onChange={(e) => setScanValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Barcode scan or type order number..."
          className="text-lg font-mono"
          autoFocus
        />
        <Button onClick={() => handleScan(scanValue)} disabled={searching}>
          Search
        </Button>
      </div>

      {foundOrder && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold">{foundOrder.order_number}</p>
                <p className="text-sm text-muted-foreground">{(foundOrder.customers as any)?.full_name}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{formatBDT(foundOrder.total_amount)}</p>
                <Badge variant="outline" className="text-xs">
                  {orderStatusConfig[foundOrder.status]?.label || foundOrder.status}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => handleAction("packed", "Packed")}>
                <Package className="w-3.5 h-3.5 mr-1" /> Packed
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAction("shipped", "Shipped")}>
                <Truck className="w-3.5 h-3.5 mr-1" /> Shipped
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAction("delivered", "Delivered")}>
                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Delivered
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/orders/${foundOrder.id}`)}>
                <Eye className="w-3.5 h-3.5 mr-1" /> View
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {scanLogs.length > 0 && (
        <div className="rounded-lg border">
          <div className="px-3 py-2 bg-muted/30 text-xs font-medium text-muted-foreground">Recent Scans</div>
          {scanLogs.map((log, i) => (
            <div key={i} className="px-3 py-1.5 text-xs border-t flex gap-3">
              <span className="text-muted-foreground">{log.time}</span>
              <span className="font-mono">{log.orderNumber}</span>
              <span>{log.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
