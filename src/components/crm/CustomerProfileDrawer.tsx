import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Phone, MessageCircle, Clock, CalendarIcon, ExternalLink } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { CRMCustomer, useCustomerOrders, useCRMMutations } from "@/hooks/use-crm";
import { Skeleton } from "@/components/ui/skeleton";

const SEGMENT_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  vip: { label: "VIP", color: "bg-yellow-100 text-yellow-800 border-yellow-300", emoji: "⭐" },
  new: { label: "New", color: "bg-green-100 text-green-800 border-green-300", emoji: "🆕" },
  active: { label: "Active", color: "bg-blue-100 text-blue-800 border-blue-300", emoji: "✅" },
  inactive: { label: "Inactive", color: "bg-orange-100 text-orange-800 border-orange-300", emoji: "😴" },
  lost: { label: "Lost", color: "bg-red-100 text-red-800 border-red-300", emoji: "💀" },
};

const AVAILABLE_TAGS = ["Loyal", "VIP", "Gift buyer", "Wholesale", "Win-back", "New arrival"];

const STATUS_CONFIG: Record<string, string> = {
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  processing: "bg-orange-100 text-orange-800",
  pending: "bg-orange-100 text-orange-800",
  returned: "bg-gray-100 text-gray-800",
};

interface Props {
  customer: CRMCustomer | null;
  open: boolean;
  onClose: () => void;
}

export function CustomerProfileDrawer({ customer, open, onClose }: Props) {
  const { data: orders, isLoading: ordersLoading } = useCustomerOrders(customer?.id || null);
  const { updateTags, updateNotes, updateManualSegment, addFollowup } = useCRMMutations();
  const [notes, setNotes] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [followupDate, setFollowupDate] = useState<Date>();
  const [followupTime, setFollowupTime] = useState("10:00");

  const c = customer;
  if (!c) return null;

  const seg = SEGMENT_CONFIG[c.computed_segment] || SEGMENT_CONFIG.active;
  const initials = c.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const currentTags = (c.tags as string[]) || [];

  const toggleTag = (tag: string) => {
    const newTags = currentTags.includes(tag) ? currentTags.filter((t) => t !== tag) : [...currentTags, tag];
    updateTags.mutate({ id: c.id, tags: newTags });
  };

  const handleNotesBlur = () => {
    if (notes !== (c.notes || "")) {
      updateNotes.mutate({ id: c.id, notes });
    }
  };

  const handleScheduleFollowup = () => {
    if (!followupDate || !followupNote) return;
    const [h, m] = followupTime.split(":").map(Number);
    const dt = new Date(followupDate);
    dt.setHours(h, m, 0, 0);
    addFollowup.mutate({
      customer_phone: c.phone,
      note: followupNote,
      due_at: dt.toISOString(),
    });
    setFollowupNote("");
    setFollowupDate(undefined);
  };

  const delivered = orders?.filter((o) => o.status === "delivered").length || 0;
  const cancelled = orders?.filter((o) => o.status === "cancelled").length || 0;
  const returned = orders?.filter((o) => o.status === "returned").length || 0;
  const total = orders?.length || 0;
  const successRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[480px] max-w-full overflow-y-auto p-0" side="right">
        <div className="p-6 space-y-6">
          {/* Profile Top */}
          <SheetHeader className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-lg font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-xl">{c.full_name}</SheetTitle>
                <p className="text-sm text-muted-foreground">{c.phone}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className={cn("text-xs border", seg.color)}>
                    {seg.emoji} {seg.label}
                  </Badge>
                  <Select
                    value={c.manual_segment || "auto"}
                    onValueChange={(v) => updateManualSegment.mutate({ id: c.id, manual_segment: v === "auto" ? null : v })}
                  >
                    <SelectTrigger className="h-7 text-xs w-28">
                      <SelectValue placeholder="Override" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="vip">⭐ VIP</SelectItem>
                      <SelectItem value="active">✅ Active</SelectItem>
                      <SelectItem value="inactive">😴 Inactive</SelectItem>
                      <SelectItem value="lost">💀 Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => window.open(`tel:${c.phone}`)}>
                <Phone className="w-3.5 h-3.5 mr-1" /> Call
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-green-700 border-green-300 hover:bg-green-50"
                onClick={() => window.open(`https://wa.me/880${c.phone.replace(/^0/, "")}`, "_blank")}
              >
                <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
              </Button>
            </div>
          </SheetHeader>

          {/* Stats Strip */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Total Spent", value: `৳${(c.total_spent || 0).toLocaleString()}`, color: "text-green-700" },
              { label: "Success", value: c.success_rate != null ? `${c.success_rate}%` : `${successRate}%`, color: successRate >= 80 ? "text-green-700" : successRate >= 50 ? "text-orange-600" : "text-red-600" },
              { label: "Last Order", value: c.last_order_date ? formatDistanceToNow(new Date(c.last_order_date), { addSuffix: false }) : "N/A", color: "text-muted-foreground" },
              { label: "City", value: c.district || "N/A", color: "text-muted-foreground" },
            ].map((s) => (
              <div key={s.label} className="bg-muted/50 rounded-lg p-3 text-center">
                <p className={cn("text-sm font-bold", s.color)}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Manual Tags */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Tags</h4>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                    currentTags.includes(tag)
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted/50 border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Order History */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Order History</h4>
            {ordersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : !orders?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No orders yet</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {orders.map((o) => (
                  <a
                    key={o.id}
                    href={`/orders/${o.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-primary">{o.order_number}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {o.items.map((i: any) => `${i.product_name_fallback || "Product"} ×${i.quantity}`).join(", ") || "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {o.order_date ? formatDistanceToNow(new Date(o.order_date), { addSuffix: true }) : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-sm font-bold">৳{(o.total_amount || 0).toLocaleString()}</p>
                      <Badge variant="outline" className={cn("text-[10px] mt-1", STATUS_CONFIG[o.status || ""] || "")}>
                        {o.status || "pending"}
                      </Badge>
                    </div>
                  </a>
                ))}
                <div className="text-xs text-muted-foreground pt-2 border-t space-y-0.5">
                  <p>Total: {total} | Delivered: {delivered} | Cancelled: {cancelled} | Returned: {returned}</p>
                  <p>Success rate: {successRate}%</p>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Notes</h4>
            <Textarea
              placeholder="Internal notes about this customer..."
              defaultValue={c.notes || ""}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              className="min-h-[80px] text-sm"
            />
          </div>

          {/* Schedule Follow-up */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-2">
              <Clock className="w-4 h-4 inline mr-1" /> Schedule Follow-up
            </h4>
            <div className="space-y-2">
              <Input
                placeholder="Follow-up note..."
                value={followupNote}
                onChange={(e) => setFollowupNote(e.target.value)}
              />
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start">
                      <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                      {followupDate ? format(followupDate, "PP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={followupDate}
                      onSelect={setFollowupDate}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={followupTime}
                  onChange={(e) => setFollowupTime(e.target.value)}
                  className="w-28"
                />
              </div>
              <Button
                size="sm"
                onClick={handleScheduleFollowup}
                disabled={!followupDate || !followupNote}
                className="w-full"
              >
                ⏰ Schedule Follow-up
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
