import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Phone, MessageCircle, Copy, MapPin, User, ShoppingBag, Calendar, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface CustomerCardProps {
  order: any;
  customer: any;
}

export function CustomerCard({ order, customer }: CustomerCardProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const customerPhone = customer?.phone || "";

  const { data: prevOrders } = useQuery({
    queryKey: ["customer-prev-orders", customerPhone],
    queryFn: async () => {
      if (!customerPhone) return [];
      const { data: cust } = await supabase
        .from("customers").select("id, created_at").eq("phone", customerPhone).maybeSingle();
      if (!cust) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total_amount, created_at, channel, order_items(quantity, products(name))")
        .eq("customer_id", cust.id)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerPhone,
  });

  const { data: customerMeta } = useQuery({
    queryKey: ["customer-meta", customerPhone],
    queryFn: async () => {
      if (!customerPhone) return null;
      const { data: cust } = await supabase
        .from("customers").select("id, created_at, total_orders, total_spent").eq("phone", customerPhone).maybeSingle();
      return cust;
    },
    enabled: !!customerPhone,
  });

  const isReturning = (prevOrders?.length || 0) > 1;
  const totalOrders = customerMeta?.total_orders || prevOrders?.length || 0;
  const totalSpent = customerMeta?.total_spent || 0;
  const sinceDate = customerMeta?.created_at;

  const copyPhone = () => {
    navigator.clipboard.writeText(customerPhone);
    toast({ title: "Phone copied!" });
  };

  const statusColor = (status: string) => {
    if (status === "delivered") return "bg-emerald-100 text-emerald-700";
    if (status === "cancelled") return "bg-red-100 text-red-700";
    return "bg-amber-100 text-amber-700";
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-[#6c63ff]" /> Customer Information
          </CardTitle>
          <div className="flex items-center gap-2">
            {isReturning ? (
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs gap-1">
                🔄 Returning Customer
              </Badge>
            ) : (
              <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs gap-1">
                🆕 New Customer
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phone + actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xl font-bold font-mono tracking-wider text-foreground">{customerPhone || "—"}</span>
          <div className="flex gap-1 ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-sky-600 hover:bg-sky-50 rounded-lg"
                  onClick={() => window.open(`tel:${customerPhone}`, "_self")}>
                  <Phone className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Call</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                  onClick={() => window.open(`https://wa.me/88${customerPhone.replace(/^0/, "")}`, "_blank")}>
                  <MessageCircle className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">WhatsApp</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted rounded-lg" onClick={copyPhone}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Copy</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Name + address */}
        <div>
          <p className="font-semibold text-sm">{customer?.full_name || "Unknown"}</p>
          {(order.delivery_address || customer?.address) && (
            <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
              <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
              {order.delivery_address || customer?.address}
            </p>
          )}
        </div>

        {/* Customer stats badges */}
        {isReturning && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs bg-[#6c63ff]/5 text-[#6c63ff] border-[#6c63ff]/20 gap-1">
              <ShoppingBag className="w-3 h-3" /> {totalOrders} Orders
            </Badge>
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
              <TrendingUp className="w-3 h-3" /> {formatBDT(totalSpent)}
            </Badge>
            {sinceDate && (
              <Badge variant="outline" className="text-xs bg-muted text-muted-foreground gap-1">
                <Calendar className="w-3 h-3" /> Since {formatDate(sinceDate)}
              </Badge>
            )}
          </div>
        )}

        {/* Previous orders */}
        {isReturning && prevOrders && prevOrders.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Previous Orders</p>
            {prevOrders.filter(o => o.id !== order.id).slice(0, 5).map((o) => {
              const oItems = (o as any).order_items || [];
              const firstName = oItems[0]?.products?.name || "Product";
              const totalQty = oItems.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => navigate(`/orders/${o.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-[#6c63ff]">#{o.order_number}</span>
                    <span className="text-muted-foreground ml-2 truncate">
                      {firstName} × {totalQty} · {formatBDT(o.total_amount)} · {o.channel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge className={cn("text-[10px] px-1.5 py-0", statusColor(o.status || ""))}>
                      {o.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{formatDate(o.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
