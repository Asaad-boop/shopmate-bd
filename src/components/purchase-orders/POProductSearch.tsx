import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, Check, Package, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  sku: string;
  image_url: string | null;
  stock_quantity: number | null;
  selling_price: number | null;
  landed_cost_bdt: number | null;
  china_price_cny: number | null;
  category_id: string | null;
}

interface POProductSearchProps {
  addedProductIds: (string | null | undefined)[];
  onSelect: (product: Product) => void;
  isAgent: boolean;
}

interface Category {
  id: string;
  name: string;
}

export function POProductSearch({ addedProductIds, onSelect, isAgent }: POProductSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // New product form
  const [newProduct, setNewProduct] = useState({
    name: "", sku: "", category_id: "", buying_price: 0,
    selling_price: 0, image_url: "",
  });
  const [saving, setSaving] = useState(false);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Search products
  useEffect(() => {
    if (query.length < 1) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("products")
        .select("id, name, sku, image_url, stock_quantity, selling_price, landed_cost_bdt, china_price_cny, category_id")
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
        .order("name")
        .limit(10);
      setResults(data || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Load categories for create form
  useEffect(() => {
    if (!showCreate || categories.length > 0) return;
    supabase.from("categories").select("id, name").order("name").then(({ data }) => {
      if (data) setCategories(data);
    });
  }, [showCreate]);

  const generateSku = () => {
    const prefix = newProduct.name.slice(0, 3).toUpperCase() || "PRD";
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
    setNewProduct(p => ({ ...p, sku: `${prefix}-${random}` }));
  };

  const handleCreateProduct = async () => {
    if (!newProduct.name) {
      toast({ title: "Product name is required", variant: "destructive" });
      return;
    }
    if (!newProduct.sku) generateSku();
    setSaving(true);
    try {
      const payload: any = {
        name: newProduct.name,
        sku: newProduct.sku || `PRD-${Math.floor(Math.random() * 9999).toString().padStart(4, "0")}`,
        category_id: newProduct.category_id || null,
        landed_cost_bdt: newProduct.buying_price || 0,
        selling_price: newProduct.selling_price || 0,
        image_url: newProduct.image_url || null,
        stock_quantity: 0,
        available_quantity: 0,
        status: "active",
      };
      if (!isAgent) {
        payload.china_price_cny = newProduct.buying_price || 0;
      }
      const { data, error } = await supabase.from("products").insert(payload).select("id, name, sku, image_url, stock_quantity, selling_price, landed_cost_bdt, china_price_cny, category_id").single();
      if (error) throw error;
      toast({ title: "Product created & added to PO!" });
      onSelect(data);
      setShowCreate(false);
      setOpen(false);
      setQuery("");
      setNewProduct({ name: "", sku: "", category_id: "", buying_price: 0, selling_price: 0, image_url: "" });
    } catch (err: any) {
      toast({ title: "Error creating product", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isAdded = (id: string) => addedProductIds.includes(id);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search product name or SKU..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setShowCreate(false); }}
          onFocus={() => { if (query.length > 0) setOpen(true); }}
          className="pl-9 h-9"
        />
      </div>

      {open && (query.length > 0 || showCreate) && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-xl shadow-xl max-h-80 overflow-y-auto">
          {loading && <div className="p-3 text-xs text-muted-foreground text-center">Searching...</div>}

          {!loading && results.length === 0 && query.length > 0 && !showCreate && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              No products found for "{query}"
            </div>
          )}

          {!showCreate && results.map(product => (
            <button
              key={product.id}
              onClick={() => {
                if (!isAdded(product.id)) {
                  onSelect(product);
                  setQuery("");
                  setOpen(false);
                }
              }}
              disabled={isAdded(product.id)}
              className={`w-full flex items-center gap-3 p-2.5 hover:bg-accent/50 transition-colors text-left ${isAdded(product.id) ? "opacity-50" : ""}`}
            >
              {product.image_url ? (
                <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Package className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{product.name}</span>
                  {isAdded(product.id) && <Check className="w-4 h-4 text-success flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5">{product.sku}</Badge>
                  <span className={`text-[10px] font-medium ${
                    (product.stock_quantity || 0) === 0 ? "text-destructive" :
                    (product.stock_quantity || 0) <= 10 ? "text-warning" : "text-success"
                  }`}>
                    Stock: {product.stock_quantity || 0}
                  </span>
                  {!isAgent && product.china_price_cny ? (
                    <span className="text-[10px] text-muted-foreground">¥{product.china_price_cny}</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">৳{product.selling_price || 0}</span>
                  )}
                </div>
              </div>
            </button>
          ))}

          {!showCreate && (
            <>
              <Separator />
              <button
                onClick={() => {
                  setShowCreate(true);
                  setNewProduct(p => ({ ...p, name: query }));
                }}
                className="w-full flex items-center gap-2 p-3 hover:bg-accent/50 transition-colors text-sm text-primary font-medium"
              >
                <Plus className="w-4 h-4" /> Create & Add New Product
              </button>
            </>
          )}

          {showCreate && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold">New Product</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowCreate(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Input placeholder="Product Name *" value={newProduct.name} onChange={(e) => setNewProduct(p => ({ ...p, name: e.target.value }))} className="h-8 text-sm" />
              <div className="flex gap-2">
                <Input placeholder="SKU" value={newProduct.sku} onChange={(e) => setNewProduct(p => ({ ...p, sku: e.target.value }))} className="h-8 text-sm flex-1" />
                <Button variant="outline" size="sm" className="h-8 text-xs px-2 whitespace-nowrap" onClick={generateSku}>Auto SKU</Button>
              </div>
              {categories.length > 0 && (
                <select
                  value={newProduct.category_id}
                  onChange={(e) => setNewProduct(p => ({ ...p, category_id: e.target.value }))}
                  className="w-full h-8 text-sm rounded-lg border border-input bg-background px-2"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground">{isAgent ? "Buying Price (৳)" : "Buying Price (CNY)"}</label>
                  <Input type="number" value={newProduct.buying_price || ""} onChange={(e) => setNewProduct(p => ({ ...p, buying_price: Number(e.target.value) }))} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground">Selling Price (৳)</label>
                  <Input type="number" value={newProduct.selling_price || ""} onChange={(e) => setNewProduct(p => ({ ...p, selling_price: Number(e.target.value) }))} className="h-8 text-sm" />
                </div>
              </div>
              <Input placeholder="Image URL (optional)" value={newProduct.image_url} onChange={(e) => setNewProduct(p => ({ ...p, image_url: e.target.value }))} className="h-8 text-xs" />
              <div className="text-[10px] text-muted-foreground">Initial Stock: 0 (updated on receive)</div>
              <Button size="sm" className="w-full h-8 gap-1.5" onClick={handleCreateProduct} disabled={saving}>
                <Plus className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save & Add to PO"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
