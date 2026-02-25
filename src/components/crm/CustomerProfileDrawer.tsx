import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Phone, MessageCircle, Clock, CalendarIcon, ExternalLink, ShieldAlert, Ban, Merge, DollarSign, AlertTriangle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { CRMCustomer, useCustomerOrders, useCRMMutations } from "@/hooks/use-crm";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const SEGMENT_CONFIG: Record<string, { label: string; color: string; borderColor: string; emoji: string }> = {
  diamond: { label: "Diamond", color: "bg-purple-50 text-purple-700", borderColor: "border-purple-200", emoji: "💎" },
  gold: { label: "Gold", color: "bg-amber-50 text-amber-700", borderColor: "border-amber-200", emoji: "👑" },
  silver: { label: "Silver", color: "bg-slate-100 text-slate-600", borderColor: "border-slate-300", emoji: "⭐" },
  new: { label: "New", color: "bg-emerald-50 text-emerald-700", borderColor: "border-emerald-200", emoji: "🆕" },
  active: { label: "Active", color: "bg-blue-50 text-blue-700", borderColor: "border-blue-200", emoji: "✅" },
  inactive: { label: "Inactive", color: "bg-orange-50 text-orange-700", borderColor: "border-orange-200", emoji: "😴" },
  lost: { label: "Lost", color: "bg-red-50 text-red-700", borderColor: "border-red-200", emoji: "💀" },
};

const AVAILABLE_TAGS = ["VIP", "Risky", "Frequent Return", "Loyal", "Gift buyer", "Wholesale", "Win-back", "Bulk buyer"];

const STATUS_CONFIG: Record<string, string> = {
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  processing: "bg-orange-50 text-orange-700 border-orange-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  returned: "bg-slate-100 text-slate-600 border-slate-300",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-purple-100 text-purple-700",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function useAdvanceHistory(customerId: string | null) {
  return useQuery({
    queryKey: ["crm-advance-history", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("account_ledger")
        .select("*")
        .eq("ref_type", "advance")
        .order("ledger_date", { ascending: false })
        .limit(20);
      // Filter by customer context if needed — advance entries linked by ref_id
      return data || [];
    },
  });
}

interface Props {
  customer: CRMCustomer | null;
  open: boolean;
  onClose: () => void;
}

export function CustomerProfileDrawer({ customer, open, onClose }: Props) {
  const { data: orders, isLoading: ordersLoading } = useCustomerOrders(customer?.id || null);
  const { data: advances } = useAdvanceHistory(customer?.id || null);
  const mutations = useCRMMutations();
  const [notes, setNotes] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [followupDate, setFollowupDate] = useState<Date>();
  const [followupTime, setFollowupTime] = useState("10:00");
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergePhone, setMergePhone] = useState("");
  const [activeSection, setActiveSection] = useState<string>("orders");

  const c = customer;
  if (!c) return null;

  const seg = SEGMENT_CONFIG[c.computed_segment] || SEGMENT_CONFIG.active;
  const initials = c.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const currentTags = (c.tags as string[]) || [];

  const toggleTag = (tag: string) => {
    const newTags = currentTags.includes(tag) ? currentTags.filter((t) => t !== tag) : [...currentTags, tag];
    mutations.updateTags.mutate({ id: c.id, tags: newTags });
  };

  const handleNotesBlur = () => {
    if (notes !== (c.notes || "")) {
      mutations.updateNotes.mutate({ id: c.id, notes });
    }
  };

  const handleScheduleFollowup = () => {
    if (!followupDate || !followupNote) return;
    const [h, m] = followupTime.split(":").map(Number);
    const dt = new Date(followupDate);
    dt.setHours(h, m, 0, 0);
    mutations.addFollowup.mutate({ customer_phone: c.phone, note: followupNote, due_at: dt.toISOString() });
    setFollowupNote("");
    setFollowupDate(undefined);
  };

  const handleBlock = () => {
    mutations.blockCustomer.mutate({ id: c.id, is_blocked: !c.is_blocked, blocked_reason: blockReason });
    setShowBlockDialog(false);
    setBlockReason("");
  };

  const handleMerge = async () => {
    if (!mergePhone) return;
    // Find duplicate by phone
    const { data } = await supabase.from("customers").select("id").eq("phone", mergePhone).neq("id", c.id).limit(1);
    if (data && data.length > 0) {
      mutations.mergeCustomers.mutate({ keepId: c.id, mergeId: data[0].id });
      setShowMergeDialog(false);
      setMergePhone("");
    }
  };

  const delivered = orders?.filter((o) => o.status === "delivered" || o.status === "completed").length || 0;
  const cancelled = orders?.filter((o) => o.status === "cancelled").length || 0;
  const returned = orders?.filter((o) => o.status === "returned").length || 0;
  const total = orders?.length || 0;
  const successRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
  const returnRate = total > 0 ? Math.round((returned / total) * 100) : 0;
  const totalRevenue = orders?.reduce((s, o) => s + (o.total_amount || 0), 0) || 0;
  const riskFlags = c.risk_flags || [];

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-[520px] max-w-full overflow-y-auto p-0" side="right">
          <div className="p-6 space-y-5">
            {/* Profile Top */}
            <SheetHeader className="space-y-4">
              <div className="flex items-start gap-4">
                <div className={cn("w-[52px] h-[52px] rounded-[14px] flex items-center justify-center text-lg font-bold flex-shrink-0", getAvatarColor(c.full_name))}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <SheetTitle className="text-[17px]" style={{ fontFamily: "Sora, sans-serif" }}>{c.full_name}</SheetTitle>
                    {c.is_blocked && (
                      <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">🚫 Blocked</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{c.phone}</p>
                  {c.district && <p className="text-xs text-muted-foreground">{c.district}{c.thana ? `, ${c.thana}` : ""}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className={cn("text-[10px] border font-medium", seg.color, seg.borderColor)}>
                      {seg.emoji} {seg.label}
                    </Badge>
                    {c.is_repeat && (
                      <Badge variant="outline" className="text-[10px] font-medium border bg-sky-50 text-sky-700 border-sky-200">🔄 Repeat</Badge>
                    )}
                    {riskFlags.map((f) => (
                      <Badge key={f} variant="outline" className="text-[10px] font-medium border bg-red-50 text-red-700 border-red-200">
                        ⚠️ {f === "high_return" ? "High Return" : f === "frequent_cancel" ? "Cancels" : f}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="border-[#eaecf3]" onClick={() => window.open(`tel:${c.phone}`)}>
                  <Phone className="w-3.5 h-3.5 mr-1" /> Call
                </Button>
                <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  onClick={() => window.open(`https://wa.me/880${c.phone.replace(/^0/, "")}`, "_blank")}>
                  <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                </Button>
                <Button size="sm" variant={c.is_blocked ? "default" : "outline"}
                  className={c.is_blocked ? "bg-emerald-600 hover:bg-emerald-700 text-white text-xs" : "text-red-600 border-red-200 hover:bg-red-50 text-xs"}
                  onClick={() => c.is_blocked ? handleBlock() : setShowBlockDialog(true)}>
                  <Ban className="w-3.5 h-3.5 mr-1" /> {c.is_blocked ? "Unblock" : "Block"}
                </Button>
                <Button size="sm" variant="outline" className="border-[#eaecf3] text-xs" onClick={() => setShowMergeDialog(true)}>
                  <Merge className="w-3.5 h-3.5 mr-1" /> Merge
                </Button>
              </div>
            </SheetHeader>

            {/* Stats Strip */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: "Revenue", value: `৳${totalRevenue.toLocaleString()}`, color: "text-emerald-600" },
                { label: "Orders", value: String(c.total_orders || total), color: "text-indigo-600" },
                { label: "Delivered", value: String(delivered), color: "text-emerald-600" },
                { label: "Returns", value: `${returned} (${returnRate}%)`, color: returned > 0 ? "text-red-600" : "text-muted-foreground" },
                { label: "Success", value: c.success_rate != null ? `${c.success_rate}%` : `${successRate}%`, color: successRate >= 80 ? "text-emerald-600" : successRate >= 50 ? "text-amber-600" : "text-red-600" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg p-2.5 text-center border" style={{ borderColor: "#eaecf3" }}>
                  <p className={cn("text-sm font-bold", s.color)} style={{ fontFamily: "Sora, sans-serif" }}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Section Tabs */}
            <div className="flex gap-1 border-b pb-2" style={{ borderColor: "#eaecf3" }}>
              {[
                { key: "orders", label: "📦 Orders" },
                { key: "financial", label: "💰 Financial" },
                { key: "notes", label: "📝 Notes & Tags" },
              ].map((t) => (
                <button key={t.key} onClick={() => setActiveSection(t.key)}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    activeSection === t.key ? "bg-indigo-50 text-indigo-700" : "text-muted-foreground hover:bg-slate-50"
                  )}>{t.label}</button>
              ))}
            </div>

            {/* Orders Section */}
            {activeSection === "orders" && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Order History</h4>
                {ordersLoading ? (
                  <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
                ) : !orders?.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No orders yet</p>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    {orders.map((o) => (
                      <a key={o.id} href={`/orders/${o.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors group"
                        style={{ borderColor: "#eaecf3" }}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-indigo-600">{o.order_number}</span>
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
                          <Badge variant="outline" className={cn("text-[10px] mt-1 border", STATUS_CONFIG[o.status || ""] || "")}>
                            {o.status || "pending"}
                          </Badge>
                        </div>
                      </a>
                    ))}
                    <div className="text-xs text-muted-foreground pt-2 border-t space-y-0.5" style={{ borderColor: "#eaecf3" }}>
                      <p>Delivered: {delivered} | Cancelled: {cancelled} | Returned: {returned}</p>
                      <p>Return rate: {returnRate}% | Success rate: {successRate}%</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Financial Section */}
            {activeSection === "financial" && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> Financial Summary
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Lifetime Revenue", value: `৳${(c.total_spent || 0).toLocaleString()}` },
                    { label: "Avg Order Value", value: `৳${total > 0 ? Math.round(totalRevenue / total).toLocaleString() : 0}` },
                    { label: "Delivered Value", value: `৳${orders?.filter(o => o.status === "delivered" || o.status === "completed").reduce((s, o) => s + (o.total_amount || 0), 0).toLocaleString() || 0}` },
                    { label: "Return Loss", value: `৳${orders?.filter(o => o.status === "returned").reduce((s, o) => s + (o.total_amount || 0), 0).toLocaleString() || 0}` },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-lg border" style={{ borderColor: "#eaecf3" }}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                      <p className="text-sm font-bold mt-1" style={{ fontFamily: "Sora, sans-serif" }}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Advance History */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Advance Payments</h4>
                  {(advances || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No advance records</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {(advances || []).slice(0, 10).map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between p-2 rounded border text-xs" style={{ borderColor: "#eaecf3" }}>
                          <div>
                            <span className={cn("font-medium", a.direction === "in" ? "text-emerald-600" : "text-red-600")}>
                              {a.direction === "in" ? "+" : "-"}৳{a.amount}
                            </span>
                            <span className="text-muted-foreground ml-2">{a.note || ""}</span>
                          </div>
                          <span className="text-muted-foreground">{a.ledger_date ? format(new Date(a.ledger_date), "dd MMM yy") : ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes & Tags Section */}
            {activeSection === "notes" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_TAGS.map((tag) => (
                      <button key={tag} onClick={() => toggleTag(tag)}
                        className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                          currentTags.includes(tag)
                            ? tag === "Risky" || tag === "Frequent Return" ? "bg-red-50 border-red-300 text-red-700" : "bg-indigo-50 border-indigo-300 text-indigo-700"
                            : "bg-white border-[#eaecf3] text-muted-foreground hover:border-indigo-200"
                        )}>{tag}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Notes</h4>
                  <Textarea
                    placeholder="Internal notes about this customer..."
                    defaultValue={c.notes || ""}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={handleNotesBlur}
                    className="min-h-[80px] text-sm border-[#eaecf3]"
                  />
                </div>

                {/* Segment Override */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Segment Override</h4>
                  <Select
                    value={c.manual_segment || "auto"}
                    onValueChange={(v) => mutations.updateManualSegment.mutate({ id: c.id, manual_segment: v === "auto" ? null : v })}
                  >
                    <SelectTrigger className="h-9 text-sm border-[#eaecf3]">
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="diamond">💎 Diamond</SelectItem>
                      <SelectItem value="gold">👑 Gold</SelectItem>
                      <SelectItem value="silver">⭐ Silver</SelectItem>
                      <SelectItem value="active">✅ Active</SelectItem>
                      <SelectItem value="inactive">😴 Inactive</SelectItem>
                      <SelectItem value="lost">💀 Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Block info */}
                {c.is_blocked && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> Customer Blocked
                    </p>
                    {c.blocked_reason && <p className="text-xs text-red-600 mt-1">Reason: {c.blocked_reason}</p>}
                    {c.blocked_at && <p className="text-[10px] text-red-500 mt-0.5">Since {format(new Date(c.blocked_at), "PP")}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Schedule Follow-up (always visible) */}
            <div className="border-t pt-4" style={{ borderColor: "#eaecf3" }}>
              <h4 className="text-sm font-semibold mb-2">
                <Clock className="w-4 h-4 inline mr-1" /> Schedule Follow-up
              </h4>
              <div className="space-y-2">
                <Input placeholder="Follow-up note..." value={followupNote} onChange={(e) => setFollowupNote(e.target.value)} className="border-[#eaecf3]" />
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1 justify-start border-[#eaecf3]">
                        <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                        {followupDate ? format(followupDate, "PP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={followupDate} onSelect={setFollowupDate} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <Input type="time" value={followupTime} onChange={(e) => setFollowupTime(e.target.value)} className="w-28 border-[#eaecf3]" />
                </div>
                <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleScheduleFollowup} disabled={!followupDate || !followupNote}>
                  ⏰ Schedule Follow-up
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Block Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" /> Block Customer
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Blocking <strong>{c.full_name}</strong> will prevent web order confirmation for this customer.
          </p>
          <Textarea placeholder="Reason for blocking (required)..." value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleBlock} disabled={!blockReason}>
              🚫 Block Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="w-5 h-5" /> Merge Duplicate
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter the phone number of the duplicate customer to merge into <strong>{c.full_name}</strong>. 
            Orders from the duplicate will be moved here, and the duplicate record will be deleted.
          </p>
          <Input placeholder="Duplicate customer phone..." value={mergePhone} onChange={(e) => setMergePhone(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleMerge} disabled={!mergePhone}>
              Merge Customers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}