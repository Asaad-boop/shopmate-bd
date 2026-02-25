import { useState } from "react";
import { useGoodsReceipts } from "@/hooks/use-purchasing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Package, Eye } from "lucide-react";
import { format } from "date-fns";
import { GRNCreateModal } from "./GRNCreateModal";
import { GRNDetailDrawer } from "./GRNDetailDrawer";

export function GRNTab() {
  const { data: grns, isLoading } = useGoodsReceipts();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedGrnId, setSelectedGrnId] = useState<string | null>(null);

  const filtered = grns?.filter((g) => {
    if (statusFilter !== "all" && g.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.grn_number.toLowerCase().includes(q) ||
      (g.suppliers as any)?.name?.toLowerCase().includes(q)
    );
  }) || [];

  const statusBadge = (s: string) => {
    if (s === "posted") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border text-[10px]">✅ Posted</Badge>;
    if (s === "reversed") return <Badge className="bg-destructive/10 text-destructive border-destructive/20 border text-[10px]">⛔ Reversed</Badge>;
    return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 border text-[10px]">📋 Draft</Badge>;
  };

  // Stats
  const draftCount = grns?.filter((g) => g.status === "draft").length || 0;
  const postedCount = grns?.filter((g) => g.status === "posted").length || 0;
  const totalValue = grns?.filter((g) => g.status === "posted").reduce((s, g) => s + (g.total_product_cost || 0), 0) || 0;

  return (
    <div className="space-y-4 mt-4">
      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Draft</p>
          <p className="text-lg font-bold text-amber-600">{draftCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Posted</p>
          <p className="text-lg font-bold text-emerald-600">{postedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Received Value</p>
          <p className="text-lg font-bold text-foreground">৳{totalValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search GRN..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="reversed">Reversed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" /> New GRN
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Package className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No goods receipts found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">GRN #</TableHead>
                <TableHead className="text-xs">Supplier</TableHead>
                <TableHead className="text-xs">PO</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs w-16">Items</TableHead>
                <TableHead className="text-xs text-right">Total</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((g, i) => {
                const itemCount = (g.goods_receipt_items as any[])?.length || 0;
                return (
                  <TableRow
                    key={g.id}
                    className="cursor-pointer hover:bg-muted/50 animate-row-in"
                    style={{ animationDelay: `${i * 25}ms` }}
                    onClick={() => setSelectedGrnId(g.id)}
                  >
                    <TableCell className="font-bold text-primary text-sm">{g.grn_number}</TableCell>
                    <TableCell className="text-sm">{(g.suppliers as any)?.name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(g.purchase_orders as any)?.po_number || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {g.receipt_type === "IMPORT" ? "🚢 Import" : "🏠 Local"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{format(new Date(g.receipt_date), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-sm text-center">{itemCount}</TableCell>
                    <TableCell className="text-sm font-semibold text-right">৳{(g.total_product_cost || 0).toLocaleString()}</TableCell>
                    <TableCell>{statusBadge(g.status)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedGrnId(g.id); }}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <GRNCreateModal open={modalOpen} onOpenChange={setModalOpen} />
      <GRNDetailDrawer grnId={selectedGrnId} onClose={() => setSelectedGrnId(null)} />
    </div>
  );
}
