import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Minus, X, Check, Package } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  sku: string;
  image_url: string | null;
  unit_price: number;
  quantity: number;
  discount: number;
  total_price: number;
}

interface OrderItemsCardProps {
  items: OrderItem[];
  onChange: (items: OrderItem[]) => void;
}

export function OrderItemsCard({ items, onChange }: OrderItemsCardProps) {
  const [searchName, setSearchName] = useState("");
  const [searchSku, setSearchSku] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: products, isLoading } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, selling_price, image_url, status, stock_quantity")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    let list = products || [];
    if (searchName) {
      const s = searchName.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(s));
    }
    if (searchSku) {
      const s = searchSku.toLowerCase();
      list = list.filter((p) => p.sku.toLowerCase().includes(s));
    }
    return list.slice(0, 12);
  }, [products, searchName, searchSku, filter]);

  const selectedIds = new Set(items.map((i) => i.product_id));

  const addProduct = (p: any) => {
    if (selectedIds.has(p.id)) return;
    const newItem: OrderItem = {
      product_id: p.id,
      product_name: p.name,
      sku: p.sku,
      image_url: p.image_url,
      unit_price: p.selling_price || 0,
      quantity: 1,
      discount: 0,
      total_price: p.selling_price || 0,
    };
    onChange([...items, newItem]);
  };

  const updateItem = (idx: number, field: string, value: number) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    const item = updated[idx];
    item.total_price = item.unit_price * item.quantity - item.discount;
    onChange(updated);
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          Order Items
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Product Search */}
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="pl-9 h-9 text-sm rounded-lg"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by SKU..."
              value={searchSku}
              onChange={(e) => setSearchSku(e.target.value)}
              className="pl-9 h-9 text-sm rounded-lg"
            />
          </div>
        </div>

        {/* Product Grid */}
        {(searchName || searchSku) && (
          <div className="grid grid-cols-3 gap-2 max-h-[240px] overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))
            ) : filtered.length === 0 ? (
              <p className="col-span-3 text-center text-sm text-muted-foreground py-4">
                No products found
              </p>
            ) : (
              filtered.map((p) => {
                const isSelected = selectedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    disabled={isSelected}
                    className={cn(
                      "relative flex flex-col items-center gap-1 p-3 rounded-lg border text-center transition-all text-xs",
                      isSelected
                        ? "border-primary bg-primary/5 opacity-70"
                        : "border-border hover:border-primary/50 hover:shadow-sm"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-md overflow-hidden border border-border shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {p.name[0]}
                        </div>
                      )}
                    </div>
                    <p className="font-medium truncate w-full">{p.name}</p>
                    <p className="text-muted-foreground">{p.sku}</p>
                    <p className="font-semibold">{formatBDT(p.selling_price)}</p>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Selected Items Table */}
        {items.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">Product</th>
                  <th className="text-right py-2 px-2 font-medium">Price</th>
                  <th className="text-center py-2 px-2 font-medium">Qty</th>
                  <th className="text-right py-2 px-2 font-medium">Disc.</th>
                  <th className="text-right py-2 px-2 font-medium">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-t border-border">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-md overflow-hidden border border-border shrink-0">
                          {item.image_url ? (
                            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                              {item.product_name[0]}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-xs truncate">{item.product_name}</p>
                          <p className="text-[10px] text-muted-foreground">{item.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-2 text-xs">{formatBDT(item.unit_price)}</td>
                    <td className="px-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => updateItem(idx, "quantity", Math.max(1, item.quantity - 1))}
                          className="w-6 h-6 rounded-md border border-border flex items-center justify-center hover:bg-muted"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateItem(idx, "quantity", item.quantity + 1)}
                          className="w-6 h-6 rounded-md border border-border flex items-center justify-center hover:bg-muted"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-2">
                      <Input
                        type="number"
                        value={item.discount || ""}
                        onChange={(e) => updateItem(idx, "discount", Number(e.target.value) || 0)}
                        className="h-7 w-16 text-xs text-right ml-auto"
                        placeholder="0"
                      />
                    </td>
                    <td className="text-right px-2 text-xs font-semibold">{formatBDT(item.total_price)}</td>
                    <td className="px-2">
                      <button
                        onClick={() => removeItem(idx)}
                        className="w-6 h-6 rounded-md text-destructive hover:bg-destructive/10 flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Search and select products above to add items
          </div>
        )}
      </CardContent>
    </Card>
  );
}
