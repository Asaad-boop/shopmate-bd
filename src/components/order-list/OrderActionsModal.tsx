import { useState } from "react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  ChevronDown, CheckSquare, Printer, FileText, ClipboardList, StickyNote,
  CheckCircle2, RotateCcw, Truck, RefreshCw, Download, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface Props {
  selectedCount: number;
  totalCount: number;
  onAction: (action: string) => void;
  onSelectAll: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-3 pb-1.5">
      {children}
    </p>
  );
}

function ActionItem({
  icon: Icon, label, onClick, variant,
}: {
  icon: React.ElementType; label: string; onClick: () => void; variant?: "success" | "warning" | "default";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors duration-100",
        variant === "success" && "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10",
        variant === "warning" && "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10",
        !variant || variant === "default" ? "text-foreground hover:bg-muted" : "",
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );
}

function ActionPairRow({
  items,
}: {
  items: { icon: React.ElementType; label: string; onClick: () => void }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-1 px-2">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={i}
            onClick={item.onClick}
            className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted rounded-lg transition-colors duration-100"
          >
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function OrderActionsModal({ selectedCount, totalCount, onAction, onSelectAll }: Props) {
  const [open, setOpen] = useState(false);

  const fire = (action: string) => {
    onAction(action);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 text-xs gap-1.5", selectedCount === 0 && "opacity-50")}
          disabled={selectedCount === 0}
        >
          Actions
          {selectedCount > 0 && (
            <span className="ml-0.5 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md">
              {selectedCount}
            </span>
          )}
          <ChevronDown className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-0 rounded-xl" sideOffset={6}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-bold">
              {selectedCount}
            </span>
            <span className="text-xs font-medium text-foreground">selected</span>
          </span>
          <button
            onClick={() => { onSelectAll(); }}
            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline underline-offset-2"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Select All
          </button>
        </div>

        {/* Print Options */}
        <SectionLabel>Print Options</SectionLabel>
        <ActionPairRow
          items={[
            { icon: FileText, label: "Invoice", onClick: () => fire("print_invoice") },
            { icon: StickyNote, label: "Sticker", onClick: () => fire("print_sticker") },
            { icon: ClipboardList, label: "Picking", onClick: () => fire("print_picking") },
            { icon: Printer, label: "Sheet", onClick: () => fire("print_sheet") },
          ]}
        />

        <Separator className="my-1" />

        {/* Status Update */}
        <SectionLabel>
          Status Update
          <span className="normal-case ml-1 text-muted-foreground font-normal">
            ({selectedCount} selected)
          </span>
        </SectionLabel>
        <div className="px-2 space-y-0.5">
          <ActionItem
            icon={CheckCircle2}
            label="Mark as Delivered"
            variant="success"
            onClick={() => fire("mark_delivered")}
          />
          <ActionItem
            icon={RotateCcw}
            label="Move to Pending Return"
            variant="warning"
            onClick={() => fire("pending_return")}
          />
        </div>

        <Separator className="my-1" />

        {/* Courier Services */}
        <SectionLabel>Courier Services</SectionLabel>
        <div className="px-2 space-y-0.5">
          <ActionItem
            icon={Truck}
            label="Send to Pathao"
            onClick={() => fire("send_pathao")}
          />
          <ActionItem
            icon={RefreshCw}
            label="Refresh Status"
            onClick={() => fire("refresh_status")}
          />
        </div>

        <Separator className="my-1" />

        {/* Tools & Export */}
        <SectionLabel>Tools & Export</SectionLabel>
        <ActionPairRow
          items={[
            { icon: Download, label: "Excel", onClick: () => fire("export_excel") },
            { icon: Copy, label: "Duplicates", onClick: () => fire("find_duplicates") },
          ]}
        />
        <div className="h-2" />
      </PopoverContent>
    </Popover>
  );
}
