import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Package, Search, Plus, Minus, X, CheckCircle2, Pencil } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  discount: number | null;
  total_price: number;
  product_name_fallback: string | null;
  products: any;
}

interface OrderItemsCardProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
}

const FILTER_PILLS = ["All Active", "Best Sellers", "New Arrivals", "On Sale"] as const;

export function OrderItemsCard({ items, onItemsChange }: OrderItemsCardProps) {
  const [nameSearch, setNameSearch] = useState("");
  const [skuSearch, setSkuSearch] = useState("");
  const [activePill, setActivePill] = useState<string>("All Active");
  const [editModal, setEditModal] = useState<{ open: boolean; item: OrderItem | null }>({ open: false, item: null });
  const [editForm, setEditForm] = useState({ name: "", sku: "", price: 0, qty: 1, note: "" });

  const { data: products } = useQuery({
    queryKey: ["products-for-order", nameSearch, skuSearch],
    queryFn: async () => {
      let q = supabase.from("products").select("id, name, sku, selling_price, image_url, status, stock_quantity")
        .eq("status", "active").order("name").limit(20);
      if (nameSearch) q = q.ilike("name", `%${nameSearch}%`);
      if (skuSearch) q = q.ilike("sku", `%${skuSearch}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: nameSearch.length > 0 || skuSearch.length > 0,
  });

  const selectedProductIds = useMemo(() => new Set(items.map(i => i.product_id)), [items]);

  const toggleProduct = (product: any) => {
    if (selectedProductIds.has(product.id)) {
      onItemsChange(items.filter(i => i.product_id !== product.id));
    } else {
      const newItem: OrderItem = {
        id: `temp-${Date.now()}`,
        product_id: product.id,
        quantity: 1,
        unit_price: product.selling_price || 0,
        discount: 0,
        total_price: product.selling_price || 0,
        product_name_fallback: product.name,
        products: { name: product.name, sku: product.sku, image_url: product.image_url },
      };
      onItemsChange([...items, newItem]);
    }
  };

  const updateQty = (itemId: string, delta: number) => {
    onItemsChange(items.map(i => {
      if (i.id !== itemId) return i;
      const newQty = Math.max(1, i.quantity + delta);
      const disc = i.discount || 0;
      return { ...i, quantity: newQty, total_price: (i.unit_price * newQty) - disc };
    }));
  };

  const updateDiscount = (itemId: string, disc: number) => {
    onItemsChange(items.map(i => {
      if (i.id !== itemId) return i;
      return { ...i, discount: disc, total_price: (i.unit_price * i.quantity) - disc };
    }));
  };

  const removeItem = (itemId: string) => {
    onItemsChange(items.filter(i => i.id !== itemId));
  };

  const openEditModal = (item: OrderItem) => {
    const p = item.products as any;
    setEditForm({
      name: p?.name || item.product_name_fallback || "",
      sku: p?.sku || "",
      price: item.unit_price,
      qty: item.quantity,
      note: "",
    });
    setEditModal({ open: true, item });
  };

  const saveEdit = () => {
    if (!editModal.item) return;
    onItemsChange(items.map(i => {
      if (i.id !== editModal.item!.id) return i;
      const disc = i.discount || 0;
      return {
        ...i,
        unit_price: editForm.price,
        quantity: editForm.qty,
        total_price: (editForm.price * editForm.qty) - disc,
        product_name_fallback: editForm.name,
      };
    }));
    setEditModal({ open: false, item: null });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-[#6c63ff]" /> Order Items ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by SKU..."
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {FILTER_PILLS.map((pill) => (
              <button
                key={pill}
                onClick={() => setActivePill(pill)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  activePill === pill
                    ? "bg-[#6c63ff] text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {pill}
              </button>
            ))}
          </div>

          {/* Product grid */}
          {(nameSearch || skuSearch) && products && products.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[280px] overflow-y-auto pr-1">
              {products.map((p) => {
                const isSelected = selectedProductIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleProduct(p)}
                    className={cn(
                      "relative rounded-xl border p-3 cursor-pointer transition-all hover:shadow-md",
                      isSelected
                        ? "border-[#6c63ff] bg-[#6c63ff]/5 ring-2 ring-[#6c63ff]/20"
                        : "border-border hover:border-[#6c63ff]/30"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#6c63ff] flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground/30">
                          {p.name?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.sku}</p>
                    <p className="text-xs font-bold text-[#6c63ff] mt-1">{formatBDT(p.selling_price)}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected items table */}
          {items.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-xs">
                    <th className="text-left p-3 font-medium">Product</th>
                    <th className="text-center p-3 font-medium">Price</th>
                    <th className="text-center p-3 font-medium">Qty</th>
                    <th className="text-center p-3 font-medium">Discount</th>
                    <th className="text-right p-3 font-medium">Total</th>
                    <th className="text-center p-3 font-medium w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const p = item.products as any;
                    const pName = p?.name || item.product_name_fallback || "Product";
                    return (
                      <tr key={item.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-border">
                              {p?.image_url ? (
                                <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-[#6c63ff]/10 flex items-center justify-center text-[10px] font-bold text-[#6c63ff]">
                                  {pName[0].toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-xs">{pName}</p>
                              <p className="text-[10px] text-muted-foreground">{p?.sku || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center text-xs">{formatBDT(item.unit_price)}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-md bg-muted flex items-center justify-center hover:bg-muted-foreground/10">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-medium">{item.quantity}</span>
                            <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-md bg-muted flex items-center justify-center hover:bg-muted-foreground/10">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={item.discount || 0}
                            onChange={(e) => updateDiscount(item.id, Number(e.target.value) || 0)}
                            className="h-7 w-16 text-center text-xs mx-auto"
                          />
                        </td>
                        <td className="p-3 text-right text-xs font-semibold">{formatBDT(item.total_price)}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEditModal(item)} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-[#6c63ff]">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => removeItem(item.id)} className="w-6 h-6 rounded-md hover:bg-red-50 flex items-center justify-center text-muted-foreground hover:text-red-600">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {items.length === 0 && (
            <div className="text-center py-8">
              <Package className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No items in this order</p>
              <p className="text-xs text-muted-foreground">Search products above to add items</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit modal */}
      <Dialog open={editModal.open} onOpenChange={(o) => setEditModal({ open: o, item: editModal.item })}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Product Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">SKU</Label>
                <Input value={editForm.sku} readOnly className="bg-muted" />
              </div>
              <div>
                <Label className="text-xs">Price (৳)</Label>
                <Input type="number" value={editForm.price} onChange={(e) => setEditForm(f => ({ ...f, price: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quantity</Label>
                <Input type="number" value={editForm.qty} onChange={(e) => setEditForm(f => ({ ...f, qty: Number(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label className="text-xs">Variant/Note</Label>
                <Input value={editForm.note} onChange={(e) => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal({ open: false, item: null })}>Cancel</Button>
            <Button onClick={saveEdit} className="bg-[#6c63ff] hover:bg-[#5a52d5]">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
