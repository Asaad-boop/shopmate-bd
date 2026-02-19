import { useState, useEffect, useCallback, useRef } from "react";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Minus, X, Search, Package,
  Phone, MessageCircle, Instagram, ShoppingBag, PenLine,
} from "lucide-react";
import { formatBDT } from "@/lib/format";
import { useBDCourierSingle, getRiskLevel, getSuccessColor } from "@/hooks/use-bd-courier";
import { usePathaoCities, usePathaoZones } from "@/hooks/use-pathao";
import { cn } from "@/lib/utils";

/* ═══ Types ═══ */
interface OrderItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_image: string | null;
  stock_quantity: number;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}

const CHANNELS = [
  { value: "manual", label: "Manual", emoji: "✍️", color: "text-muted-foreground" },
  { value: "facebook", label: "Facebook", emoji: "📘", color: "text-blue-600" },
  { value: "instagram", label: "Instagram", emoji: "📸", color: "text-pink-600" },
  { value: "whatsapp", label: "WhatsApp", emoji: "💬", color: "text-green-600" },
  { value: "phone", label: "Call", emoji: "📞", color: "text-indigo-600" },
];

const PAYMENT_METHODS = [
  { value: "cod", label: "💰 Cash on Delivery" },
  { value: "advance_bkash", label: "📱 Advance Payment (bKash)" },
  { value: "advance_nagad", label: "📱 Advance Payment (Nagad)" },
  { value: "advance_bank", label: "🏦 Advance Payment (Bank)" },
  { value: "advance_cash", label: "💵 Advance Payment (Cash)" },
  { value: "partial", label: "🔀 Partial (Advance + COD)" },
];

function getPaymentStatus(method: string) {
  if (method === "cod") return "pending";
  if (method.startsWith("advance_")) return "paid";
  if (method === "partial") return "partial";
  return "pending";
}

function getPaymentVia(method: string) {
  if (method === "advance_bkash" || method === "partial") return "bKash";
  if (method === "advance_nagad") return "Nagad";
  if (method === "advance_bank") return "Bank";
  if (method === "advance_cash") return "Cash";
  return "";
}

/* ═══ Main Component ═══ */
export default function NewOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const productSearchRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    channel: "manual",
    customer_phone: "",
    customer_phone2: "",
    customer_name: "",
    delivery_address: "",
    delivery_district: "",
    delivery_thana: "",
    payment_method: "cod",
    advance_amount: 0,
    payment_via: "",
    transaction_id: "",
    discount: 0,
    delivery_charge: 60,
    notes: "",
  });
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);

  const isAdvance = form.payment_method.startsWith("advance_");
  const isPartial = form.payment_method === "partial";
  const showAdvanceFields = isAdvance || isPartial;
  const paymentStatus = getPaymentStatus(form.payment_method);

  /* ── Queries ── */
  const { data: products } = useQuery({
    queryKey: ["products-for-order"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, selling_price, landed_cost_bdt, stock_quantity, image_url")
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
        .select("id, full_name, phone, phone2, address, district, thana")
        .or(`phone.ilike.%${form.customer_phone}%,full_name.ilike.%${form.customer_phone}%`)
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: form.customer_phone.length >= 3,
  });

  const { data: cities } = usePathaoCities();
  const { data: zones } = usePathaoZones(selectedCityId);

  /* ── BD Courier ── */
  const { data: bdReport, isLoading: bdLoading } = useBDCourierSingle(form.customer_phone, form.customer_phone.length >= 11);
  const riskInfo = getRiskLevel(bdReport?.success_rate);

  /* ── Derived ── */
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const advancePaid = showAdvanceFields ? form.advance_amount : 0;
  const total = subtotal - form.discount + form.delivery_charge;
  const codRemaining = total - advancePaid;

  /* ── Auto-set payment_via when method changes ── */
  useEffect(() => {
    if (form.payment_method.startsWith("advance_")) {
      setForm((f) => ({ ...f, payment_via: getPaymentVia(f.payment_method) }));
    }
  }, [form.payment_method]);

  /* ── Keyboard shortcut: Ctrl+Enter to create ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (form.customer_phone && items.length > 0 && !mutation.isPending) {
          mutation.mutate();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [form, items]);

  /* ── Handlers ── */
  const updateForm = useCallback((updates: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...updates }));
  }, []);

  const selectCustomer = (c: any) => {
    setForm((f) => ({
      ...f,
      customer_phone: c.phone,
      customer_phone2: c.phone2 || "",
      customer_name: c.full_name,
      delivery_address: c.address || "",
      delivery_district: c.district || "",
      delivery_thana: c.thana || "",
    }));
    setShowCustomerDropdown(false);

    // Try to match district to pathao city
    if (c.district && cities) {
      const match = cities.find((ct) => ct.city_name.toLowerCase() === c.district?.toLowerCase());
      if (match) setSelectedCityId(match.city_id);
    }
  };

  const addProduct = (p: any) => {
    if (items.find((i) => i.product_id === p.id)) {
      setItems((prev) => prev.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems((prev) => [
        ...prev,
        {
          product_id: p.id,
          product_name: p.name,
          product_sku: p.sku,
          product_image: p.image_url,
          stock_quantity: p.stock_quantity || 0,
          quantity: 1,
          unit_price: p.selling_price || 0,
          unit_cost: p.landed_cost_bdt || 0,
        },
      ]);
    }
    setProductSearch("");
    productSearchRef.current?.focus();
  };

  const removeItem = (pid: string) => setItems((prev) => prev.filter((i) => i.product_id !== pid));
  const updateItem = (pid: string, field: string, val: number) =>
    setItems((prev) => prev.map((i) => (i.product_id === pid ? { ...i, [field]: Math.max(field === "quantity" ? 1 : 0, val) } : i)));

  const handleProductKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && filteredProducts && filteredProducts.length > 0) {
      e.preventDefault();
      addProduct(filteredProducts[0]);
    }
  };

  const handleDistrictSelect = (cityName: string) => {
    updateForm({ delivery_district: cityName, delivery_thana: "" });
    const match = cities?.find((c) => c.city_name === cityName);
    setSelectedCityId(match?.city_id || null);
  };

  /* ── Create Order Mutation ── */
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
          // Update customer info
          await supabase.from("customers").update({
            full_name: form.customer_name,
            address: form.delivery_address,
            district: form.delivery_district,
            thana: form.delivery_thana,
            phone2: form.customer_phone2 || null,
          }).eq("id", existing.id);
        } else if (form.customer_name) {
          const { data: newC, error } = await supabase
            .from("customers")
            .insert({
              phone: form.customer_phone,
              phone2: form.customer_phone2 || null,
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

      // Determine COD amount
      let codAmount = 0;
      if (form.payment_method === "cod") codAmount = total;
      else if (isPartial) codAmount = codRemaining;

      const notesArr = [form.notes];
      if (showAdvanceFields && form.advance_amount > 0) {
        notesArr.push(`Advance: ৳${form.advance_amount} via ${form.payment_via}${form.transaction_id ? ` (TxID: ${form.transaction_id})` : ""}`);
      }

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
          payment_status: paymentStatus,
          subtotal,
          discount: form.discount,
          delivery_charge: form.delivery_charge,
          total_amount: total,
          cost_of_goods: costOfGoods,
          gross_profit: total - costOfGoods - form.delivery_charge,
          cod_amount: codAmount,
          notes: notesArr.filter(Boolean).join("\n"),
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

      // Stock decrease for pending orders
      for (const item of items) {
        const product = products?.find((p) => p.id === item.product_id);
        if (!product) continue;
        await supabase
          .from("products")
          .update({
            stock_quantity: (product.stock_quantity || 0) - item.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.product_id);
        await supabase.from("inventory_movements").insert({
          product_id: item.product_id,
          movement_type: "order_pending",
          quantity: -item.quantity,
          reference_type: "order",
          reference_id: order.id,
          notes: "Manual order created (stock decreased)",
        });
      }

      return order;
    },
    onSuccess: (order) => {
      toast({ title: "✅ Order created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["orders-full"] });
      queryClient.invalidateQueries({ queryKey: ["order-status-counts"] });
      navigate(`/orders/${order.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Error creating order", description: err.message, variant: "destructive" });
    },
  });

  const filteredProducts = products?.filter(
    (p) =>
      productSearch.length >= 1 &&
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const canCreate = form.customer_phone.length >= 11 && items.length > 0;

  return (
    <div className="animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")} className="rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">New Order</h1>
          <p className="text-sm text-muted-foreground">Create a new order manually • <kbd className="text-[10px] px-1.5 py-0.5 bg-muted rounded border border-border font-mono">Ctrl+Enter</kbd> to create</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ═══════ LEFT: Customer + Items ═══════ */}
        <div className="lg:col-span-8 space-y-5">

          {/* ── Customer Card ── */}
          <Card className="rounded-xl border-border/60 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Phone className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">Customer Information</CardTitle>
              {/* BD Courier Badge */}
              {form.customer_phone.length >= 11 && (
                <div className="ml-auto">
                  {bdLoading ? (
                    <Skeleton className="h-7 w-28 rounded-full" />
                  ) : (
                    <Badge className={cn("rounded-full px-3 py-1 text-xs font-semibold border-0", riskInfo.bg, riskInfo.color)}>
                      {riskInfo.label}
                      {bdReport?.success_rate != null && ` ${Math.round(bdReport.success_rate)}%`}
                    </Badge>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Phone */}
                <div className="relative">
                  <Label className="text-xs text-muted-foreground">Phone Number *</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={form.customer_phone}
                      onChange={(e) => {
                        updateForm({ customer_phone: e.target.value });
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="01XXXXXXXXX"
                      className="pl-9 h-9"
                    />
                  </div>
                  {showCustomerDropdown && customers && customers.length > 0 && (
                    <div className="absolute z-20 w-full bg-card border border-border rounded-lg mt-1 shadow-xl max-h-48 overflow-y-auto">
                      {customers.map((c) => (
                        <button
                          key={c.id}
                          className="w-full text-left px-4 py-2.5 hover:bg-muted/80 text-sm flex items-center gap-3 transition-colors"
                          onClick={() => selectCustomer(c)}
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {c.full_name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{c.full_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{c.phone}</p>
                          </div>
                          {c.district && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{c.district}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2nd Phone */}
                <div>
                  <Label className="text-xs text-muted-foreground">2nd Phone</Label>
                  <Input
                    value={form.customer_phone2}
                    onChange={(e) => updateForm({ customer_phone2: e.target.value })}
                    placeholder="Alternative number"
                    className="h-9"
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <Label className="text-xs text-muted-foreground">Customer Name *</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => updateForm({ customer_name: e.target.value })}
                  placeholder="Full name"
                  className="h-9"
                />
              </div>

              {/* Address */}
              <div>
                <Label className="text-xs text-muted-foreground">Delivery Address</Label>
                <Textarea
                  value={form.delivery_address}
                  onChange={(e) => updateForm({ delivery_address: e.target.value })}
                  placeholder="House, Road, Area..."
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>

              {/* District + Thana */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">District</Label>
                  <Select value={form.delivery_district} onValueChange={handleDistrictSelect}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {cities?.map((c) => (
                        <SelectItem key={c.city_id} value={c.city_name}>{c.city_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Thana / Zone</Label>
                  <Select value={form.delivery_thana} onValueChange={(v) => updateForm({ delivery_thana: v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={selectedCityId ? "Select zone" : "Select district first"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {zones?.map((z) => (
                        <SelectItem key={z.zone_id} value={z.zone_name}>{z.zone_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Order Items Card ── */}
          <Card className="rounded-xl border-border/60 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">Order Items</CardTitle>
              {items.length > 0 && (
                <Badge variant="secondary" className="ml-auto rounded-full text-[10px]">{items.length} item{items.length > 1 ? "s" : ""}</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {/* Product Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  ref={productSearchRef}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyDown={handleProductKeyDown}
                  placeholder="Search by product name or SKU... (Enter to add first)"
                  className="pl-9 h-9"
                />
                {filteredProducts && filteredProducts.length > 0 && (
                  <div className="absolute z-20 w-full bg-card border border-border rounded-lg mt-1 shadow-xl max-h-64 overflow-y-auto">
                    {filteredProducts.slice(0, 10).map((p) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/80 flex items-center gap-3 transition-colors"
                        onClick={() => addProduct(p)}
                      >
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border/40" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{formatBDT(p.selling_price)}</p>
                          <p className={cn("text-[10px] font-mono", (p.stock_quantity || 0) < 10 ? "text-red-500 font-bold" : "text-muted-foreground")}>
                            Stock: {p.stock_quantity || 0}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Item Rows */}
              {items.length > 0 ? (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-[40px_1fr_100px_100px_80px_32px] gap-2 px-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    <span></span>
                    <span>Product</span>
                    <span className="text-center">Qty</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Total</span>
                    <span></span>
                  </div>
                  {items.map((item) => (
                    <div key={item.product_id} className="grid grid-cols-[40px_1fr_100px_100px_80px_32px] gap-2 items-center p-2 bg-muted/40 rounded-lg hover:bg-muted/60 transition-colors">
                      {/* Image */}
                      {item.product_image ? (
                        <img src={item.product_image} alt="" className="w-10 h-10 rounded-lg object-cover border border-border/40" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      )}
                      {/* Name + SKU */}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.product_name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{item.product_sku}</p>
                      </div>
                      {/* Qty */}
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="w-6 h-6 rounded-md bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
                          onClick={() => updateItem(item.product_id, "quantity", item.quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.product_id, "quantity", parseInt(e.target.value) || 1)}
                          className="w-12 h-7 text-center text-sm font-semibold px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min={1}
                        />
                        <button
                          className="w-6 h-6 rounded-md bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
                          onClick={() => updateItem(item.product_id, "quantity", item.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      {/* Price */}
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(item.product_id, "unit_price", parseFloat(e.target.value) || 0)}
                        className="h-7 text-right text-sm font-mono px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      {/* Total */}
                      <span className="text-sm font-semibold text-right tabular-nums">
                        {formatBDT(item.quantity * item.unit_price)}
                      </span>
                      {/* Remove */}
                      <button
                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => removeItem(item.product_id)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Search and add products above</p>
                  <p className="text-xs mt-1">Press <kbd className="px-1 py-0.5 bg-muted rounded border border-border text-[10px] font-mono">Enter</kbd> to quickly add</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ═══════ RIGHT: Details + Summary (Sticky) ═══════ */}
        <div className="lg:col-span-4 space-y-5">
          <div className="lg:sticky lg:top-4 space-y-5">

            {/* ── Order Details Card ── */}
            <Card className="rounded-xl border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                {/* Channel */}
                <div>
                  <Label className="text-xs text-muted-foreground">Channel</Label>
                  <Select value={form.channel} onValueChange={(v) => updateForm({ channel: v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((ch) => (
                        <SelectItem key={ch.value} value={ch.value}>
                          <span className="flex items-center gap-2">
                            <span>{ch.emoji}</span>
                            <span>{ch.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Method */}
                <div>
                  <Label className="text-xs text-muted-foreground">Payment Method</Label>
                  <Select value={form.payment_method} onValueChange={(v) => updateForm({ payment_method: v, advance_amount: 0, transaction_id: "" })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((pm) => (
                        <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Advance Fields */}
                {showAdvanceFields && (
                  <div className="space-y-3 p-3 bg-muted/40 rounded-lg border border-border/40">
                    <div>
                      <Label className="text-xs text-muted-foreground">Advance Amount *</Label>
                      <Input
                        type="number"
                        value={form.advance_amount || ""}
                        onChange={(e) => updateForm({ advance_amount: parseFloat(e.target.value) || 0 })}
                        placeholder="৳0"
                        className="h-8"
                      />
                    </div>
                    {isPartial && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Payment Via</Label>
                        <Select value={form.payment_via} onValueChange={(v) => updateForm({ payment_via: v })}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bKash">bKash</SelectItem>
                            <SelectItem value="Nagad">Nagad</SelectItem>
                            <SelectItem value="Bank">Bank</SelectItem>
                            <SelectItem value="Cash">Cash</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!isPartial && (
                      <p className="text-xs text-muted-foreground">Received via: <span className="font-semibold text-foreground">{form.payment_via}</span></p>
                    )}
                    <div>
                      <Label className="text-xs text-muted-foreground">Transaction ID</Label>
                      <Input
                        value={form.transaction_id}
                        onChange={(e) => updateForm({ transaction_id: e.target.value })}
                        placeholder="TxID (optional)"
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Payment Status Badge */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Payment Status</Label>
                  <Badge variant="outline" className={cn("capitalize text-[10px] font-semibold rounded-full",
                    paymentStatus === "paid" && "bg-green-100 text-green-700 border-green-200",
                    paymentStatus === "pending" && "bg-yellow-100 text-yellow-700 border-yellow-200",
                    paymentStatus === "partial" && "bg-orange-100 text-orange-700 border-orange-200",
                  )}>
                    {paymentStatus}
                  </Badge>
                </div>

                {/* Notes */}
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => updateForm({ notes: e.target.value })}
                    rows={2}
                    className="resize-none text-sm"
                    placeholder="Order notes..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Order Summary Card ── */}
            <Card className="rounded-xl border-border/60 shadow-sm border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatBDT(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Discount</span>
                  <Input
                    type="number"
                    value={form.discount || ""}
                    onChange={(e) => updateForm({ discount: parseFloat(e.target.value) || 0 })}
                    className="w-24 text-right h-7 text-sm font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="৳0"
                  />
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Delivery Charge</span>
                  <Input
                    type="number"
                    value={form.delivery_charge}
                    onChange={(e) => updateForm({ delivery_charge: parseFloat(e.target.value) || 0 })}
                    className="w-24 text-right h-7 text-sm font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <Separator />

                {/* Advance Paid */}
                {showAdvanceFields && advancePaid > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 font-medium">Advance Paid</span>
                    <span className="text-green-600 font-semibold tabular-nums">-{formatBDT(advancePaid)}</span>
                  </div>
                )}

                {/* COD Remaining */}
                {(form.payment_method === "cod" || isPartial) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-600 font-medium">COD Remaining</span>
                    <span className="text-orange-600 font-bold tabular-nums">{formatBDT(form.payment_method === "cod" ? total : codRemaining)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-base font-bold">Total</span>
                  <span className="text-xl font-bold tabular-nums">{formatBDT(total)}</span>
                </div>

                <Button
                  className="w-full mt-3 h-11 text-sm font-semibold"
                  onClick={() => mutation.mutate()}
                  disabled={!canCreate || mutation.isPending}
                >
                  {mutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Create Order
                    </>
                  )}
                </Button>

                {!canCreate && (
                  <p className="text-[10px] text-center text-muted-foreground">
                    {form.customer_phone.length < 11 ? "Enter phone number" : "Add at least 1 product"}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
