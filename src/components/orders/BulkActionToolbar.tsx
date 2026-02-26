import { useState, useRef, useEffect } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Package, Truck, CheckCircle, XCircle, Printer, ClipboardList, Box, Tag,
  Send, ChevronUp, X, ClipboardCheck, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionToolbarProps {
  selectedCount: number;
  onDeselect: () => void;
  onStatusChange: (status: string) => void;
  onPrint: (type: "invoice" | "picking" | "packing" | "barcode") => void;
  onCourier: (courier: string) => void;
  changing?: boolean;
}

export function BulkActionToolbar({
  selectedCount, onDeselect, onStatusChange, onPrint, onCourier, changing,
}: BulkActionToolbarProps) {
  const [confirmAction, setConfirmAction] = useState<{ status: string; label: string } | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmAction) return;
    const t = setTimeout(() => setConfirmAction(null), 4000);
    return () => clearTimeout(t);
  }, [confirmAction]);

  useEffect(() => {
    if (!confirmAction) return;
    const handler = (e: MouseEvent) => {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) setConfirmAction(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [confirmAction]);

  if (selectedCount === 0) return null;

  const statusActions = [
    { key: "packed", label: "Packed", icon: Package },
    { key: "ready_to_ship", label: "RTS", icon: ClipboardCheck },
    { key: "shipped", label: "Shipped", icon: Truck },
    { key: "delivered", label: "Delivered", icon: CheckCircle },
    { key: "returned", label: "Returned", icon: RotateCcw },
    { key: "cancelled", label: "Cancel", icon: XCircle },
  ];

  const printActions = [
    { key: "invoice" as const, label: "Invoice", icon: Printer },
    { key: "picking" as const, label: "Picking", icon: ClipboardList },
    { key: "packing" as const, label: "Packing", icon: Box },
    { key: "barcode" as const, label: "Barcode", icon: Tag },
  ];

  const couriers = [
    { key: "pathao", name: "Pathao", emoji: "🚀" },
    { key: "steadfast", name: "Steadfast", emoji: "⚡" },
    { key: "redx", name: "RedX", emoji: "📦" },
  ];

  const handleStatusClick = (status: string, label: string) => {
    if (confirmAction?.status === status) {
      onStatusChange(status);
      setConfirmAction(null);
    } else {
      setConfirmAction({ status, label });
    }
  };

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "bg-card rounded-2xl shadow-[0_8px_40px_-8px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.05)]",
        "px-4 py-3 flex items-center gap-3 flex-wrap max-w-[95vw]",
        "animate-[slide-up_0.35s_cubic-bezier(0.34,1.56,0.64,1)]"
      )}
    >
      {/* Selection count */}
      <div className="flex items-center gap-2 pr-3 border-r border-border">
        <span className="text-sm font-semibold text-foreground">{selectedCount} টি selected</span>
        <button onClick={onDeselect} className="w-6 h-6 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Status actions */}
      <div className="flex items-center gap-1 relative" ref={confirmRef}>
        {statusActions.map((action) => {
          const Icon = action.icon;
          const isConfirming = confirmAction?.status === action.key;
          const isDanger = action.key === "cancelled";

          return (
            <div key={action.key} className="relative">
              {isConfirming && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 animate-fade-in">
                  <div className="bg-foreground text-background text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg">
                    {selectedCount} orders → {action.label}?
                    <button
                      onClick={() => { onStatusChange(action.key); setConfirmAction(null); }}
                      className="ml-2 bg-background/20 hover:bg-background/30 px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors"
                      disabled={changing}
                    >
                      Confirm ✓
                    </button>
                  </div>
                  <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                </div>
              )}
              <button
                onClick={() => handleStatusClick(action.key, action.label)}
                disabled={changing}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border",
                  isConfirming
                    ? isDanger ? "bg-destructive text-destructive-foreground border-destructive scale-105" : "bg-primary text-primary-foreground border-primary scale-105"
                    : isDanger
                      ? "border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      : "border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground",
                  changing && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {action.label}
              </button>
            </div>
          );
        })}
      </div>

      <div className="w-px h-7 bg-border" />

      {/* Print */}
      <div className="flex items-center gap-1">
        {printActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              onClick={() => onPrint(action.key)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Icon className="w-3.5 h-3.5" />
              {action.label}
            </button>
          );
        })}
      </div>

      <div className="w-px h-7 bg-border" />

      {/* Courier */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all">
            <Send className="w-3.5 h-3.5" />
            Send to Courier
            <ChevronUp className="w-3 h-3 ml-0.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-56 mb-2 bg-popover z-[60]">
          {couriers.map((c) => (
            <DropdownMenuItem key={c.key} onClick={() => onCourier(c.key)} className="flex items-center gap-3 py-2.5">
              <span className="text-base">{c.emoji}</span>
              <div className="flex-1">
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-[11px] text-muted-foreground">Send {selectedCount} orders</p>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
