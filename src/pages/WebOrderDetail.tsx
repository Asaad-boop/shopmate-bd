import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowLeft, Phone, MessageCircle, Send, Clock } from "lucide-react";
import {
  AlertDialog as AlertDialogRoot,
  AlertDialogAction as ADAction,
  AlertDialogCancel as ADCancel,
  AlertDialogContent as ADContent,
  AlertDialogDescription as ADDesc,
  AlertDialogFooter as ADFooter,
  AlertDialogHeader as ADHeader,
  AlertDialogTitle as ADTitle,
  AlertDialogTrigger as ADTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_BUTTONS = [
  { key: "processing", label: "Processing", emoji: "🟡", color: "bg-yellow-500 hover:bg-yellow-600 text-white" },
  { key: "confirm", label: "Confirm", emoji: "🟢", color: "bg-green-500 hover:bg-green-600 text-white" },
  { key: "good_but_no_response", label: "Good But No Response", emoji: "🟢", color: "bg-emerald-500 hover:bg-emerald-600 text-white" },
  { key: "no_response", label: "No Response", emoji: "🔴", color: "bg-red-500 hover:bg-red-600 text-white" },
  { key: "on_hold", label: "On Hold", emoji: "⏸️", color: "bg-blue-500 hover:bg-blue-600 text-white" },
  { key: "advance_payment", label: "Advance Payment", emoji: "💰", color: "bg-amber-500 hover:bg-amber-600 text-white" },
  { key: "cancel", label: "Cancel", emoji: "❌", color: "bg-red-600 hover:bg-red-700 text-white" },
] as const;

export default function WebOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [callResult, setCallResult] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["web-order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(full_name, phone, phone2, address, district, thana, segment, total_orders, total_spent, email)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: items } = useQuery({
    queryKey: ["web-order-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(name, sku, image_url)")
        .eq("order_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: notes } = useQuery({
    queryKey: ["web-order-notes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("web_order_notes")
        .select("*")
        .eq("order_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const oldStatus = order?.web_order_status || "processing";
      const { error } = await supabase
        .from("orders")
        .update({ web_order_status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id!);
      if (error) throw error;
      // Log status change
      await supabase.from("web_order_notes").insert({
        order_id: id,
        note_type: "status_change",
        content: `Status changed from ${oldStatus} to ${newStatus}`,
        old_status: oldStatus,
        new_status: newStatus,
        created_by: "Staff",
      });
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: ["web-order", id] });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      // Update web order status to confirm
      await supabase
        .from("orders")
        .update({ web_order_status: "confirm", status: "confirmed", updated_at: new Date().toISOString() })
        .eq("id", id!);
      // Log
      await supabase.from("web_order_notes").insert({
        order_id: id,
        note_type: "activity",
        content: "Order confirmed and moved to main order processing",
        created_by: "Staff",
      });
    },
    onSuccess: () => {
      toast({ title: "Order confirmed!", description: "Moved to main order processing" });
      setShowConfirmDialog(false);
      queryClient.invalidateQueries({ queryKey: ["web-order", id] });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const noteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("web_order_notes").insert({
        order_id: id,
        note_type: "note",
        content: newNote,
        created_by: "Staff",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewNote("");
      toast({ title: "Note added" });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const callLogMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("web_order_notes").insert({
        order_id: id,
        note_type: "call_log",
        content: `Call made — Result: ${callResult}`,
        call_result: callResult,
        created_by: "Staff",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCallResult("");
      toast({ title: "Call logged" });
      queryClient.invalidateQueries({ queryKey: ["web-order-notes", id] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6"><Skeleton className="h-60 w-full" /></div>
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  if (!order) return <div className="text-center py-12 text-muted-foreground">Order not found</div>;

  const customer = order.customers as any;
  const currentStatus = order.web_order_status || "processing";

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const noteTypeIcon = (type: string) => {
    switch (type) {
      case "call_log": return "📞";
      case "status_change": return "🔄";
      case "activity": return "⚡";
      default: return "📝";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/web-orders")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{order.order_number}</h1>
            <Badge variant="secondary" className="capitalize">{order.channel}</Badge>
            <Badge className={cn("text-xs",
              currentStatus === "processing" ? "bg-yellow-500" :
              currentStatus === "confirm" ? "bg-green-500" :
              currentStatus === "cancel" ? "bg-red-500" :
              currentStatus === "no_response" ? "bg-red-400" :
              "bg-blue-500"
            )}>
              {currentStatus.replace(/_/g, " ").toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{formatDateTime(order.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="font-medium text-lg">{customer?.full_name || "Unknown"}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{customer?.phone || "-"}</span>
                    {customer?.phone && (
                      <>
                        <a href={`tel:${customer.phone}`} className="p-1 rounded bg-primary/10 text-primary hover:bg-primary/20">
                          <Phone className="w-4 h-4" />
                        </a>
                        <a
                          href={`https://wa.me/${customer.phone?.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      </>
                    )}
                  </div>
                  {customer?.phone2 && <p className="text-sm text-muted-foreground">Alt: {customer.phone2}</p>}
                  <p className="text-sm text-muted-foreground">{customer?.address || "-"}</p>
                  <p className="text-sm text-muted-foreground">
                    {[customer?.district, customer?.thana].filter(Boolean).join(", ") || "-"}
                  </p>
                </div>
                <div className="text-right text-sm space-y-1">
                  <Badge variant="outline" className="capitalize">{customer?.segment || "regular"}</Badge>
                  <p className="text-muted-foreground">Orders: {customer?.total_orders || 0}</p>
                  <p className="text-muted-foreground">Spent: {formatBDT(customer?.total_spent)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Call Log */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Log a Call</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {["answered", "no_answer", "busy", "voicemail"].map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={callResult === r ? "default" : "outline"}
                    onClick={() => setCallResult(r)}
                    className="capitalize"
                  >
                    {r === "answered" ? "✅" : r === "no_answer" ? "📵" : r === "busy" ? "🔴" : "📩"}{" "}
                    {r.replace("_", " ")}
                  </Button>
                ))}
                <Button
                  size="sm"
                  onClick={() => callLogMutation.mutate()}
                  disabled={!callResult || callLogMutation.isPending}
                >
                  <Send className="w-4 h-4 mr-1" /> Log Call
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items?.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className="w-12 h-12 rounded bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
                      {(item.products as any)?.image_url ? (
                        <img src={(item.products as any).image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground">IMG</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{(item.products as any)?.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">SKU: {(item.products as any)?.sku || "-"}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p>×{item.quantity} • {formatBDT(item.unit_price)}</p>
                      <p className="font-medium">{formatBDT(item.total_price)}</p>
                    </div>
                  </div>
                ))}
                {(!items || items.length === 0) && <p className="text-center text-muted-foreground py-4 text-sm">No items</p>}
              </div>
              <Separator className="my-4" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBDT(order.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{formatBDT(order.discount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{formatBDT(order.delivery_charge)}</span></div>
                <div className="flex justify-between font-bold text-base border-t border-border pt-2"><span>Total</span><span>{formatBDT(order.total_amount)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes & Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="flex-1"
                />
                <Button
                  onClick={() => noteMutation.mutate()}
                  disabled={!newNote.trim() || noteMutation.isPending}
                  className="self-end"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side */}
        <div className="space-y-6">
          {/* Status Buttons */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Update Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {STATUS_BUTTONS.map((s) => {
                if (s.key === "confirm") {
                  return (
                    <AlertDialogRoot key={s.key} open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                      <ADTrigger asChild>
                        <Button
                          className={cn("w-full justify-start text-left", s.color)}
                          disabled={currentStatus === s.key || statusMutation.isPending}
                        >
                          <span className="mr-2">{s.emoji}</span> {s.label}
                        </Button>
                      </ADTrigger>
                      <ADContent>
                        <ADHeader>
                          <ADTitle>Confirm Order?</ADTitle>
                          <ADDesc>
                            Move this order to main order processing? The order status will be set to "confirmed" and it will appear in the regular Orders page.
                          </ADDesc>
                        </ADHeader>
                        <ADFooter>
                          <ADCancel>Cancel</ADCancel>
                          <ADAction onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
                            {confirmMutation.isPending ? "Confirming..." : "Yes, Confirm Order"}
                          </ADAction>
                        </ADFooter>
                      </ADContent>
                    </AlertDialogRoot>
                  );
                }
                return (
                  <Button
                    key={s.key}
                    className={cn("w-full justify-start text-left", s.color)}
                    onClick={() => statusMutation.mutate(s.key)}
                    disabled={currentStatus === s.key || statusMutation.isPending}
                  >
                    <span className="mr-2">{s.emoji}</span> {s.label}
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notes?.map((note) => (
                  <div key={note.id} className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <span className="text-sm">{noteTypeIcon(note.note_type)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{note.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{note.created_by || "System"}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(note.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {(!notes || notes.length === 0) && (
                  <p className="text-center text-muted-foreground py-4 text-sm">No activity yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Order Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="capitalize">{order.payment_method || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Payment Status</span><span className="capitalize">{order.payment_status || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{order.delivery_district || "-"}, {order.delivery_thana || "-"}</span></div>
              {order.notes && (
                <div className="pt-2 border-t border-border">
                  <p className="text-muted-foreground text-xs">Order Notes</p>
                  <p className="text-sm mt-1">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
