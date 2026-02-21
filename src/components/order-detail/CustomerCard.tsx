import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, MessageCircle, Copy, MapPin, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBDT, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CustomerCardProps {
  customerId: string | null;
  customerPhone: string | null;
}

export function CustomerCard({ customerId, customerPhone }: CustomerCardProps) {
  const { toast } = useToast();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["order-detail-customer", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  // Get previous orders by phone
  const phone = customer?.phone || customerPhone;
  const { data: prevOrders } = useQuery({
    queryKey: ["customer-prev-orders", phone],
    queryFn: async () => {
      if (!phone) return [];
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();
      if (!cust) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total_amount, created_at, channel, order_items(quantity, products(name))")
        .eq("customer_id", cust.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!phone,
  });

  const isReturning = (prevOrders?.length || 0) > 1;
  const firstOrderDate = prevOrders?.length ? prevOrders[prevOrders.length - 1]?.created_at : null;

  const copyPhone = () => {
    if (phone) {
      navigator.clipboard.writeText(phone);
      toast({ title: "Phone number copied" });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-64" />
        </CardContent>
      </Card>
    );
  }

  if (!customer) return null;

  const statusColors: Record<string, string> = {
    delivered: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-100 text-red-800",
    returned: "bg-gray-100 text-gray-800",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            Customer
          </CardTitle>
          <Badge
            className={cn(
              "text-xs font-medium",
              isReturning
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            )}
            variant="outline"
          >
            {isReturning
              ? `🔄 Returning (${prevOrders?.length} orders)`
              : "🆕 New Customer"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phone row */}
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold font-mono tracking-wider">
            {customer.phone}
          </span>
          <div className="flex gap-1 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
              onClick={() => window.open(`tel:${customer.phone}`, "_self")}
            >
              <Phone className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:bg-green-50"
              onClick={() =>
                window.open(
                  `https://wa.me/${customer.phone?.replace(/[^0-9]/g, "")}`,
                  "_blank"
                )
              }
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:bg-muted"
              onClick={copyPhone}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div>
          <p className="font-medium text-sm">{customer.full_name}</p>
          {customer.address && (
            <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
              <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
              {customer.address}
            </p>
          )}
        </div>

        {isReturning && firstOrderDate && (
          <p className="text-[11px] text-muted-foreground">
            Customer since {formatDate(firstOrderDate)}
          </p>
        )}

        {/* Previous Orders */}
        {isReturning && prevOrders && prevOrders.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Previous Orders
            </p>
            {prevOrders.slice(0, 5).map((o) => {
              const items = (o as any).order_items || [];
              const firstName =
                items[0]?.products?.name || "Product";
              const totalQty = items.reduce(
                (s: number, i: any) => s + (i.quantity || 0),
                0
              );
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">#{o.order_number}</span>
                    <span className="text-muted-foreground ml-2 truncate">
                      {firstName}
                      {items.length > 1 ? ` +${items.length - 1}` : ""} · x
                      {totalQty} · {formatBDT(o.total_amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        statusColors[o.status || ""] ||
                          "bg-gray-100 text-gray-700"
                      )}
                    >
                      {o.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(o.created_at)}
                    </span>
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
