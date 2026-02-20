import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Package, Truck, CheckCircle, XCircle,
  Printer, ClipboardList, Box, Tag,
  Send, ChevronUp, X,
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
  selectedCount,
  onDeselect,
  onStatusChange,
  onPrint,
  onCourier,
  changing,
}: BulkActionToolbarProps) {
  const [confirmAction, setConfirmAction] = useState<{ status: string; label: string } | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss confirm tooltip after 4s
  useEffect(() => {
    if (!confirmAction) return;
    const t = setTimeout(() => setConfirmAction(null), 4000);
    return () => clearTimeout(t);
  }, [confirmAction]);

  // Click outside to dismiss
  useEffect(() => {
    if (!confirmAction) return;
    const handler = (e: MouseEvent) => {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setConfirmAction(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [confirmAction]);

  if (selectedCount === 0) return null;

  const statusActions = [
    { key: "packed", label: "Packed", icon: Package },
    { key: "shipped", label: "Shipped", icon: Truck },
    { key: "delivered", label: "Delivered", icon: CheckCircle },
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
      // Already confirming — execute
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
        "bg-white rounded-2xl shadow-[0_8px_40px_-8px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.05)]",
        "px-4 py-3 flex items-center gap-3 flex-wrap",
        "animate-[slide-up_0.35s_cubic-bezier(0.34,1.56,0.64,1)]",
        "max-w-[95vw]"
      )}
      style={{
        // Inline keyframe for slide-up
        animation: "slide-up 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
      }}
    >
      {/* Left: Selection count */}
      <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
        <span className="text-sm font-semibold text-slate-800">
          {selectedCount} টি order selected
        </span>
        <button
          onClick={onDeselect}
          className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>

      {/* Group 1: Status */}
      <div className="flex items-center gap-1 relative" ref={confirmRef}>
        {statusActions.map((action) => {
          const Icon = action.icon;
          const isConfirming = confirmAction?.status === action.key;

          return (
            <div key={action.key} className="relative">
              {/* Confirm tooltip */}
              {isConfirming && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 animate-fade-in">
                  <div className="bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg">
                    {selectedCount} orders → {action.label}?
                    <button
                      onClick={() => {
                        onStatusChange(action.key);
                        setConfirmAction(null);
                      }}
                      className="ml-2 bg-white/20 hover:bg-white/30 px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors"
                      disabled={changing}
                    >
                      Confirm ✓
                    </button>
                  </div>
                  <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1" />
                </div>
              )}

              <button
                onClick={() => handleStatusClick(action.key, action.label)}
                disabled={changing}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border",
                  isConfirming
                    ? "bg-rose-600 text-white border-rose-600 scale-105"
                    : "border-rose-500/40 text-rose-600 hover:bg-rose-600 hover:text-white hover:border-rose-600",
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

      {/* Divider */}
      <div className="w-px h-7 bg-slate-200" />

      {/* Group 2: Print */}
      <div className="flex items-center gap-1">
        {printActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              onClick={() => onPrint(action.key)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
            >
              <Icon className="w-3.5 h-3.5" />
              {action.label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="w-px h-7 bg-slate-200" />

      {/* Group 3: Courier dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 bg-slate-900 text-white hover:bg-slate-800">
            <Send className="w-3.5 h-3.5" />
            Send to Courier
            <ChevronUp className="w-3 h-3 ml-0.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-56 mb-2 bg-white z-[60]">
          {couriers.map((c) => (
            <DropdownMenuItem
              key={c.key}
              onClick={() => onCourier(c.key)}
              className="flex items-center gap-3 py-2.5"
            >
              <span className="text-base">{c.emoji}</span>
              <div className="flex-1">
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Send {selectedCount} orders
                </p>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
