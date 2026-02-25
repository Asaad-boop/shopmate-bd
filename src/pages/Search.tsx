import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Search as SearchIcon, Package, Users, ShoppingCart, X, Clock, ArrowRight, ExternalLink } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { StatusBadge, ORDER_STATUS_CONFIG } from "@/components/ui/status-badge";
import {
  useGlobalSearch,
  useRecentSearches,
  type SearchOrderResult,
  type SearchCustomerResult,
  type SearchProductResult,
} from "@/hooks/use-global-search";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ);
  const [activeTab, setActiveTab] = useState("orders");
  const [previewItem, setPreviewItem] = useState<{ type: string; data: any } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { results, isLoading, queryType } = useGlobalSearch(debouncedQuery);
  const { searches, recentItems, addSearch, addRecentItem, clearSearches } = useRecentSearches();

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      if (query.trim().length >= 2) {
        setSearchParams({ q: query.trim() }, { replace: true });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // Auto-select best tab based on query type
  useEffect(() => {
    if (!results) return;
    if (queryType === "phone" && (results.customers.length || results.orders.length)) {
      setActiveTab(results.customers.length ? "customers" : "orders");
    } else if (queryType === "sku" && results.products.length) {
      setActiveTab("products");
    } else if (queryType === "tracking" && results.orders.length) {
      setActiveTab("orders");
    }
  }, [results, queryType]);

  // Submit search
  const handleSubmit = useCallback(() => {
    if (query.trim()) addSearch(query.trim());
  }, [query, addSearch]);

  const openOrder = (o: SearchOrderResult) => {
    addRecentItem({ type: "order", id: o.id, label: o.invoice_id || o.order_number, sub: o.customer_name || "" });
    setPreviewItem({ type: "order", data: o });
  };
  const openCustomer = (c: SearchCustomerResult) => {
    addRecentItem({ type: "customer", id: c.id, label: c.full_name, sub: c.phone });
    setPreviewItem({ type: "customer", data: c });
  };
  const openProduct = (p: SearchProductResult) => {
    addRecentItem({ type: "product", id: p.id, label: p.name, sub: p.sku || "" });
    setPreviewItem({ type: "product", data: p });
  };

  const orderCount = results?.orders?.length || 0;
  const customerCount = results?.customers?.length || 0;
  const productCount = results?.products?.length || 0;
  const hasResults = orderCount + customerCount + productCount > 0;
  const showEmpty = debouncedQuery.length >= 2 && !isLoading && !hasResults;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">Global Search</h1>

      {/* Search input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search orders, customers, products, tracking IDs, SKUs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-12 text-lg"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setDebouncedQuery(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {/* Recent searches when no query */}
      {!debouncedQuery && (
        <div className="space-y-4">
          {searches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">Recent Searches</h3>
                <Button variant="ghost" size="sm" onClick={clearSearches} className="text-xs">Clear</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {searches.map((s) => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => { setQuery(s); setDebouncedQuery(s); }}
                  >
                    <Clock className="w-3 h-3 mr-1" /> {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {recentItems.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Recently Opened</h3>
              <div className="grid gap-1">
                {recentItems.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-accent transition-colors"
                    onClick={() => {
                      if (item.type === "order") navigate(`/orders/${item.id}`);
                      else if (item.type === "customer") navigate(`/crm`);
                      else navigate(`/products`);
                    }}
                  >
                    {item.type === "order" && <ShoppingCart className="w-4 h-4 text-primary" />}
                    {item.type === "customer" && <Users className="w-4 h-4 text-primary" />}
                    {item.type === "product" && <Package className="w-4 h-4 text-primary" />}
                    <span className="font-medium text-sm">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!searches.length && !recentItems.length && (
            <p className="text-muted-foreground text-sm">Type to search across orders, products, customers, and tracking IDs.</p>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && debouncedQuery.length >= 2 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      )}

      {/* Empty state */}
      {showEmpty && (
        <div className="text-center py-12 text-muted-foreground">
          <SearchIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No results found</p>
          <p className="text-sm">Try a different search term</p>
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="orders">Orders ({orderCount})</TabsTrigger>
            <TabsTrigger value="customers">Customers ({customerCount})</TabsTrigger>
            <TabsTrigger value="products">Products ({productCount})</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-3">
            <div className="border rounded-lg divide-y divide-border overflow-hidden">
              {results!.orders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => openOrder(o)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                >
                  <ShoppingCart className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{o.invoice_id || o.order_number}</span>
                      <StatusBadge config={ORDER_STATUS_CONFIG} status={o.status} />
                      {o.courier_sync_status === "SYNCED" && <Badge variant="outline" className="text-[10px]">Synced</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {o.customer_name} • {o.customer_phone} • {o.tracking_id || o.pathao_tracking_code || "No tracking"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">{formatBDT(o.total_amount || 0)}</span>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="customers" className="mt-3">
            <div className="border rounded-lg divide-y divide-border overflow-hidden">
              {results!.customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openCustomer(c)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                >
                  <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm">{c.full_name}</span>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.phone} • {c.district || "—"} • {c.total_orders || 0} orders
                    </p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">{formatBDT(c.total_spent || 0)}</span>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="products" className="mt-3">
            <div className="border rounded-lg divide-y divide-border overflow-hidden">
              {results!.products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openProduct(p)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                >
                  <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{p.name}</span>
                      {p.status === "active" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px]">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      SKU: {p.sku || "—"} • Stock: {p.stock_quantity ?? 0}
                    </p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">{formatBDT(p.selling_price || 0)}</span>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Preview Drawer */}
      <Sheet open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {previewItem?.type === "order" && <OrderPreview data={previewItem.data} />}
          {previewItem?.type === "customer" && <CustomerPreview data={previewItem.data} />}
          {previewItem?.type === "product" && <ProductPreview data={previewItem.data} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function OrderPreview({ data }: { data: SearchOrderResult }) {
  const navigate = useNavigate();
  return (
    <>
      <SheetHeader>
        <SheetTitle>{data.invoice_id || data.order_number}</SheetTitle>
        <SheetDescription>Order details preview</SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Status</span><div className="mt-1"><StatusBadge config={ORDER_STATUS_CONFIG} status={data.status} /></div></div>
          <div><span className="text-muted-foreground">Total</span><p className="font-semibold">{formatBDT(data.total_amount || 0)}</p></div>
          <div><span className="text-muted-foreground">Customer</span><p>{data.customer_name || "—"}</p></div>
          <div><span className="text-muted-foreground">Phone</span><p>{data.customer_phone || "—"}</p></div>
          <div><span className="text-muted-foreground">Tracking</span><p className="break-all">{data.tracking_id || data.pathao_tracking_code || "—"}</p></div>
          <div><span className="text-muted-foreground">Courier</span><p>{data.courier_name || "—"}</p></div>
          <div><span className="text-muted-foreground">Date</span><p>{data.order_date || "—"}</p></div>
          <div><span className="text-muted-foreground">Sync</span><div className="mt-1"><Badge variant={data.courier_sync_status === "SYNCED" ? "default" : "secondary"}>{data.courier_sync_status}</Badge></div></div>
        </div>
        <Button className="w-full" onClick={() => navigate(`/orders/${data.id}`)}>
          <ExternalLink className="w-4 h-4 mr-2" /> Open Full Page
        </Button>
      </div>
    </>
  );
}

function CustomerPreview({ data }: { data: SearchCustomerResult }) {
  const navigate = useNavigate();
  return (
    <>
      <SheetHeader>
        <SheetTitle>{data.full_name}</SheetTitle>
        <SheetDescription>Customer details preview</SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Phone</span><p className="font-semibold">{data.phone}</p></div>
          <div><span className="text-muted-foreground">District</span><p>{data.district || "—"}</p></div>
          <div><span className="text-muted-foreground">Total Orders</span><p>{data.total_orders || 0}</p></div>
          <div><span className="text-muted-foreground">Total Spent</span><p className="font-semibold">{formatBDT(data.total_spent || 0)}</p></div>
          <div><span className="text-muted-foreground">Last Order</span><p>{data.last_order_date || "—"}</p></div>
          <div><span className="text-muted-foreground">Segment</span><p>{data.segment || "—"}</p></div>
          <div className="col-span-2"><span className="text-muted-foreground">Address</span><p className="text-xs">{data.address || "—"}</p></div>
        </div>
        <Button className="w-full" onClick={() => navigate("/crm")}>
          <ExternalLink className="w-4 h-4 mr-2" /> Open in CRM
        </Button>
      </div>
    </>
  );
}

function ProductPreview({ data }: { data: SearchProductResult }) {
  const navigate = useNavigate();
  return (
    <>
      <SheetHeader>
        <SheetTitle>{data.name}</SheetTitle>
        <SheetDescription>Product details preview</SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-4">
        {data.image_url && (
          <img src={data.image_url} alt={data.name} className="w-full h-40 object-contain rounded-lg bg-muted" />
        )}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">SKU</span><p className="font-mono font-semibold">{data.sku || "—"}</p></div>
          <div><span className="text-muted-foreground">Status</span><div className="mt-1"><Badge variant={data.status === "active" ? "default" : "secondary"}>{data.status}</Badge></div></div>
          <div><span className="text-muted-foreground">Stock</span><p className={`font-semibold ${(data.stock_quantity || 0) < 0 ? "text-destructive" : ""}`}>{data.stock_quantity ?? 0}</p></div>
          <div><span className="text-muted-foreground">Price</span><p className="font-semibold">{formatBDT(data.selling_price || 0)}</p></div>
          <div><span className="text-muted-foreground">Cost</span><p>{formatBDT(data.cost_price || 0)}</p></div>
        </div>
        <Button className="w-full" onClick={() => navigate("/products")}>
          <ExternalLink className="w-4 h-4 mr-2" /> Open Products
        </Button>
      </div>
    </>
  );
}
