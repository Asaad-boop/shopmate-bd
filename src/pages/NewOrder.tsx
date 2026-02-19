import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { useBDCourierSingle, getRiskLevel } from "@/hooks/use-bd-courier";
import { cn } from "@/lib/utils";
interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}

export default function NewOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    channel: "manual",
    customer_phone: "",
    customer_name: "",
    delivery_address: "",
    delivery_district: "",
    delivery_thana: "",
    payment_method: "cod",
    payment_status: "pending",
    discount: 0,
    delivery_charge: 60,
    notes: "",
  });
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const { data: products } = useQuery({
    queryKey: ["products-for-order"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, selling_price, landed_cost_bdt, stock_quantity")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-search", form.customer_phone],
    queryFn: async () => {
      if (form.customer_phone.length < 3) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, phone, address, district, thana")
        .ilike("phone", `%${form.customer_phone}%`)
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: form.customer_phone.length >= 3,
  });

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const total = subtotal - form.discount + form.delivery_charge;

  const addProduct = (p: any) => {
    if (items.find((i) => i.product_id === p.id)) return;
    setItems([
      ...items,
      {
        product_id: p.id,
        product_name: p.name,
        quantity: 1,
        unit_price: p.selling_price || 0,
        unit_cost: p.landed_cost_bdt || 0,
      },
    ]);
    setProductSearch("");
  };

  const removeItem = (pid: string) => setItems(items.filter((i) => i.product_id !== pid));
  const updateItem = (pid: string, field: string, val: number) =>
    setItems(items.map((i) => (i.product_id === pid ? { ...i, [field]: val } : i)));

  const selectCustomer = (c: any) => {
    setForm({
      ...form,
      customer_phone: c.phone,
      customer_name: c.full_name,
      delivery_address: c.address || "",
      delivery_district: c.district || "",
      delivery_thana: c.thana || "",
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      // Find or create customer
      let customer_id: string | null = null;
      if (form.customer_phone) {
        const { data: existing } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", form.customer_phone)
          .maybeSingle();
        if (existing) {
          customer_id = existing.id;
        } else if (form.customer_name) {
          const { data: newC, error } = await supabase
            .from("customers")
            .insert({
              phone: form.customer_phone,
              full_name: form.customer_name,
              address: form.delivery_address,
              district: form.delivery_district,
              thana: form.delivery_thana,
            })
            .select("id")
            .single();
          if (error) throw error;
          customer_id = newC.id;
        }
      }

      const orderNum = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const costOfGoods = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          order_number: orderNum,
          channel: form.channel,
          customer_id,
          delivery_address: form.delivery_address,
          delivery_district: form.delivery_district,
          delivery_thana: form.delivery_thana,
          payment_method: form.payment_method,
          payment_status: form.payment_status,
          subtotal,
          discount: form.discount,
          delivery_charge: form.delivery_charge,
          total_amount: total,
          cost_of_goods: costOfGoods,
          gross_profit: total - costOfGoods - form.delivery_charge,
          cod_amount: form.payment_method === "cod" ? total : 0,
          notes: form.notes,
          status: "pending",
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;

      const orderItems = items.map((i) => ({
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        unit_cost: i.unit_cost,
        total_price: i.quantity * i.unit_price,
        profit: i.quantity * (i.unit_price - i.unit_cost),
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      return order;
    },
    onSuccess: () => {
      toast({ title: "Order created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      navigate("/orders");
    },
    onError: (err: any) => {
      toast({ title: "Error creating order", description: err.message, variant: "destructive" });
    },
  });

  const filteredProducts = products?.filter(
    (p) =>
      productSearch &&
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Order</h1>
          <p className="text-sm text-muted-foreground">Create a new order manually</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Label>Phone Number</Label>
                <div className="flex gap-2 items-start">
                  <div className="flex-1 relative">
                    <Input
                      value={form.customer_phone}
                      onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                      placeholder="01XXXXXXXXX"
                    />
                    {customers && customers.length > 0 && (
                      <div className="absolute z-10 w-full bg-card border border-border rounded-md mt-1 shadow-lg">
                        {customers.map((c) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-4 py-2 hover:bg-muted text-sm"
                            onClick={() => selectCustomer(c)}
                          >
                            {c.full_name} - {c.phone}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <PhoneRiskIndicator phone={form.customer_phone} />
                </div>
              </div>
              <div>
                <Label>Customer Name</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="Customer full name"
                />
              </div>
              <div>
                <Label>Delivery Address</Label>
                <Textarea
                  value={form.delivery_address}
                  onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
                  placeholder="Full delivery address"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>District</Label>
                  <Input
                    value={form.delivery_district}
                    onChange={(e) => setForm({ ...form, delivery_district: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Thana</Label>
                  <Input
                    value={form.delivery_thana}
                    onChange={(e) => setForm({ ...form, delivery_thana: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products by name or SKU..."
                />
                {filteredProducts && filteredProducts.length > 0 && (
                  <div className="absolute z-10 w-full bg-card border border-border rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-4 py-2 hover:bg-muted text-sm flex justify-between"
                        onClick={() => addProduct(p)}
                      >
                        <span>{p.name} ({p.sku})</span>
                        <span className="text-muted-foreground">৳{p.selling_price} | Stock: {p.stock_quantity}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {items.length > 0 && (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.product_id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product_name}</p>
                      </div>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.product_id, "quantity", parseInt(e.target.value) || 1)}
                        className="w-20"
                        min={1}
                      />
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(item.product_id, "unit_price", parseFloat(e.target.value) || 0)}
                        className="w-28"
                      />
                      <span className="text-sm font-medium w-24 text-right">
                        {formatBDT(item.quantity * item.unit_price)}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(item.product_id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {items.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Search and add products above
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Channel</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shopify">🛍️ Shopify</SelectItem>
                    <SelectItem value="facebook">📘 Facebook</SelectItem>
                    <SelectItem value="instagram">📸 Instagram</SelectItem>
                    <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                    <SelectItem value="phone">📞 Phone</SelectItem>
                    <SelectItem value="manual">✍️ Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cod">Cash on Delivery</SelectItem>
                    <SelectItem value="bkash">bKash</SelectItem>
                    <SelectItem value="nagad">Nagad</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Status</Label>
                <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatBDT(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Discount</span>
                <Input
                  type="number"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })}
                  className="w-24 text-right h-8"
                />
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Delivery Charge</span>
                <Input
                  type="number"
                  value={form.delivery_charge}
                  onChange={(e) => setForm({ ...form, delivery_charge: parseFloat(e.target.value) || 0 })}
                  className="w-24 text-right h-8"
                />
              </div>
              <div className="border-t border-border pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span>{formatBDT(total)}</span>
              </div>
              <Button
                className="w-full mt-4"
                onClick={() => mutation.mutate()}
                disabled={items.length === 0 || mutation.isPending}
              >
                {mutation.isPending ? "Creating..." : "Create Order"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PhoneRiskIndicator({ phone }: { phone: string }) {
  const { data, isLoading } = useBDCourierSingle(phone, phone.length >= 11);
  
  if (phone.length < 11) return null;
  if (isLoading) return <Skeleton className="h-10 w-28 rounded-lg" />;
  
  const risk = getRiskLevel(data?.success_rate);
  
  return (
    <Badge className={cn("h-10 px-3 text-xs whitespace-nowrap", risk.bg, risk.color)}>
      {risk.label}
      {data?.success_rate != null && ` ${data.success_rate}%`}
    </Badge>
  );
}
