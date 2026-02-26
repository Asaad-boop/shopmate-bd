import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface NoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  note: string;
}

export function NoteModal({ open, onOpenChange, invoiceId, note }: NoteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Notes — {invoiceId}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed py-2">
          {note || "No notes available."}
        </div>
      </DialogContent>
    </Dialog>
  );
}
