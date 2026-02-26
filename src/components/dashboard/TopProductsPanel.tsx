import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTopProducts, type TopProduct } from "@/hooks/use-dashboard-analytics";
import { formatBDT, formatNumber } from "@/lib/format";
import { ArrowRight, Package } from "lucide-react";

function ProductRow({ product, rank }: { product: TopProduct; rank: number }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/reports/sku-profit?sku=${product.sku}`)}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors group"
    >
      <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{rank}</span>
      <div className="w-10 h-10 rounded-xl bg-accent/50 flex items-center justify-center overflow-hidden shrink-0">
        {product.thumbnail ? (
          <img src={product.thumbnail} alt={product.name} className="w-full h-full object-cover rounded-xl" />
        ) : (
          <Package className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{product.sku}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold font-mono">{formatNumber(product.sales_count)}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{formatBDT(product.revenue)}</p>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

export function TopProductsPanel({ from, to }: { from?: string; to?: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useTopProducts(from, to);

  if (isLoading) return <Card className="border-0 shadow-sm rounded-[18px]"><CardContent className="p-6"><Skeleton className="h-[320px] rounded-2xl" /></CardContent></Card>;

  return (
    <Card className="border-0 shadow-sm rounded-[18px] hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Top Sales Products
        </CardTitle>
        <Button
          variant="ghost" size="sm"
          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/reports/sku-profit")}
        >
          View Full Report <ArrowRight className="w-3 h-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-6 pt-1">
        {(!data || data.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Package className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm font-medium">No sales data yet</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {data.map((p, i) => (
              <ProductRow key={i} product={p} rank={i + 1} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
