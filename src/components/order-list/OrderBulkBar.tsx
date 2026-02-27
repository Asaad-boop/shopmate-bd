import { useState } from "react";
import { X, RefreshCw, UserCheck, Truck, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, type OrderStatus } from "./order-list-data";

interface Props {
  selectedCount: number;
  onClear: () => void;
  onAction: (action: string) => void;
}

export function OrderBulkBar({ selectedCount, onClear, onAction }: Props) {
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [note, setNote] = useState("");

  return (
    <>
      {/* Floating bar with smooth enter/exit */}
      <div
        className={cn(
          "fixed bottom-5 left-1/2 z-50 pointer-events-none",
          "transition-all duration-200 ease-in-out",
          selectedCount > 0
            ? "opacity-100 translate-y-0 translate-x-[-50%] pointer-events-auto"
            : "opacity-0 translate-y-4 translate-x-[-50%]"
        )}
        aria-hidden={selectedCount === 0}
      >
        <div
          className={cn(
            "bg-card/95 backdrop-blur-md border border-border rounded-xl",
            "shadow-[0_8px_30px_-4px_hsl(var(--foreground)/0.12)]",
            "dark:shadow-[0_8px_30px_-4px_hsl(0_0%_0%/0.4)]",
            "px-4 py-2.5 flex items-center gap-3"
          )}
        >
          {/* Selected count */}
          <div className="flex items-center gap-2 pr-3 border-r border-border">
            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-primary text-primary-foreground text-[11px] font-bold tabular-nums">
              {selectedCount}
            </span>
            <span className="text-xs font-semibold text-foreground whitespace-nowrap">selected</span>
            <button
              onClick={onClear}
              className="w-5 h-5 rounded-full bg-muted hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => setShowStatusDialog(true)}>
            <RefreshCw className="w-3 h-3" /> Change Status
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => onAction("staff")}>
            <UserCheck className="w-3 h-3" /> Assign Staff
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => onAction("courier")}>
            <Truck className="w-3 h-3" /> Set Courier
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => onAction("print")}>
            <Printer className="w-3 h-3" /> Print
          </Button>
        </div>
      </div>

      {/* Bulk Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Bulk Update Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">New Status</p>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select status…" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_CONFIG) as OrderStatus[]).map(s => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {STATUS_CONFIG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Note (optional)</p>
              <Textarea
                placeholder="Add a note for this bulk action…"
                className="text-xs min-h-[70px]"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              This will update {selectedCount} orders to the selected status.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setShowStatusDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" className="text-xs h-8" disabled={!newStatus} onClick={() => { onAction("status"); setShowStatusDialog(false); }}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
