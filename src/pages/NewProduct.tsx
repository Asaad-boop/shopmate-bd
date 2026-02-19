import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { formatBDT } from "@/lib/format";

export default function NewProduct() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    sku: "",
    description: "",
    category_id: "",
    supplier_id: "",
    china_price_cny: 0,
    china_price_usd: 0,
    shipping_cost_per_unit: 0,
    customs_duty_per_unit: 0,
    other_cost_per_unit: 0,
    selling_price: 0,
    stock_quantity: 0,
    reorder_point: 10,
    reorder_quantity: 50,
    unit: "pcs",
  });

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

  const landedCost = form.china_price_usd * 110 + form.shipping_cost_per_unit + form.customs_duty_per_unit + form.other_cost_per_unit;
  const profitPerUnit = form.selling_price - landedCost;
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
        china_price_cny: form.china_price_cny,
        china_price_usd: form.china_price_usd,
        shipping_cost_per_unit: form.shipping_cost_per_unit,
        customs_duty_per_unit: form.customs_duty_per_unit,
        other_cost_per_unit: form.other_cost_per_unit,
        landed_cost_bdt: landedCost,
        selling_price: form.selling_price,
        profit_per_unit: profitPerUnit,
        profit_margin_percent: profitMargin,
        stock_quantity: form.stock_quantity,
        available_quantity: form.stock_quantity,
        reorder_point: form.reorder_point,
        reorder_quantity: form.reorder_quantity,
        unit: form.unit,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Product created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate("/products");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/products")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add Product</h1>
          <p className="text-sm text-muted-foreground">Add a new product to your catalog</p>
        </div>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="pricing">Pricing & Cost</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="supplier">Supplier</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>Product Name *</Label>
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Product name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>SKU</Label>
                  <Input value={form.sku} onChange={(e) => update("sku", e.target.value)} placeholder="Auto-generated if empty" />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category_id} onValueChange={(v) => update("category_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>China Price (CNY ¥)</Label>
                  <Input type="number" value={form.china_price_cny} onChange={(e) => update("china_price_cny", parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>China Price (USD $)</Label>
                  <Input type="number" value={form.china_price_usd} onChange={(e) => update("china_price_usd", parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Shipping/unit (৳)</Label>
                  <Input type="number" value={form.shipping_cost_per_unit} onChange={(e) => update("shipping_cost_per_unit", parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Customs Duty/unit (৳)</Label>
                  <Input type="number" value={form.customs_duty_per_unit} onChange={(e) => update("customs_duty_per_unit", parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Other Costs/unit (৳)</Label>
                  <Input type="number" value={form.other_cost_per_unit} onChange={(e) => update("other_cost_per_unit", parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Landed Cost (BDT)</span>
                  <span className="font-semibold">{formatBDT(landedCost)}</span>
                </div>
                <div>
                  <Label>Selling Price (৳)</Label>
                  <Input type="number" value={form.selling_price} onChange={(e) => update("selling_price", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profit per Unit</span>
                  <span className={profitPerUnit >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                    {formatBDT(profitPerUnit)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profit Margin</span>
                  <span className={profitMargin >= 30 ? "text-success font-semibold" : "text-warning font-semibold"}>
                    {profitMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Current Stock</Label>
                  <Input type="number" value={form.stock_quantity} onChange={(e) => update("stock_quantity", parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Reorder Point</Label>
                  <Input type="number" value={form.reorder_point} onChange={(e) => update("reorder_point", parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Reorder Quantity</Label>
                  <Input type="number" value={form.reorder_quantity} onChange={(e) => update("reorder_quantity", parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => update("unit", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Pieces</SelectItem>
                    <SelectItem value="kg">Kilogram</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="set">Set</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supplier">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>Supplier</Label>
                <Select value={form.supplier_id} onValueChange={(v) => update("supplier_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/products")}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={!form.name || mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Product"}
        </Button>
      </div>
    </div>
  );
}
