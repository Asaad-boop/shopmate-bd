import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Package, DollarSign, Palette, FileText, ImageIcon,
  Plus, Upload, Check, Loader2, X
} from "lucide-react";

interface Variant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
}

const SectionHeader = ({ icon: Icon, label, color }: { icon: any; label: string; color: string }) => (
  <div className={cn("flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4", color)}>
    <Icon className="w-4 h-4" />
    <span className="text-sm font-semibold">{label}</span>
  </div>
);

const defaultForm = {
  name: "",
  sku: "",
  description: "",
  category_id: "",
  supplier_id: "",
  cost_price: 0,
  selling_price: 0,
  stock_quantity: 0,
  reorder_point: 10,
  reorder_quantity: 50,
  unit: "pcs",
  image_url: "",
  weight_kg: 0,
  status: "active",
};

export default function NewProduct() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ ...defaultForm });
  const [manageStock, setManageStock] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [warrantyNote, setWarrantyNote] = useState("");
  const [shippingNote, setShippingNote] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const profitPerUnit = form.selling_price - form.cost_price;
  const profitMargin = form.selling_price > 0 ? (profitPerUnit / form.selling_price) * 100 : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const sku = form.sku || `SKU-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("products").insert({
        name: form.name,
        sku,
        description: form.description,
        category_id: form.category_id || null,
        supplier_id: form.supplier_id || null,
        landed_cost_bdt: form.cost_price,
        selling_price: form.selling_price,
        profit_per_unit: profitPerUnit,
        profit_margin_percent: profitMargin,
        stock_quantity: form.stock_quantity,
        available_quantity: form.stock_quantity,
        reorder_point: form.reorder_point,
        reorder_quantity: form.reorder_quantity,
        unit: form.unit,
        image_url: form.image_url || null,
        status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ Product created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate("/products");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error } = await supabase.storage.from('product-images').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
      update("image_url", publicUrl);
      toast({ title: "Image uploaded successfully!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    update("image_url", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addVariant = () => {
    setVariants((v) => [...v, { id: crypto.randomUUID(), name: "", sku: "", price: 0, stock: 0 }]);
  };

  const updateVariant = (id: string, field: keyof Variant, value: any) => {
    setVariants((v) => v.map((vr) => (vr.id === id ? { ...vr, [field]: value } : vr)));
  };

  const removeVariant = (id: string) => {
    setVariants((v) => v.filter((vr) => vr.id !== id));
  };

  const marginBadgeColor = profitMargin >= 30
    ? "bg-green-100 text-green-700 border-green-200"
    : profitMargin >= 15
      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
      : "bg-red-100 text-red-700 border-red-200";

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/products")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Add Product</h1>
            <p className="text-sm text-muted-foreground">Fill in the details to add a new product</p>
          </div>
        </div>
      </div>

      {/* SECTION 1 - Basic Info */}
      <Card>
        <CardContent className="pt-6">
          <section className="border-l-4 border-primary pl-4">
            <SectionHeader icon={Package} label="Basic Information" color="bg-primary/5 text-primary" />
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Product Name *</Label>
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Enter product name" className="mt-1 focus-visible:ring-primary/30 focus-visible:border-primary transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Product Code / SKU</Label>
                  <Input value={form.sku} onChange={(e) => update("sku", e.target.value)} placeholder="Auto-generated if empty" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Category</Label>
                  <Select value={form.category_id} onValueChange={(v) => update("category_id", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Supplier</Label>
                  <Select value={form.supplier_id} onValueChange={(v) => update("supplier_id", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers?.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-3 mt-2.5">
                    <Switch checked={form.status === "active"} onCheckedChange={(v) => update("status", v ? "active" : "inactive")} />
                    <span className={cn("text-sm font-medium", form.status === "active" ? "text-green-600" : "text-muted-foreground")}>
                      {form.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Description</Label>
                <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={2} placeholder="Brief product description..." className="mt-1 resize-none" />
              </div>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* SECTION 2 - Pricing & Inventory */}
      <Card>
        <CardContent className="pt-6">
          <section className="border-l-4 border-amber-400 pl-4">
            <SectionHeader icon={DollarSign} label="Pricing & Inventory" color="bg-amber-50 text-amber-700" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Cost Price ৳</Label>
                  <Input type="number" value={form.cost_price} onChange={(e) => update("cost_price", parseFloat(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Selling Price ৳ *</Label>
                  <div className="relative mt-1">
                    <Input type="number" value={form.selling_price} onChange={(e) => update("selling_price", parseFloat(e.target.value) || 0)} />
                    {form.selling_price > 0 && (
                      <span className={cn("absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all", marginBadgeColor)}>
                        Margin: {profitMargin.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Stock Quantity</Label>
                  <Input type="number" value={form.stock_quantity} onChange={(e) => update("stock_quantity", parseInt(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Alert Qty (Reorder Point)</Label>
                  <Input type="number" value={form.reorder_point} onChange={(e) => update("reorder_point", parseInt(e.target.value) || 0)} className="mt-1" />
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2.5">
                  <Switch checked={manageStock} onCheckedChange={setManageStock} />
                  <Label className="text-sm cursor-pointer">Manage Stock</Label>
                </div>
                <div className="flex items-center gap-2.5">
                  <Switch checked={featured} onCheckedChange={setFeatured} />
                  <Label className="text-sm cursor-pointer">Featured Product</Label>
                </div>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* SECTION 3 - Variants */}
      <Card>
        <CardContent className="pt-6">
          <section className="border-l-4 border-violet-400 pl-4">
            <SectionHeader icon={Palette} label="Variants (Optional)" color="bg-violet-50 text-violet-700" />
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <Switch checked={hasVariants} onCheckedChange={setHasVariants} />
                <Label className="text-sm cursor-pointer">Does this product have variants?</Label>
              </div>
              {hasVariants && (
                <div className="space-y-2 animate-fade-in">
                  {variants.length > 0 && (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="grid grid-cols-[1fr_0.8fr_0.6fr_0.5fr_40px] gap-2 px-3 py-2 bg-muted text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        <span>Variant Name</span><span>SKU</span><span>Price ৳</span><span>Stock</span><span></span>
                      </div>
                      {variants.map((v) => (
                        <div key={v.id} className="grid grid-cols-[1fr_0.8fr_0.6fr_0.5fr_40px] gap-2 px-3 py-1.5 border-t border-border items-center">
                          <Input value={v.name} onChange={(e) => updateVariant(v.id, "name", e.target.value)} placeholder="Red / XL" className="h-8 text-sm" />
                          <Input value={v.sku} onChange={(e) => updateVariant(v.id, "sku", e.target.value)} placeholder="SKU-R-XL" className="h-8 text-sm" />
                          <Input type="number" value={v.price} onChange={(e) => updateVariant(v.id, "price", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                          <Input type="number" value={v.stock} onChange={(e) => updateVariant(v.id, "stock", parseInt(e.target.value) || 0)} className="h-8 text-sm" />
                          <button onClick={() => removeVariant(v.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={addVariant} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add Variant
                  </Button>
                </div>
              )}
            </div>
          </section>
        </CardContent>
      </Card>

      {/* SECTION 4 - Additional Details */}
      <Card>
        <CardContent className="pt-6">
          <section className="border-l-4 border-sky-400 pl-4">
            <SectionHeader icon={FileText} label="Additional Details" color="bg-sky-50 text-sky-700" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Product Weight (kg)</Label>
                  <Input type="number" value={form.weight_kg} onChange={(e) => update("weight_kg", parseFloat(e.target.value) || 0)} placeholder="0.00" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Warranty</Label>
                  <Input value={warrantyNote} onChange={(e) => setWarrantyNote(e.target.value)} placeholder="e.g. 6 months" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Default Shipping Note</Label>
                  <Textarea value={shippingNote} onChange={(e) => setShippingNote(e.target.value)} rows={2} placeholder="Shipping instructions..." className="mt-1 resize-none" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Admin Note (Internal)</Label>
                  <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2} placeholder="Internal notes..." className="mt-1 resize-none" />
                </div>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* SECTION 5 - Product Image */}
      <Card>
        <CardContent className="pt-6">
          <section className="border-l-4 border-emerald-400 pl-4">
            <SectionHeader icon={ImageIcon} label="Product Image" color="bg-emerald-50 text-emerald-700" />
            <div className="space-y-3">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

              {!form.image_url && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  {uploading ? (
                    <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-2" />
                  ) : (
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  )}
                  <p className="text-sm font-medium text-muted-foreground">
                    {uploading ? "Uploading..." : "Click to browse or drag & drop"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 5MB</p>
                </div>
              )}

              {form.image_url && (
                <div className="flex items-center gap-4 animate-fade-in">
                  <img src={form.image_url} alt="Preview" className="w-24 h-24 rounded-xl object-cover border border-border" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-sm text-green-600">
                      <Check className="w-4 h-4" /> Image uploaded
                    </div>
                    <Button variant="outline" size="sm" onClick={removeImage} className="text-destructive hover:text-destructive">
                      <X className="w-3.5 h-3.5 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              )}

              {!form.image_url && !uploading && (
                <div className="flex items-center gap-2">
                  <Input
                    value={form.image_url}
                    onChange={(e) => update("image_url", e.target.value)}
                    placeholder="Or paste image URL here..."
                    className="flex-1"
                  />
                </div>
              )}
            </div>
          </section>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pb-6">
        <span className="text-xs text-muted-foreground">* Required fields</span>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/products")}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.name || mutation.isPending}
          >
            {mutation.isPending ? "Saving..." : "Save Product"}
          </Button>
        </div>
      </div>
    </div>
  );
}
