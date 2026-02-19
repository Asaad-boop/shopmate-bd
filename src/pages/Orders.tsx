import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { orderStatusConfig, paymentStatusConfig, formatBDT, formatDate } from "@/lib/format";
import { applyStatusChange, applyDamageReturn } from "@/hooks/use-orders";
import { StatusChangeModal } from "@/components/orders/StatusChangeModal";
import { DamageReturnModal } from "@/components/orders/DamageReturnModal";
import { ScanMode } from "@/components/orders/ScanMode";
import { PathaoBookingModal } from "@/components/pathao/PathaoBookingModal";
import { printInvoice, printPickingList, printPackingSlip, printBarcodeLabels } from "@/components/orders/PrintInvoice";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Download, Upload, ScanLine, MoreHorizontal,
  Eye, Edit, Printer, Tag, Package, Truck, CheckCircle,
  XCircle, RotateCcw, AlertTriangle
} from "lucide-react";

const STATUS_TABS = [
  { key: "all", label: "ALL", emoji: "📋", color: "" },
  { key: "pending", label: "Pending", emoji: "🕐", color: "bg-yellow-500" },
  { key: "packed", label: "Packed", emoji: "📦", color: "bg-blue-500" },
  { key: "shipped", label: "Shipped", emoji: "🚚", color: "bg-indigo-500" },
  { key: "delivered", label: "Delivered", emoji: "✅", color: "bg-green-500" },
  { key: "cancelled", label: "Cancelled", emoji: "❌", color: "bg-red-500" },
  { key: "pending_return", label: "Pending Return", emoji: "🔄", color: "bg-orange-500" },
  { key: "returned", label: "Returned", emoji: "↩️", color: "bg-gray-500" },
  { key: "damage_return", label: "Damage Return", emoji: "💥", color: "bg-red-700" },
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [courierFilter, setCourierFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scanMode, setScanMode] = useState(false);

  // Modals
  const [statusModal, setStatusModal] = useState<{ open: boolean; orderId: string; orderNumber: string; newStatus: string } | null>(null);
  const [damageModal, setDamageModal] = useState<{ open: boolean; orderId: string; orderNumber: string } | null>(null);
  const [pathaoModal, setPathaoModal] = useState<{ open: boolean; order: any; customer: any; items: any[] } | null>(null);
  const [changing, setChanging] = useState(false);

  // Fetch orders with items and customers
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders-full", statusTab, courierFilter, paymentFilter, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, customers(full_name, phone, address), order_items(id, product_id, quantity, unit_price, total_price, products(id, name, sku, image_url, stock_quantity, weight_kg))")
        .order("order_date", { ascending: false })
        .limit(200);

      if (statusTab !== "all") q = q.eq("status", statusTab);
      if (courierFilter === "pathao") q = q.not("pathao_consignment_id", "is", null);
      if (paymentFilter === "cod") q = q.eq("payment_method", "cod");
      if (paymentFilter === "paid") q = q.eq("payment_status", "paid");
      if (dateFrom) q = q.gte("order_date", dateFrom);
      if (dateTo) q = q.lte("order_date", dateTo + "T23:59:59");

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Status counts
  const { data: statusCounts } = useQuery({
    queryKey: ["order-status-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("status");
      const counts: Record<string, number> = { all: data?.length || 0 };
      data?.forEach((o: any) => {
        const s = o.status || "pending";
        counts[s] = (counts[s] || 0) + 1;
      });
      return counts;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["orders-full"] });
        queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
        if (payload.eventType === "INSERT") {
          toast({ title: "🛍️ নতুন order এসেছে!", description: `#${(payload.new as any).order_number}` });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, toast]);

  // Filter
  const filtered = orders?.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(s) ||
      (o.customers as any)?.full_name?.toLowerCase().includes(s) ||
      (o.customers as any)?.phone?.includes(s)
    );
  });

  // Selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!filtered) return;
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((o) => o.id)));
    }
  };

  // Status change handler
  const handleStatusChange = useCallback((orderId: string, orderNumber: string, newStatus: string) => {
    if (newStatus === "damage_return") {
      setDamageModal({ open: true, orderId, orderNumber });
    } else {
      setStatusModal({ open: true, orderId, orderNumber, newStatus });
    }
  }, []);

  const confirmStatusChange = async () => {
    if (!statusModal) return;
    setChanging(true);
    const order = orders?.find((o) => o.id === statusModal.orderId);
    await applyStatusChange(statusModal.orderId, statusModal.newStatus, order?.status || null);
    queryClient.invalidateQueries({ queryKey: ["orders-full"] });
    queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
    toast({ title: "✅ Status updated", description: `#${statusModal.orderNumber} → ${orderStatusConfig[statusModal.newStatus]?.label}` });
    setStatusModal(null);
    setChanging(false);
  };

  const confirmDamageReturn = async (items: any[]) => {
    if (!damageModal) return;
    setChanging(true);
    await applyDamageReturn(damageModal.orderId, items);
    queryClient.invalidateQueries({ queryKey: ["orders-full"] });
    queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
    toast({ title: "💥 Damage return recorded", description: `#${damageModal.orderNumber}` });
    setDamageModal(null);
    setChanging(false);
  };

  // Bulk status change
  const handleBulkStatus = async (newStatus: string) => {
    setChanging(true);
    let productCount = 0;
    for (const id of selectedIds) {
      const order = orders?.find((o) => o.id === id);
      if (order) {
        await applyStatusChange(id, newStatus, order.status || null);
        productCount += (order.order_items as any[])?.length || 0;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["orders-full"] });
    queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
    toast({
      title: `✅ ${selectedIds.size} orders updated`,
      description: `Stock adjusted for ${productCount} products`,
    });
    setSelectedIds(new Set());
    setChanging(false);
  };

  // Bulk print
  const handleBulkPrint = (type: "invoice" | "picking" | "packing" | "barcode") => {
    const selected = orders?.filter((o) => selectedIds.has(o.id)) || [];
    if (type === "invoice") selected.forEach(printInvoice);
    if (type === "picking") printPickingList(selected);
    if (type === "packing") selected.forEach(printPackingSlip);
    if (type === "barcode") printBarcodeLabels(selected);
  };

  // Send to Pathao
  const openPathaoModal = (order: any) => {
    setPathaoModal({
      open: true,
      order,
      customer: order.customers,
      items: order.order_items || [],
    });
  };

  // CSV Export
  const exportCSV = () => {
    if (!filtered?.length) return;
    const headers = ["Order #", "Date", "Customer", "Phone", "Channel", "Amount", "Payment", "Status", "Tracking"];
    const rows = filtered.map((o) => [
      o.order_number, o.order_date, (o.customers as any)?.full_name || "", (o.customers as any)?.phone || "",
      o.channel, o.total_amount, o.payment_status, o.status, o.pathao_tracking_code || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground">Manage all your orders across channels</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={scanMode ? "default" : "outline"}
            size="sm"
            onClick={() => setScanMode(!scanMode)}
          >
            <ScanLine className="w-4 h-4 mr-1" /> Scan Mode
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered?.length}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
          <Link to="/orders/new">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> New Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Scan Mode */}
      {scanMode && <ScanMode onStatusChange={handleStatusChange} />}

      {/* Status Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
              statusTab === tab.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
            {statusCounts && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                statusTab === tab.key ? "bg-primary-foreground/20" : "bg-muted"
              }`}>
                {statusCounts[tab.key] || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search order #, customer, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[140px] h-9" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[140px] h-9" />
            <Select value={courierFilter} onValueChange={setCourierFilter}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Couriers</SelectItem>
                <SelectItem value="pathao">Pathao</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment</SelectItem>
                <SelectItem value="cod">COD</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 bg-card border rounded-lg p-3 flex flex-wrap items-center gap-2 shadow-sm">
          <span className="text-sm font-medium">{selectedIds.size} টি order selected</span>
          <div className="flex gap-1.5 flex-wrap ml-auto">
            <Button size="sm" variant="outline" onClick={() => handleBulkStatus("packed")} disabled={changing}>
              <Package className="w-3.5 h-3.5 mr-1" /> Packed
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkStatus("shipped")} disabled={changing}>
              <Truck className="w-3.5 h-3.5 mr-1" /> Shipped
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkStatus("delivered")} disabled={changing}>
              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Delivered
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkStatus("cancelled")} disabled={changing}>
              <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
            </Button>
            <div className="w-px bg-border mx-1 h-6 self-center" />
            <Button size="sm" variant="outline" onClick={() => handleBulkPrint("invoice")}>
              <Printer className="w-3.5 h-3.5 mr-1" /> Invoice
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkPrint("picking")}>
              📋 Picking
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkPrint("packing")}>
              📦 Packing
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkPrint("barcode")}>
              <Tag className="w-3.5 h-3.5 mr-1" /> Barcode
            </Button>
          </div>
        </div>
      )}

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
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered?.length ? selectedIds.size === filtered.length : false}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((order) => {
                    const customer = order.customers as any;
                    const items = (order.order_items || []) as any[];
                    const firstProduct = items[0]?.products;

                    return (
                      <TableRow key={order.id} className="group">
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(order.id)}
                            onCheckedChange={() => toggleSelect(order.id)}
                          />
                        </TableCell>
                        <TableCell
                          className="font-medium text-primary cursor-pointer"
                          onClick={() => navigate(`/orders/${order.id}`)}
                        >
                          {order.order_number}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(order.order_date)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{customer?.full_name || "-"}</p>
                            <p className="text-xs text-muted-foreground">{customer?.phone || ""}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {firstProduct?.image_url && (
                              <img
                                src={firstProduct.image_url}
                                alt=""
                                className="w-8 h-8 rounded object-cover"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm truncate max-w-[120px]">{firstProduct?.name || "-"}</p>
                              <div className="flex gap-1">
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  ×{items[0]?.quantity || 0}
                                </Badge>
                                {items.length > 1 && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                                    +{items.length - 1} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{formatBDT(order.total_amount)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              order.payment_method?.toLowerCase() === "cod"
                                ? "bg-orange-100 text-orange-800 border-orange-200"
                                : order.payment_status === "paid"
                                ? "bg-green-100 text-green-800 border-green-200"
                                : ""
                            }`}
                          >
                            {order.payment_method?.toUpperCase() || "COD"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.pathao_consignment_id ? (
                            <div>
                              <p className="text-xs font-mono">{order.pathao_tracking_code}</p>
                              <Badge variant="outline" className="text-[10px]">
                                {order.courier_status || "Pending"}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge config={orderStatusConfig} status={order.status} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => navigate(`/orders/${order.id}`)}>
                                <Eye className="w-3.5 h-3.5 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {Object.entries(orderStatusConfig)
                                    .filter(([key]) => key !== order.status)
                                    .map(([key, val]) => (
                                      <DropdownMenuItem
                                        key={key}
                                        onClick={() => handleStatusChange(order.id, order.order_number, key)}
                                      >
                                        <span className="mr-2">{(val as any).emoji}</span>
                                        {val.label}
                                        {["pending"].includes(key) && (
                                          <span className="ml-auto text-[10px] text-destructive">⚠️ stock -</span>
                                        )}
                                        {["cancelled", "returned"].includes(key) && (
                                          <span className="ml-auto text-[10px] text-green-600">✅ stock +</span>
                                        )}
                                      </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>📮 Send to Courier</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  <DropdownMenuItem onClick={() => openPathaoModal(order)}>
                                    Pathao
                                  </DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => printInvoice(order)}>
                                <Printer className="w-3.5 h-3.5 mr-2" /> Print Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printBarcodeLabels([order])}>
                                <Tag className="w-3.5 h-3.5 mr-2" /> Print Barcode
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!filtered || filtered.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
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

      {/* Modals */}
      {statusModal && (
        <StatusChangeModal
          open={statusModal.open}
          onOpenChange={(open) => !open && setStatusModal(null)}
          orderId={statusModal.orderId}
          orderNumber={statusModal.orderNumber}
          newStatus={statusModal.newStatus}
          newStatusLabel={orderStatusConfig[statusModal.newStatus]?.label || statusModal.newStatus}
          onConfirm={confirmStatusChange}
          loading={changing}
        />
      )}

      {damageModal && (
        <DamageReturnModal
          open={damageModal.open}
          onOpenChange={(open) => !open && setDamageModal(null)}
          orderId={damageModal.orderId}
          orderNumber={damageModal.orderNumber}
          onConfirm={confirmDamageReturn}
          loading={changing}
        />
      )}

      {pathaoModal && (
        <PathaoBookingModal
          open={pathaoModal.open}
          onOpenChange={(open) => !open && setPathaoModal(null)}
          order={pathaoModal.order}
          customer={pathaoModal.customer}
          items={pathaoModal.items}
        />
      )}
    </div>
  );
}
