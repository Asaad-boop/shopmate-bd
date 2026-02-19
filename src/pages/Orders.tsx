import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, ChannelBadge } from "@/components/ui/status-badge";
import { orderStatusConfig, paymentStatusConfig, formatBDT, formatDate } from "@/lib/format";
import { Plus, Search, Download } from "lucide-react";

export default function OrdersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", statusFilter, channelFilter, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("order_summary_view")
        .select("*")
        .order("order_date", { ascending: false })
        .limit(100);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (channelFilter !== "all") q = q.eq("channel", channelFilter);
      if (dateFrom) q = q.gte("order_date", dateFrom);
      if (dateTo) q = q.lte("order_date", dateTo + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = orders?.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(s) ||
      o.customer_name?.toLowerCase().includes(s) ||
      o.customer_phone?.includes(s)
    );
  });

  const exportCSV = () => {
    if (!filtered?.length) return;
    const headers = ["Order #", "Date", "Customer", "Phone", "Channel", "Amount", "Payment", "Status", "Tracking"];
    const rows = filtered.map((o) => [
      o.order_number, o.order_date, o.customer_name || "", o.customer_phone || "",
      o.channel, o.total_amount, o.payment_status, o.status, o.pathao_tracking_code || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground">Manage all your orders across channels</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={!filtered?.length}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Link to="/orders/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" /> New Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search order #, customer, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(orderStatusConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="shopify">Shopify</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" placeholder="From" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" placeholder="To" />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
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
                    <TableHead>Phone</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tracking</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((order) => (
                    <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/orders/${order.id}`)}>
                      <TableCell className="font-medium text-primary">{order.order_number}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(order.order_date)}</TableCell>
                      <TableCell>{order.customer_name || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{order.customer_phone || "-"}</TableCell>
                      <TableCell><ChannelBadge channel={order.channel} /></TableCell>
                      <TableCell className="font-medium">{formatBDT(order.total_amount)}</TableCell>
                      <TableCell><StatusBadge config={paymentStatusConfig} status={order.payment_status} /></TableCell>
                      <TableCell><StatusBadge config={orderStatusConfig} status={order.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{order.pathao_tracking_code || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {(!filtered || filtered.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
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
    </div>
  );
}
