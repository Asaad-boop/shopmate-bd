import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Minus, Plus, Trash2, Pencil } from "lucide-react";
import { formatBDT } from "@/lib/format";

interface Props {
  items: any[];
  onUpdateQty: (id: string, delta: number) => void;
  onUpdateDiscount: (id: string, disc: number) => void;
  onUpdatePrice: (id: string, price: number) => void;
  onRemove: (id: string) => void;
  onEdit: (item: any) => void;
  isLoading?: boolean;
}

export function OrderedProductsCard({ items, onUpdateQty, onUpdateDiscount, onUpdatePrice, onRemove, onEdit, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="py-2.5 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-primary" /> Ordered Products
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-2.5 px-3 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-primary" /> Ordered Products
          </CardTitle>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 tabular-nums">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-xs">No product added yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => {
              const p = item.products as any;
              const name = p?.name || item.product_name_fallback || "Product";
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 p-2 rounded-md border border-border/50 hover:bg-accent/30 transition-colors duration-150 group"
                >
                  {/* Thumbnail */}
                  <div className="w-9 h-9 rounded-md overflow-hidden shrink-0 border border-border bg-muted">
                    {p?.image_url ? (
                      <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {name[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Name + SKU */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-muted-foreground font-mono">{p?.sku || "—"}</span>
                      {p?.stock_quantity != null && (
                        <span className="text-[9px] text-muted-foreground">Stock: {p.stock_quantity}</span>
                      )}
                    </div>
                  </div>

                  {/* Qty */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => onUpdateQty(item.id, -1)}
                      className="w-5 h-5 rounded bg-muted flex items-center justify-center hover:bg-accent transition-colors duration-150"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="w-6 text-center text-[11px] font-semibold tabular-nums">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQty(item.id, 1)}
                      className="w-5 h-5 rounded bg-muted flex items-center justify-center hover:bg-accent transition-colors duration-150"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {/* Price */}
                  <Input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => onUpdatePrice(item.id, Number(e.target.value) || 0)}
                    className="h-6 w-16 text-center text-[10px] tabular-nums shrink-0"
                  />

                  {/* Total */}
                  <span className="text-[11px] font-semibold w-14 text-right tabular-nums shrink-0">
                    {formatBDT(item.total_price)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                    <button
                      onClick={() => onEdit(item)}
                      className="w-5 h-5 rounded hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-primary transition-colors duration-150"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="w-5 h-5 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors duration-150"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
