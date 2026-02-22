import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePurchaseOrders, usePOStats } from "@/hooks/use-purchase-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ClipboardList, Ship, Clock, CheckCircle2, Wallet,
  Plus, Download, Search, Package, Anchor, ShieldCheck,
  MoreHorizontal, Eye, Pencil,
} from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusConfig: Record<string, { label: string; icon: string; className: string }> = {
  draft: { label: "Draft", icon: "📋", className: "bg-muted text-muted-foreground" },
  ordered: { label: "Ordered", icon: "📦", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  shipped: { label: "In Transit", icon: "🚢", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  in_transit: { label: "In Transit", icon: "🚢", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  customs: { label: "Customs", icon: "🛃", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  received: { label: "Received", icon: "✅", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
};

const paymentConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Unpaid", className: "bg-destructive/10 text-destructive" },
  partial: { label: "Partially Paid", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  advance: { label: "Advance Paid", className: "bg-warning/10 text-warning" },
  paid: { label: "Fully Paid", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
};

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { data: pos, isLoading } = usePurchaseOrders();
  const { data: stats } = usePOStats();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    if (!pos) return [];
    return pos.filter((po) => {
      const matchesSearch = !search ||
        po.po_number.toLowerCase().includes(search.toLowerCase()) ||
        (po.suppliers as any)?.name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || po.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [pos, search, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelected(prev => prev.length === filtered.length ? [] : filtered.map(p => p.id));
  };

  const statCards = [
    { label: "Total POs", value: stats?.total ?? 0, icon: ClipboardList, color: "text-primary bg-primary/10" },
    { label: "In Transit", value: stats?.inTransit ?? 0, icon: Ship, color: "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/40" },
    { label: "Pending Payment", value: `৳${((stats?.pendingPayment ?? 0) / 1000).toFixed(0)}k`, icon: Clock, color: "text-warning bg-warning/10" },
    { label: "Received This Month", value: stats?.receivedThisMonth ?? 0, icon: CheckCircle2, color: "text-success bg-success/10" },
    { label: "Total Invested", value: `৳${((stats?.totalInvested ?? 0) / 1000).toFixed(0)}k`, icon: Wallet, color: "text-primary bg-primary/10" },
  ];

  const statusPills = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "ordered", label: "Ordered" },
    { key: "shipped", label: "In Transit" },
    { key: "customs", label: "Customs" },
    { key: "received", label: "Received" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border -mx-6 px-6 py-3 flex items-center justify-between" style={{ height: 52 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            🇨🇳 Purchase Orders
          </h1>
          <Badge variant="secondary" className="text-xs font-semibold">{pos?.length ?? 0}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/purchase-orders/new")}>
            <Plus className="w-4 h-4" /> New Purchase Order
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-card border border-border p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.color}`}>
                <card.icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            </div>
            <p className="text-xl font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search PO number or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {statusPills.map((p) => (
            <Button
              key={p.key}
              variant={statusFilter === p.key ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs rounded-full"
              onClick={() => setStatusFilter(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No purchase orders found</p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => navigate("/purchase-orders/new")}>
              <Plus className="w-4 h-4" /> Create First PO
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selected.length === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected Arrival</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Shipment</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((po, i) => {
                const supplier = po.suppliers as any;
                const items = po.purchase_order_items as any[] || [];
                const sc = statusConfig[po.status || "draft"] || statusConfig.draft;
                const pc = paymentConfig[po.payment_status || "pending"] || paymentConfig.pending;

                return (
                  <TableRow
                    key={po.id}
                    className="cursor-pointer animate-row-in"
                    style={{ animationDelay: `${i * 30}ms` }}
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.includes(po.id)} onCheckedChange={() => toggleSelect(po.id)} />
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-primary">{po.po_number}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span>🇨🇳</span>
                        <span className="text-sm font-medium">{supplier?.name || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{items.length} items</span>
                    </TableCell>
                    <TableCell className="text-sm">{po.order_date ? format(new Date(po.order_date), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell className="text-sm">{po.expected_arrival_date ? format(new Date(po.expected_arrival_date), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-semibold">৳{(po.total_landed_cost_bdt || 0).toLocaleString()}</p>
                        {po.total_product_cost_cny ? (
                          <p className="text-xs text-muted-foreground">¥{(po.total_product_cost_cny || 0).toLocaleString()}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] font-semibold ${pc.className}`}>{pc.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] font-semibold ${sc.className}`}>{sc.icon} {sc.label}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                            <Eye className="w-4 h-4 mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
