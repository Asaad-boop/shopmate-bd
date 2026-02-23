import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
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
import { printInvoice, printBulkInvoices, printPickingList, printPackingSlip, printBarcodeLabels } from "@/components/orders/PrintInvoice";
import { BulkActionsDropdown } from "@/components/orders/BulkActionsDropdown";
import { CODReconciliation } from "@/components/orders/CODReconciliation";
import { OrderDetailsDrawer } from "@/components/orders/OrderDetailsDrawer";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Download, Upload, ScanLine, MoreHorizontal,
  Eye, Edit, Printer, Tag, Package, Truck, CheckCircle,
  XCircle, RotateCcw, AlertTriangle, Banknote, Clock,
  ClipboardList, PackageCheck, Undo2, Flame, Copy, Loader2, MapPin, type LucideIcon
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { mapAddressToPathao } from "@/lib/address-mapper";

import { ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "packed", label: "Packed" },
  { key: "rts", label: "RTS" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "pending_return", label: "Pending Return" },
  { key: "returned", label: "Returned" },
  { key: "damage_return", label: "Damage Return" },
  { key: "partial", label: "Partial" },
  { key: "cancelled", label: "Cancelled" },
  { key: "pending_cancel", label: "Pending Cancel" },
  { key: "preorder", label: "Preorder" },
  { key: "lost", label: "Lost" },
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings: companySettings } = useCompanySettings();
  const { invoiceSettings } = useInvoiceSettings();

  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("pending");
  const [courierFilter, setCourierFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scanMode, setScanMode] = useState(false);
  const [codPanelOpen, setCodPanelOpen] = useState(false);
  const [detailsDrawer, setDetailsDrawer] = useState<{ open: boolean; orderId: string | null }>({ open: false, orderId: null });

  // Modals
  const [statusModal, setStatusModal] = useState<{ open: boolean; orderId: string; orderNumber: string; newStatus: string } | null>(null);
  const [damageModal, setDamageModal] = useState<{ open: boolean; orderId: string; orderNumber: string } | null>(null);
  const [changing, setChanging] = useState(false);

  // Direct Pathao sending state: orderId -> "sending" | "success" | "failed"
  const [pathaoSendingStatus, setPathaoSendingStatus] = useState<Record<string, "sending" | "success" | "failed">>({});

  // Pathao defaults
  const { data: pathaoDefaults } = useQuery({
    queryKey: ["pathao-defaults"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["pathao_default_store", "pathao_delivery_type", "pathao_default_weight"]);
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.key] = s.value || ""; });
      return map;
    },
    staleTime: 60 * 1000,
  });

  // Fetch orders with items and customers
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders-full", statusTab, courierFilter, paymentFilter, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, customers(full_name, phone, address), order_items(id, product_id, quantity, unit_price, total_price, products(id, name, sku, image_url, stock_quantity, weight_kg))")
        .order("order_date", { ascending: false })
        .limit(200);

      // Exclude web orders still in processing pipeline (only show confirmed or non-web orders)
      q = q.or("web_order_status.is.null,web_order_status.eq.confirm");

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
        .select("status, web_order_status")
        .or("web_order_status.is.null,web_order_status.eq.confirm");
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
    if (type === "invoice") printBulkInvoices(selected, companySettings, invoiceSettings);
    if (type === "picking") printPickingList(selected, companySettings);
    if (type === "packing") selected.forEach((o) => printPackingSlip(o, companySettings));
    if (type === "barcode") printBarcodeLabels(selected, companySettings);
  };

  // Normalise phone for Pathao
  const normalizePhone = (phone: string) => {
    let p = phone.replace(/\s+/g, "");
    if (p.startsWith("+88")) p = p.slice(3);
    else if (p.startsWith("88") && p.length > 11) p = p.slice(2);
    return p;
  };

  // Direct send to Pathao — no modal
  const sendOrderToPathao = async (order: any) => {
    const customer = order.customers as any;
    const items = (order.order_items || []) as any[];
    const storeId = pathaoDefaults?.pathao_default_store;
    const deliveryType = pathaoDefaults?.pathao_delivery_type || "48";
    const defaultWeight = pathaoDefaults?.pathao_default_weight || "0.5";

    if (!storeId) {
      toast({ title: "Pathao store সেট করুন", description: "Settings → Pathao → Default Store সেট করুন", variant: "destructive" });
      return;
    }

    if (!customer?.phone || !customer?.full_name) {
      // Mark failed
      setPathaoSendingStatus((prev) => ({ ...prev, [order.id]: "failed" }));
      await supabase.from("orders").update({ courier_status: "PATHAO_FAILED", updated_at: new Date().toISOString() }).eq("id", order.id);
      await supabase.from("web_order_notes").insert({ order_id: order.id, note_type: "activity", content: "Pathao failed: Customer info missing", created_by: "Staff" });
      toast({ title: "❌ Customer info missing", description: `#${order.order_number}`, variant: "destructive" });
      return;
    }

    // Map district → Pathao city
    const district = (order.delivery_district || customer?.district || "").trim();
    const thana = (order.delivery_thana || customer?.thana || "").trim();

    if (!district) {
      setPathaoSendingStatus((prev) => ({ ...prev, [order.id]: "failed" }));
      await supabase.from("orders").update({ courier_status: "ADDRESS_FIX_REQUIRED", updated_at: new Date().toISOString() }).eq("id", order.id);
      await supabase.from("web_order_notes").insert({ order_id: order.id, note_type: "activity", content: "Confirm blocked: mapping missing — district not found", created_by: "Staff" });
      toast({ title: "📍 Address mapping required", description: `#${order.order_number} — please fix City/Zone/Area` });
      queryClient.invalidateQueries({ queryKey: ["orders-full"] });
      return;
    }

    setPathaoSendingStatus((prev) => ({ ...prev, [order.id]: "sending" }));

    try {
      // Fetch cities
      const { data: citiesData, error: citiesErr } = await supabase.functions.invoke("pathao-proxy", { body: { action: "cities" } });
      if (citiesErr) throw citiesErr;
      const cities = citiesData?.data?.data || [];
      const matchedCity = cities.find((c: any) => c.city_name.toLowerCase().includes(district.toLowerCase()));
      if (!matchedCity) {
        // Address mapping failure — not PATHAO_FAILED
        await supabase.from("orders").update({ courier_status: "ADDRESS_FIX_REQUIRED", updated_at: new Date().toISOString() }).eq("id", order.id);
        await supabase.from("web_order_notes").insert({ order_id: order.id, note_type: "activity", content: `Confirm blocked: mapping missing — City "${district}" not found in Pathao`, created_by: "Staff" });
        setPathaoSendingStatus((prev) => ({ ...prev, [order.id]: "failed" }));
        toast({ title: "📍 Address mapping required", description: `#${order.order_number} — please fix City/Zone/Area` });
        queryClient.invalidateQueries({ queryKey: ["orders-full"] });
        return;
      }

      // Fetch zones
      const { data: zonesData, error: zonesErr } = await supabase.functions.invoke("pathao-proxy", { body: { action: "zones", city_id: matchedCity.city_id } });
      if (zonesErr) throw zonesErr;
      const zones = zonesData?.data?.data || [];
      let matchedZone = zones.find((z: any) => z.zone_name.toLowerCase().includes(thana.toLowerCase()));
      if (!matchedZone && zones.length > 0) matchedZone = zones[0]; // fallback to first zone
      if (!matchedZone) {
        await supabase.from("orders").update({ courier_status: "ADDRESS_FIX_REQUIRED", updated_at: new Date().toISOString() }).eq("id", order.id);
        await supabase.from("web_order_notes").insert({ order_id: order.id, note_type: "activity", content: `Confirm blocked: mapping missing — Zone "${thana}" not found in Pathao`, created_by: "Staff" });
        setPathaoSendingStatus((prev) => ({ ...prev, [order.id]: "failed" }));
        toast({ title: "📍 Address mapping required", description: `#${order.order_number} — please fix City/Zone/Area` });
        queryClient.invalidateQueries({ queryKey: ["orders-full"] });
        return;
      }

      // Calculate weight
      const totalWeight = items.reduce((sum: number, i: any) => sum + ((i.products as any)?.weight_kg || 0) * i.quantity, 0);
      const weight = totalWeight > 0 ? Math.round(totalWeight * 10) / 10 : Number(defaultWeight);

      const isCOD = order.payment_method?.toLowerCase() === "cod" || order.payment_status !== "paid";
      const totalItems = items.reduce((sum: number, i: any) => sum + i.quantity, 0) || 1;
      const desc = items.map((i: any) => (i.products as any)?.name).filter(Boolean).join(", ") || "";

      const orderPayload = {
        orders: [{
          store_id: Number(storeId),
          merchant_order_id: order.order_number,
          recipient_name: customer.full_name,
          recipient_phone: normalizePhone(customer.phone),
          recipient_address: order.delivery_address || customer.address || "",
          recipient_city: matchedCity.city_id,
          recipient_zone: matchedZone.zone_id,
          delivery_type: Number(deliveryType),
          item_type: 2,
          special_instruction: "",
          item_quantity: totalItems,
          item_weight: weight,
          amount_to_collect: isCOD ? Number(order.total_amount || 0) : 0,
          item_description: desc,
        }],
      };

      const { data: result, error: sendErr } = await supabase.functions.invoke("pathao-proxy", { body: { action: "create_order", order: orderPayload } });
      if (sendErr) throw sendErr;
      if (result?._ok === false) {
        const msg = result?.message || (result?.errors ? JSON.stringify(result.errors) : "Pathao API error");
        throw new Error(msg);
      }

      const consignment = result?.data?.[0] || result?.[0];
      const consignmentId = consignment?.consignment_id || "";
      const trackingCode = consignment?.tracking_code || "";

      if (consignmentId) {
        await supabase.from("orders").update({
          pathao_consignment_id: String(consignmentId),
          pathao_tracking_code: trackingCode,
          courier_status: "Pending",
          updated_at: new Date().toISOString(),
        }).eq("id", order.id);
        await supabase.from("web_order_notes").insert({ order_id: order.id, note_type: "activity", content: `Sent to Pathao • consignmentId=${consignmentId}`, created_by: "Staff" });
        toast({ title: "✅ Pathao এ পাঠানো হয়েছে!", description: `#${order.order_number} → ${consignmentId}` });
      } else {
        await supabase.from("orders").update({ courier_status: "Processing", updated_at: new Date().toISOString() }).eq("id", order.id);
        await supabase.from("web_order_notes").insert({ order_id: order.id, note_type: "activity", content: `Sent to Pathao (bulk). ${result?.message || "Processing..."}`, created_by: "Staff" });
        toast({ title: "✅ Pathao এ পাঠানো হয়েছে!", description: result?.message || "Processing..." });
      }

      setPathaoSendingStatus((prev) => ({ ...prev, [order.id]: "success" }));
      queryClient.invalidateQueries({ queryKey: ["orders-full"] });
      queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
    } catch (err: any) {
      console.error("Pathao send error:", err);
      setPathaoSendingStatus((prev) => ({ ...prev, [order.id]: "failed" }));
      await supabase.from("orders").update({ courier_status: "PATHAO_FAILED", updated_at: new Date().toISOString() }).eq("id", order.id);
      await supabase.from("web_order_notes").insert({ order_id: order.id, note_type: "activity", content: `Pathao failed: ${err.message}`, created_by: "Staff" });
      toast({ title: "❌ Pathao failed", description: `#${order.order_number}: ${err.message}`, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["orders-full"] });
    }
  };

  // Bulk send to Pathao
  const handleBulkPathaoSend = async () => {
    const selectedOrders = orders?.filter((o) => selectedIds.has(o.id)) || [];
    for (const order of selectedOrders) {
      sendOrderToPathao(order); // fire and forget per order — each manages its own state
    }
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
          <Button variant="outline" size="sm" onClick={() => setCodPanelOpen(true)}>
            <Banknote className="w-4 h-4 mr-1" /> COD Reconciliation
          </Button>
          <Button
            variant={scanMode ? "default" : "outline"}
            size="sm"
            onClick={() => setScanMode(!scanMode)}
          >
            <ScanLine className="w-4 h-4 mr-1" /> Scan Mode
          </Button>
          <BulkActionsDropdown
            selectedCount={selectedIds.size}
            totalCount={filtered?.length || 0}
            onSelectAll={toggleAll}
            onDeselect={() => setSelectedIds(new Set())}
            onStatusChange={handleBulkStatus}
            onPrint={handleBulkPrint}
            onCourier={(courier) => {
              if (courier === "pathao") {
                handleBulkPathaoSend();
              } else {
                toast({ title: `${courier} integration coming soon` });
              }
            }}
            onExport={exportCSV}
            changing={changing}
          />
          <Link to="/orders/new">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> New Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Scan Mode */}
      {scanMode && <ScanMode onStatusChange={handleStatusChange} />}

      {/* Status Tabs — Liquid Underline */}
      <div className="relative group/tabs">
        {/* Left scroll arrow */}
        <button
          onClick={() => {
            const el = document.getElementById('status-tabs-scroll');
            if (el) el.scrollBy({ left: -200, behavior: 'smooth' });
          }}
          className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-1.5 bg-gradient-to-r from-card via-card/80 to-transparent opacity-0 group-hover/tabs:opacity-100 transition-opacity duration-200"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>

        <div
          id="status-tabs-scroll"
          className="flex gap-0 overflow-x-auto border-b border-border"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          <style>{`#status-tabs-scroll::-webkit-scrollbar { display: none; }`}</style>
          {STATUS_TABS.map((tab) => {
            const isActive = statusTab === tab.key;
            const count = statusCounts?.[tab.key] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusTab(tab.key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap",
                  "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                  isActive
                    ? "text-success"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={cn(
                    "text-[11px] font-semibold min-w-[20px] h-5 px-1.5 rounded-full inline-flex items-center justify-center",
                    "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    isActive
                      ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </span>
                )}
                {/* Liquid underline indicator */}
                <span className={cn(
                  "absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full",
                  "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                  isActive
                    ? "bg-success scale-x-100"
                    : "bg-transparent scale-x-0"
                )} />
              </button>
            );
          })}
        </div>

        {/* Right scroll arrow */}
        <button
          onClick={() => {
            const el = document.getElementById('status-tabs-scroll');
            if (el) el.scrollBy({ left: 200, behavior: 'smooth' });
          }}
          className="absolute right-0 top-0 bottom-0 z-10 flex items-center px-1.5 bg-gradient-to-l from-card via-card/80 to-transparent opacity-0 group-hover/tabs:opacity-100 transition-opacity duration-200"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
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

      {/* Bulk actions now in top bar dropdown */}

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
                            {firstProduct?.image_url ? (
                              <img src={firstProduct.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {(firstProduct?.name || (items[0] as any)?.product_name_fallback || "P")[0].toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm truncate max-w-[120px]">{firstProduct?.name || (items[0] as any)?.product_name_fallback || "Product"}</p>
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
                          {pathaoSendingStatus[order.id] === "sending" ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> Sending…
                            </Badge>
                          ) : order.pathao_consignment_id ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors gap-1"
                              onClick={() => {
                                navigator.clipboard.writeText(order.pathao_consignment_id || "");
                                toast({ title: "Copied!", description: order.pathao_consignment_id });
                              }}
                            >
                              <Truck className="w-3 h-3" />
                              {order.pathao_consignment_id}
                              <Copy className="w-2.5 h-2.5" />
                            </Badge>
                          ) : order.courier_status === "ADDRESS_FIX_REQUIRED" ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 cursor-pointer gap-1"
                                    onClick={() => navigate(`/orders/${order.id}`)}
                                  >
                                    <MapPin className="w-3 h-3" /> Fix Address
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Click to fix City/Zone/Area mapping</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : order.courier_status === "PATHAO_FAILED" ? (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">
                              Failed
                            </Badge>
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
                              <DropdownMenuItem onClick={() => setDetailsDrawer({ open: true, orderId: order.id })}>
                                <ClipboardList className="w-3.5 h-3.5 mr-2 text-primary" /> Order Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printInvoice(order, companySettings, invoiceSettings)}>
                                <Printer className="w-3.5 h-3.5 mr-2" /> Print
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(order.id, order.order_number, "delivered")}
                                className="text-emerald-600"
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-2" /> Mark as Delivered
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(order.id, order.order_number, "returned")}
                                className="text-destructive"
                              >
                                <RotateCcw className="w-3.5 h-3.5 mr-2" /> Return
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
                                  {order.web_order_status && order.web_order_status !== "confirm" ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <DropdownMenuItem disabled>Pathao</DropdownMenuItem>
                                        </TooltipTrigger>
                                        <TooltipContent>Available after Confirm</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <DropdownMenuItem onClick={() => sendOrderToPathao(order)} disabled={pathaoSendingStatus[order.id] === "sending"}>
                                      Pathao
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => navigate(`/orders/${order.id}`)}>
                                <Edit className="w-3.5 h-3.5 mr-2" /> Edit Order
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


      <CODReconciliation open={codPanelOpen} onOpenChange={setCodPanelOpen} />
      <OrderDetailsDrawer
        open={detailsDrawer.open}
        onOpenChange={(open) => setDetailsDrawer({ open, orderId: open ? detailsDrawer.orderId : null })}
        orderId={detailsDrawer.orderId}
      />
    </div>
  );
}
