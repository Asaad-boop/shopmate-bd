import { useState } from "react";
import { useInventoryMovements } from "@/hooks/use-inventory";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

const MOVEMENT_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  order_pending: { label: "Order Placed", color: "bg-red-100 text-red-800", emoji: "🔴" },
  order_cancelled: { label: "Order Cancelled", color: "bg-green-100 text-green-800", emoji: "🟢" },
  order_returned: { label: "Order Returned", color: "bg-green-100 text-green-800", emoji: "🟢" },
  damage_return: { label: "Damage Return", color: "bg-gray-100 text-gray-800", emoji: "⚫" },
  manual_adjustment: { label: "Manual Adjustment", color: "bg-blue-100 text-blue-800", emoji: "🔵" },
  purchase_received: { label: "Purchase Received", color: "bg-purple-100 text-purple-800", emoji: "🟣" },
};

interface Props {
  products: any[];
}

export default function MovementHistory({ products }: Props) {
  const [productFilter, setProductFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: movements, isLoading } = useInventoryMovements(
    productFilter !== "all" ? productFilter : undefined
  );

  const filtered = movements?.filter((m: any) => {
    if (typeFilter !== "all" && m.movement_type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const name = (m.products as any)?.name?.toLowerCase() || "";
      const sku = (m.products as any)?.sku?.toLowerCase() || "";
      if (!name.includes(s) && !sku.includes(s) && !m.notes?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search movements..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Products" /></SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="all">All Products</SelectItem>
            {products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(MOVEMENT_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="overflow-x-auto border rounded-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Qty Change</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Staff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((m: any) => {
                const cfg = MOVEMENT_CONFIG[m.movement_type] || { label: m.movement_type, color: "bg-muted text-muted-foreground", emoji: "⚪" };
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm whitespace-nowrap">{formatDateTime(m.created_at)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{(m.products as any)?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{(m.products as any)?.sku || ""}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", cfg.color)}>{cfg.emoji} {cfg.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "font-bold text-sm",
                        m.quantity > 0 ? "text-success" : m.quantity < 0 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.notes || "—"}</TableCell>
                    <TableCell className="text-sm">{(m.staff as any)?.full_name || "—"}</TableCell>
                  </TableRow>
                );
              })}
              {(!filtered || filtered.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">No movements found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
