import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/lib/format";
import { Plus, Search, Grid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import AddProductModal from "@/components/products/AddProductModal";

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [stockFilter, setStockFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", stockFilter],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("*, categories(name)")
        .eq("status", "active")
        .order("name");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = products?.filter((p) => {
    if (search) {
      const s = search.toLowerCase();
      if (!p.name.toLowerCase().includes(s) && !p.sku.toLowerCase().includes(s)) return false;
    }
    if (stockFilter === "low") return (p.stock_quantity || 0) <= (p.reorder_point || 10);
    if (stockFilter === "out") return (p.stock_quantity || 0) === 0;
    return true;
  });

  const getStockBadge = (qty: number | null, reorder: number | null) => {
    const q = qty || 0;
    const r = reorder || 10;
    if (q === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (q <= r) return <Badge className="bg-warning text-warning-foreground">Low Stock ({q})</Badge>;
    if (q <= r * 2) return <Badge className="bg-yellow-100 text-yellow-800">{q}</Badge>;
    return <Badge className="bg-green-100 text-green-800">{q}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1 border border-border rounded-lg p-0.5">
              <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("list")}>
                <List className="w-4 h-4" />
              </Button>
              <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("grid")}>
                <Grid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : view === "list" ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Selling Price</TableHead>
                    <TableHead>Landed Cost</TableHead>
                    <TableHead>Profit Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">IMG</div>
                          )}
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.sku}</TableCell>
                      <TableCell className="text-sm">{(p.categories as any)?.name || "-"}</TableCell>
                      <TableCell>{getStockBadge(p.stock_quantity, p.reorder_point)}</TableCell>
                      <TableCell className="font-medium">{formatBDT(p.selling_price)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatBDT(p.landed_cost_bdt)}</TableCell>
                      <TableCell>
                        <span className={cn("text-sm font-medium", (p.profit_margin_percent || 0) > 30 ? "text-success" : "text-warning")}>
                          {(p.profit_margin_percent || 0).toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!filtered || filtered.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">No products found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered?.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground text-sm">No Image</span>
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                <p className="text-xs text-muted-foreground">{p.sku}</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold">{formatBDT(p.selling_price)}</span>
                  {getStockBadge(p.stock_quantity, p.reorder_point)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddProductModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
