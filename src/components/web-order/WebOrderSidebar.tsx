import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Plus, Send, Tag, MessageSquare, X } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  order: any;
  orderItems: any[];
  grandTotal: number;
  customerPhone: string;
  customerIP?: string;
  currentStatus: string;
  onStatusChange: (status: string) => void;
  onSave: () => void;
  onBack: () => void;
  onAddNote: (note: string) => void;
  saving: boolean;
  statusOptions: { key: string; label: string }[];
}

const WEB_STATUSES = [
  { key: "processing", label: "Processing" },
  { key: "confirm", label: "Confirmed" },
  { key: "good_but_no_response", label: "Good No Resp" },
  { key: "no_response", label: "No Response" },
  { key: "on_hold", label: "On Hold" },
  { key: "advance_payment", label: "Advance" },
  { key: "cancel", label: "Cancelled" },
];

export function WebOrderSidebar({
  order, orderItems, grandTotal, customerPhone, customerIP,
  currentStatus, onStatusChange, onSave, onBack, onAddNote, saving,
}: Props) {
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [statusValue, setStatusValue] = useState(currentStatus);

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  return (
    <div className="space-y-3">
      {/* Total Card */}
      <Card>
        <CardHeader className="py-2.5 px-3">
          <CardTitle className="text-xs">Total</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          <div className="text-2xl font-black text-primary tabular-nums">
            {formatBDT(grandTotal)}
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] text-muted-foreground">
              IP: <span className="font-mono">{customerIP || "—"}</span>
            </p>
            <p className="text-[9px] text-muted-foreground">
              Mobile: <span className="font-mono">{customerPhone || "—"}</span>
            </p>
          </div>
          {orderItems.length > 0 && (
            <div className="border-t border-border pt-2 space-y-1">
              {orderItems.map((item) => {
                const p = item.products as any;
                return (
                  <div key={item.id} className="flex items-center justify-between text-[10px]">
                    <span className="truncate flex-1 mr-2 text-muted-foreground">
                      {p?.sku || "—"}
                    </span>
                    <span className="tabular-nums font-medium">×{item.quantity}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tags Card */}
      <Card>
        <CardHeader className="py-2.5 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Tag className="w-3 h-3" /> Order Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">
                {tag}
                <button onClick={() => setTags(tags.filter(t => t !== tag))}>
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            ))}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 w-full">
                <Plus className="w-3 h-3" /> Add Tag
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="flex gap-1">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTag()}
                  className="h-7 text-[11px]"
                  placeholder="Tag name..."
                />
                <Button size="sm" className="h-7 px-2" onClick={addTag}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card>
        <CardHeader className="py-2.5 px-3">
          <CardTitle className="text-xs">Order Actions</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          <div>
            <Label className="text-[9px] text-muted-foreground uppercase">Change Status</Label>
            <Select value={statusValue} onValueChange={setStatusValue}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {WEB_STATUSES.map((s) => (
                  <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full h-8 text-xs bg-primary hover:bg-primary-dark text-primary-foreground"
            onClick={() => {
              onStatusChange(statusValue);
              onSave();
            }}
            disabled={saving}
          >
            {saving ? "Updating..." : "Update"}
          </Button>
          <Button variant="ghost" className="w-full h-7 text-xs text-muted-foreground" onClick={onBack}>
            <ArrowLeft className="w-3 h-3 mr-1" /> Back to List
          </Button>
        </CardContent>
      </Card>

      {/* Note Card */}
      <Card>
        <CardHeader className="py-2.5 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3" /> Note
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note"
            rows={2}
            className="text-xs resize-none min-h-[48px]"
          />
          <Button
            size="sm"
            className="w-full h-7 text-[10px] gap-1"
            disabled={!note.trim()}
            onClick={() => { onAddNote(note); setNote(""); }}
          >
            <Plus className="w-3 h-3" /> Add Note
          </Button>
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-[9px] gap-1">
              <Send className="w-2.5 h-2.5" /> Send Reminder SMS
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[9px] gap-1">
              <Send className="w-2.5 h-2.5" /> Send Advance SMS
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Attribution line */}
      <p className="text-[9px] text-muted-foreground/50 text-center px-2">
        No attribution data available for this order
      </p>
    </div>
  );
}
