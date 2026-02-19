import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, ChannelBadge } from "@/components/ui/status-badge";
import { orderStatusConfig, paymentStatusConfig, formatBDT, formatDate } from "@/lib/format";
import { Link } from "react-router-dom";

export function RecentOrdersTable() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["dashboard-recent-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_summary_view")
        .select("*")
        .order("order_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
        <Link to="/orders" className="text-sm text-primary hover:underline">
          View all →
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(order.order_date)}</TableCell>
                    <TableCell>{order.customer_name || "-"}</TableCell>
                    <TableCell><ChannelBadge channel={order.channel} /></TableCell>
                    <TableCell className="font-medium">{formatBDT(order.total_amount)}</TableCell>
                    <TableCell><StatusBadge config={paymentStatusConfig} status={order.payment_status} /></TableCell>
                    <TableCell><StatusBadge config={orderStatusConfig} status={order.status} /></TableCell>
                  </TableRow>
                ))}
                {(!orders || orders.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No orders found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
