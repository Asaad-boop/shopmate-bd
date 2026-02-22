import { Button } from "@/components/ui/button";
import { X, Download, Printer, Archive, Trash2 } from "lucide-react";

interface Props {
  count: number;
  onDismiss: () => void;
  onExport: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export default function InventoryBulkBar({ count, onDismiss, onExport, onArchive, onDelete }: Props) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50" style={{ animation: "slide-up 0.3s ease-out" }}>
      <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-foreground text-background shadow-2xl backdrop-blur-xl">
        <span className="text-sm font-semibold mr-2">{count} selected</span>
        <div className="w-px h-5 bg-background/20" />
        <Button size="sm" variant="ghost" className="text-background hover:bg-background/10 gap-1.5" onClick={onExport}>
          <Download className="w-3.5 h-3.5" /> Export
        </Button>
        <Button size="sm" variant="ghost" className="text-background hover:bg-background/10 gap-1.5" onClick={onArchive}>
          <Archive className="w-3.5 h-3.5" /> Archive
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/20 gap-1.5" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </Button>
        <div className="w-px h-5 bg-background/20" />
        <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-background/10 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
