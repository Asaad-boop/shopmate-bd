import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Star, ShoppingBag } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  products: any[] | undefined;
  nameSearch: string;
  skuSearch: string;
  onNameSearch: (v: string) => void;
  onSkuSearch: (v: string) => void;
  selectedProductIds: Set<string>;
  onToggleProduct: (product: any) => void;
  isLoading?: boolean;
}

export function ProductPickerCard({
  products, nameSearch, skuSearch,
  onNameSearch, onSkuSearch,
  selectedProductIds, onToggleProduct,
  isLoading,
}: Props) {
  const displayProducts = products || [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-2.5 px-3 shrink-0">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5 text-primary" /> Click To Add Products
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 flex-1 flex flex-col min-h-0">
        {/* Search row */}
        <div className="flex gap-2 mb-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Type to Search…"
              value={skuSearch}
              onChange={(e) => onSkuSearch(e.target.value)}
              className="pl-7 h-7 text-[11px]"
            />
          </div>
          <div className="relative flex-1">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Name search…"
              value={nameSearch}
              onChange={(e) => onNameSearch(e.target.value)}
              className="pl-7 h-7 text-[11px]"
            />
          </div>
          <button className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-accent transition-colors duration-150 shrink-0">
            <Star className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))
          ) : displayProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="w-6 h-6 mb-2 opacity-20" />
              <p className="text-[10px]">Search products by SKU or name</p>
            </div>
          ) : (
            displayProducts.map((p) => {
              const isSelected = selectedProductIds.has(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => onToggleProduct(p)}
                  className={cn(
                    "flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-all duration-150",
                    isSelected
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-accent/50 border border-transparent"
                  )}
                >
                  {/* Image */}
                  <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 border border-border bg-muted">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                        {p.name?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{p.name}</p>
                    <p className="text-[9px] text-muted-foreground font-mono">{p.sku}</p>
                  </div>

                  {/* Price + Stock */}
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-semibold text-primary tabular-nums">{formatBDT(p.selling_price)}</p>
                    <p className="text-[9px] text-muted-foreground">Stock: {p.stock_quantity ?? 0}</p>
                  </div>

                  {/* Star */}
                  <Star className="w-3 h-3 text-muted-foreground/30 shrink-0 hover:text-warning transition-colors duration-150" />
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
