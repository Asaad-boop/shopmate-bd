import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
  Phone, AlertTriangle, CheckCircle2, Loader2, ShoppingCart,
  User, MapPin, CreditCard, Receipt, Barcode, ChevronDown, ChevronUp,
} from "lucide-react";
import { formatBDT } from "@/lib/format";
import { useBDCourierSingle, getRiskLevel } from "@/hooks/use-bd-courier";
import { usePathaoCities, usePathaoZones } from "@/hooks/use-pathao";
import { cn } from "@/lib/utils";
import { useAddressParser } from "@/hooks/use-address-parser";

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
  { value: "manual", label: "Manual", emoji: "✍️" },
  { value: "facebook", label: "Facebook", emoji: "📘" },
  { value: "instagram", label: "Instagram", emoji: "📸" },
  { value: "whatsapp", label: "WhatsApp", emoji: "💬" },
  { value: "phone", label: "Call", emoji: "📞" },
];

const PAYMENT_METHODS = [
  { value: "cod", label: "Cash on Delivery", icon: "💰" },
  { value: "advance", label: "Advance Payment", icon: "💳" },
  { value: "partial", label: "Partial (Advance + COD)", icon: "🔀" },
];

const ADVANCE_VIA_OPTIONS = [
  { value: "bKash", label: "bKash", emoji: "📱" },
  { value: "Nagad", label: "Nagad", emoji: "📱" },
  { value: "Bank", label: "Bank", emoji: "🏦" },
  { value: "Cash", label: "Cash", emoji: "💵" },
];

function getPaymentStatus(method: string) {
  if (method === "cod") return "pending";
  if (method === "advance") return "paid";
  if (method === "partial") return "partial";
  return "pending";
}

/* ═══ Section Header ═══ */
function SectionHeader({ icon: Icon, title, badge }: { icon: any; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-[18px] h-[18px] text-primary" />
      </div>
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      {badge && <div className="ml-auto">{badge}</div>}
    </div>
  );
}

/* ═══ Stock Badge ═══ */
function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="text-[10px] font-bold text-destructive">Out of stock</span>;
  if (stock < 10) return <span className="text-[10px] font-semibold text-orange-600">{stock} left</span>;
  return <span className="text-[10px] text-muted-foreground">{stock} in stock</span>;
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
    payment_via: "bKash",
    transaction_id: "",
    discount: 0,
    delivery_charge: 60,
    notes: "",
  });
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [addressAutoFilled, setAddressAutoFilled] = useState<{ district: boolean; thana: boolean }>({ district: false, thana: false });
  const [showAltPhone, setShowAltPhone] = useState(false);

  const { status: addressParseStatus } = useAddressParser({
    address: form.delivery_address,
    onAutoFill: (parsed) => {
      const updates: Partial<typeof form> = {};
      const filled = { district: false, thana: false };
      if (parsed.district) {
        updates.delivery_district = parsed.district;
        filled.district = true;
        if (cities) {
          const match = cities.find((c) => c.city_name.toLowerCase() === parsed.district!.toLowerCase());
          if (match) setSelectedCityId(match.city_id);
        }
      }
      if (parsed.thana) {
        updates.delivery_thana = parsed.thana;
        filled.thana = true;
      }
      if (Object.keys(updates).length > 0) {
        updateForm(updates);
        setAddressAutoFilled(filled);
        setTimeout(() => setAddressAutoFilled({ district: false, thana: false }), 5000);
      }
    },
  });

  const isAdvance = form.payment_method === "advance";
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

  /* ── Keyboard shortcut ── */
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
    if (c.district && cities) {
      const match = cities.find((ct) => ct.city_name.toLowerCase() === c.district?.toLowerCase());
      if (match) setSelectedCityId(match.city_id);
    }
  };

  const addProduct = (p: any) => {
    const stock = p.stock_quantity || 0;
    if (stock <= 0) {
      toast({ title: "⚠️ Stock নেই", description: `${p.name} এর stock শূন্য`, variant: "destructive" });
      return;
    }
    if (items.find((i) => i.product_id === p.id)) {
      setItems((prev) => prev.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems((prev) => [
        ...prev,
        {
          product_id: p.id, product_name: p.name, product_sku: p.sku,
          product_image: p.image_url, stock_quantity: stock,
          quantity: 1, unit_price: p.selling_price || 0, unit_cost: p.landed_cost_bdt || 0,
        },
      ]);
    }
    setProductSearch("");
    productSearchRef.current?.focus();
  };

  const removeItem = (pid: string) => setItems((prev) => prev.filter((i) => i.product_id !== pid));
  const updateItem = (pid: string, field: string, val: number) =>
    setItems((prev) => prev.map((i) => (i.product_id === pid ? { ...i, [field]: Math.max(field === "quantity" ? 1 : 0, val) } : i)));

  const handleDistrictSelect = (cityName: string) => {
    updateForm({ delivery_district: cityName, delivery_thana: "" });
    const match = cities?.find((c) => c.city_name === cityName);
    setSelectedCityId(match?.city_id || null);
  };

  /* ── Create Order Mutation ── */
  const mutation = useMutation({
    mutationFn: async () => {
      let customer_id: string | null = null;
      if (form.customer_phone) {
        const { data: existing } = await supabase
          .from("customers").select("id").eq("phone", form.customer_phone).maybeSingle();
        if (existing) {
          customer_id = existing.id;
          await supabase.from("customers").update({
            full_name: form.customer_name, address: form.delivery_address,
            district: form.delivery_district, thana: form.delivery_thana,
            phone2: form.customer_phone2 || null,
          }).eq("id", existing.id);
        } else if (form.customer_name) {
          const { data: newC, error } = await supabase
            .from("customers")
            .insert({
              phone: form.customer_phone, phone2: form.customer_phone2 || null,
              full_name: form.customer_name, address: form.delivery_address,
              district: form.delivery_district, thana: form.delivery_thana,
            })
            .select("id").single();
          if (error) throw error;
          customer_id = newC.id;
        }
      }

      const orderNum = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const costOfGoods = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
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
          order_number: orderNum, channel: form.channel, customer_id,
          delivery_address: form.delivery_address, delivery_district: form.delivery_district,
          delivery_thana: form.delivery_thana, payment_method: form.payment_method,
          payment_status: paymentStatus, subtotal, discount: form.discount,
          delivery_charge: form.delivery_charge, total_amount: total,
          cost_of_goods: costOfGoods, gross_profit: total - costOfGoods - form.delivery_charge,
          cod_amount: codAmount, notes: notesArr.filter(Boolean).join("\n"), status: "pending",
        })
        .select("id").single();
      if (orderErr) throw orderErr;

      const orderItems = items.map((i) => ({
        order_id: order.id, product_id: i.product_id, quantity: i.quantity,
        unit_price: i.unit_price, unit_cost: i.unit_cost,
        total_price: i.quantity * i.unit_price, profit: i.quantity * (i.unit_price - i.unit_cost),
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      for (const item of items) {
        const product = products?.find((p) => p.id === item.product_id);
        if (!product) continue;
        await supabase.from("products").update({
          stock_quantity: (product.stock_quantity || 0) - item.quantity,
          updated_at: new Date().toISOString(),
        }).eq("id", item.product_id);
        await supabase.from("inventory_movements").insert({
          product_id: item.product_id, movement_type: "order_pending",
          quantity: -item.quantity, reference_type: "order", reference_id: order.id,
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
    (p) => productSearch.length >= 1
      ? (p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()))
      : true
  );

  const canCreate = form.customer_phone.length >= 11 && items.length > 0;

  /* ═══ RENDER ═══ */
  return (
    <div className="animate-fade-in pb-24 lg:pb-8">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/orders")} className="rounded-xl h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">New Order</h1>
            <p className="text-[11px] text-muted-foreground">
              <kbd className="text-[10px] px-1 py-0.5 bg-muted rounded border border-border font-mono">⌘ Enter</kbd> to save
            </p>
          </div>
        </div>
      </div>

      {/* ── Source Pills ── */}
      <div className="flex items-center gap-1 mb-6 p-1 bg-muted/60 rounded-xl w-fit">
        {CHANNELS.map((ch) => (
          <button
            key={ch.value}
            onClick={() => updateForm({ channel: ch.value })}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
              form.channel === ch.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="mr-1">{ch.emoji}</span>{ch.label}
          </button>
        ))}
      </div>

      {/* ═══ 2-Column Grid ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

        {/* ══ LEFT COLUMN ══ */}
        <div className="space-y-6">

          {/* ── Customer Card ── */}
          <Card className="rounded-2xl border-border/50 shadow-[0_1px_3px_hsl(var(--foreground)/0.04)] overflow-hidden">
            <CardContent className="p-5">
              <SectionHeader
                icon={User}
                title="Customer"
                badge={
                  form.customer_phone.length >= 11 ? (
                    bdLoading ? (
                      <Skeleton className="h-6 w-24 rounded-full" />
                    ) : (
                      <Badge className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold border-0", riskInfo.bg, riskInfo.color)}>
                        {riskInfo.label}{bdReport?.success_rate != null && ` ${Math.round(bdReport.success_rate)}%`}
                      </Badge>
                    )
                  ) : undefined
                }
              />

              <div className="space-y-4">
                {/* Phone + Name row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <Label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Phone *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                      <Input
                        value={form.customer_phone}
                        onChange={(e) => { updateForm({ customer_phone: e.target.value }); setShowCustomerDropdown(true); }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        placeholder="01XXXXXXXXX"
                        className="pl-9 h-10 rounded-xl bg-muted/30 border-border/60 focus:bg-card transition-colors"
                      />
                    </div>
                    {/* Dropdown */}
                    {showCustomerDropdown && customers && customers.length > 0 && (
                      <div className="absolute z-30 w-full bg-card border border-border/60 rounded-xl mt-1.5 shadow-lg overflow-hidden">
                        {customers.map((c) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-muted/60 text-sm flex items-center gap-3 transition-colors"
                            onClick={() => selectCustomer(c)}
                          >
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {c.full_name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{c.full_name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{c.phone}</p>
                            </div>
                            {c.district && <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{c.district}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Name *</Label>
                    <Input
                      value={form.customer_name}
                      onChange={(e) => updateForm({ customer_name: e.target.value })}
                      placeholder="Customer name"
                      className="h-10 rounded-xl bg-muted/30 border-border/60 focus:bg-card transition-colors"
                    />
                  </div>
                </div>

                {/* Alt phone collapsible */}
                <button
                  onClick={() => setShowAltPhone(!showAltPhone)}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  {showAltPhone ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Alternative phone
                </button>
                {showAltPhone && (
                  <Input
                    value={form.customer_phone2}
                    onChange={(e) => updateForm({ customer_phone2: e.target.value })}
                    placeholder="2nd phone number"
                    className="h-10 rounded-xl bg-muted/30 border-border/60 focus:bg-card transition-colors animate-fade-in"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Address Card ── */}
          <Card className="rounded-2xl border-border/50 shadow-[0_1px_3px_hsl(var(--foreground)/0.04)] overflow-hidden">
            <CardContent className="p-5">
              <SectionHeader
                icon={MapPin}
                title="Delivery Address"
                badge={
                  addressParseStatus === "parsing" ? (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />Detecting...</span>
                  ) : addressParseStatus === "found" ? (
                    <Badge variant="outline" className="text-[10px] border-green-200 text-green-600 bg-green-50 dark:bg-green-950/30 rounded-full">
                      <CheckCircle2 className="w-3 h-3 mr-1" />Auto detected
                    </Badge>
                  ) : addressParseStatus === "not_found" && form.delivery_address.length > 10 ? (
                    <Badge variant="outline" className="text-[10px] border-yellow-200 text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 rounded-full">
                      <AlertTriangle className="w-3 h-3 mr-1" />Manual
                    </Badge>
                  ) : undefined
                }
              />

              <div className="space-y-4">
                <div>
                  <Label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Full Address</Label>
                  <Textarea
                    value={form.delivery_address}
                    onChange={(e) => { updateForm({ delivery_address: e.target.value }); setAddressAutoFilled({ district: false, thana: false }); }}
                    placeholder="House, Road, Area..."
                    rows={2}
                    className="resize-none text-sm rounded-xl bg-muted/30 border-border/60 focus:bg-card transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      District
                      {addressAutoFilled.district && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                    </Label>
                    <Select value={form.delivery_district} onValueChange={(v) => { handleDistrictSelect(v); setAddressAutoFilled((p) => ({ ...p, district: false })); }}>
                      <SelectTrigger className={cn("h-10 rounded-xl bg-muted/30 border-border/60", addressAutoFilled.district && "border-green-400 ring-1 ring-green-200")}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {cities?.map((c) => (<SelectItem key={c.city_id} value={c.city_name}>{c.city_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      Thana / Zone
                      {addressAutoFilled.thana && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                    </Label>
                    <Select value={form.delivery_thana} onValueChange={(v) => { updateForm({ delivery_thana: v }); setAddressAutoFilled((p) => ({ ...p, thana: false })); }}>
                      <SelectTrigger className={cn("h-10 rounded-xl bg-muted/30 border-border/60", addressAutoFilled.thana && "border-green-400 ring-1 ring-green-200")}>
                        <SelectValue placeholder={selectedCityId ? "Select zone" : "District first"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {zones?.map((z) => (<SelectItem key={z.zone_id} value={z.zone_name}>{z.zone_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Products Card ── */}
          <Card className="rounded-2xl border-border/50 shadow-[0_1px_3px_hsl(var(--foreground)/0.04)] overflow-hidden">
            <CardContent className="p-5">
              <SectionHeader
                icon={Package}
                title="Products"
                badge={
                  items.length > 0 ? (
                    <Badge variant="secondary" className="rounded-full text-[11px] font-semibold">
                      <ShoppingCart className="w-3 h-3 mr-1" />{items.length} item{items.length > 1 ? "s" : ""}
                    </Badge>
                  ) : undefined
                }
              />

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <Input
                  ref={productSearchRef}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search by name or SKU..."
                  className="pl-10 pr-10 h-10 rounded-xl bg-muted/30 border-border/60 focus:bg-card transition-colors"
                />
                <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[400px] overflow-y-auto pr-0.5 scroll-smooth">
                {(filteredProducts || []).slice(0, 30).map((p) => {
                  const stock = p.stock_quantity || 0;
                  const outOfStock = stock <= 0;
                  const inCart = items.find((i) => i.product_id === p.id);
                  return (
                    <button
                      key={p.id}
                      className={cn(
                        "group relative flex flex-col items-center p-3 rounded-xl border text-center transition-all duration-200",
                        outOfStock
                          ? "opacity-40 cursor-not-allowed border-border/40 bg-muted/20"
                          : inCart
                            ? "border-primary/50 bg-primary/[0.03] shadow-sm"
                            : "border-border/40 bg-card hover:border-border hover:shadow-sm"
                      )}
                      onClick={() => !outOfStock && addProduct(p)}
                      disabled={outOfStock}
                    >
                      {/* Quick add badge */}
                      {!outOfStock && !inCart && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="w-3 h-3" />
                        </div>
                      )}
                      {inCart && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                          {inCart.quantity}
                        </div>
                      )}
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-11 h-11 rounded-lg object-cover border border-border/30 mb-2" />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-muted/60 flex items-center justify-center mb-2">
                          <Package className="w-5 h-5 text-muted-foreground/50" />
                        </div>
                      )}
                      <p className="text-[11px] font-medium truncate w-full leading-tight">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.sku}</p>
                      <p className="text-xs font-bold mt-1 text-foreground">{formatBDT(p.selling_price)}</p>
                      <StockBadge stock={stock} />
                    </button>
                  );
                })}
              </div>

              {filteredProducts && filteredProducts.length === 0 && productSearch.length >= 1 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  No products found
                </div>
              )}

              {/* ── Cart Items ── */}
              {items.length > 0 && (
                <div className="mt-5 pt-5 border-t border-border/50">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Cart Items</h3>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.product_id} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-xl animate-fade-in">
                        {item.product_image ? (
                          <img src={item.product_image} alt="" className="w-9 h-9 rounded-lg object-cover border border-border/30 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate">{item.product_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{item.product_sku}</p>
                        </div>
                        {/* Qty stepper */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            className="w-6 h-6 rounded-lg bg-card border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
                            onClick={() => updateItem(item.product_id, "quantity", item.quantity - 1)}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.product_id, "quantity", parseInt(e.target.value) || 1)}
                            className="w-9 h-6 text-center text-[12px] font-semibold px-0 rounded-lg border-border/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min={1}
                          />
                          <button
                            className="w-6 h-6 rounded-lg bg-card border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
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
                          className="w-[70px] h-6 text-right text-[12px] font-mono px-1.5 shrink-0 rounded-lg border-border/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-[12px] font-semibold tabular-nums w-[60px] text-right shrink-0">
                          {formatBDT(item.quantity * item.unit_price)}
                        </span>
                        <button
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          onClick={() => removeItem(item.product_id)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ══ RIGHT COLUMN (Sticky) ══ */}
        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">

          {/* ── Payment Card ── */}
          <Card className="rounded-2xl border-border/50 shadow-[0_1px_3px_hsl(var(--foreground)/0.04)] overflow-hidden">
            <CardContent className="p-5">
              <SectionHeader icon={CreditCard} title="Payment" />

              <div className="space-y-4">
                {/* Payment method pills */}
                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-muted-foreground">Method</Label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {PAYMENT_METHODS.map((pm) => (
                      <button
                        key={pm.value}
                        onClick={() => updateForm({ payment_method: pm.value, advance_amount: 0, transaction_id: "" })}
                        className={cn(
                          "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left text-sm transition-all duration-200",
                          form.payment_method === pm.value
                            ? "border-primary/50 bg-primary/[0.04] text-foreground shadow-sm"
                            : "border-border/40 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                        )}
                      >
                        <span className="text-base">{pm.icon}</span>
                        <span className="font-medium text-[12px]">{pm.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status pill */}
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-medium text-muted-foreground">Status</Label>
                  <Badge variant="outline" className={cn("capitalize text-[10px] font-semibold rounded-full px-2.5",
                    paymentStatus === "paid" && "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
                    paymentStatus === "pending" && "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800",
                    paymentStatus === "partial" && "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800",
                  )}>
                    {paymentStatus}
                  </Badge>
                </div>

                {/* Advance fields */}
                {showAdvanceFields && (
                  <div className="space-y-3 p-3.5 rounded-xl bg-muted/30 border border-border/40 animate-fade-in">
                    <div>
                      <Label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Advance Amount *</Label>
                      <Input
                        type="number"
                        value={form.advance_amount || ""}
                        onChange={(e) => updateForm({ advance_amount: parseFloat(e.target.value) || 0 })}
                        placeholder="৳0"
                        className="h-9 rounded-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Received via</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {ADVANCE_VIA_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => updateForm({ payment_via: opt.value })}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                              form.payment_via === opt.value
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card text-muted-foreground border-border/60 hover:bg-muted"
                            )}
                          >
                            {opt.emoji} {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Transaction ID</Label>
                      <Input
                        value={form.transaction_id}
                        onChange={(e) => updateForm({ transaction_id: e.target.value })}
                        placeholder="TxID (optional)"
                        className="h-9 rounded-xl font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <Label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Shipping Note</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => updateForm({ notes: e.target.value })}
                    rows={2}
                    className="resize-none text-sm rounded-xl bg-muted/30 border-border/60 focus:bg-card transition-colors"
                    placeholder="Optional instructions..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Summary Card ── */}
          <Card className="rounded-2xl border-primary/15 shadow-[0_2px_8px_hsl(var(--foreground)/0.06)] overflow-hidden">
            <CardContent className="p-5">
              <SectionHeader icon={Receipt} title="Order Summary" />

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums font-medium">{formatBDT(subtotal)}</span>
                </div>

                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Delivery</span>
                  <Input
                    type="number"
                    value={form.delivery_charge}
                    onChange={(e) => updateForm({ delivery_charge: parseFloat(e.target.value) || 0 })}
                    className="w-20 text-right h-7 text-sm font-mono rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Discount</span>
                  <Input
                    type="number"
                    value={form.discount || ""}
                    onChange={(e) => updateForm({ discount: parseFloat(e.target.value) || 0 })}
                    className="w-20 text-right h-7 text-sm font-mono rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="৳0"
                  />
                </div>

                {showAdvanceFields && advancePaid > 0 && (
                  <div className="flex justify-between text-sm animate-fade-in">
                    <span className="text-green-600 font-medium">Advance Paid</span>
                    <span className="text-green-600 font-bold tabular-nums">-{formatBDT(advancePaid)}</span>
                  </div>
                )}

                <Separator className="my-1" />

                {(form.payment_method === "cod" || isPartial) && (
                  <div className="flex justify-between text-sm py-0.5">
                    <span className="text-orange-600 font-semibold">COD Remaining</span>
                    <span className="text-orange-600 font-bold tabular-nums">{formatBDT(form.payment_method === "cod" ? total : codRemaining)}</span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="flex justify-between items-baseline p-3.5 -mx-1 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200/60 dark:border-green-800/40">
                  <span className="text-sm font-bold text-green-700 dark:text-green-400">Grand Total</span>
                  <span className="text-2xl font-extrabold text-green-700 dark:text-green-400 tabular-nums tracking-tight">{formatBDT(total)}</span>
                </div>

                {/* Create Button */}
                <Button
                  className="w-full h-11 text-sm font-semibold rounded-xl mt-2"
                  onClick={() => mutation.mutate()}
                  disabled={!canCreate || mutation.isPending}
                >
                  {mutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
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
                  <p className="text-[11px] text-center text-muted-foreground pt-1">
                    {form.customer_phone.length < 11 ? "📱 Enter customer phone" : "📦 Add at least one product"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Mobile Fixed Bottom CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-md border-t border-border/60 lg:hidden z-40">
        <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
          <div>
            <p className="text-[11px] text-muted-foreground">Total</p>
            <p className="text-lg font-extrabold text-green-700 dark:text-green-400 tabular-nums">{formatBDT(total)}</p>
          </div>
          <Button
            className="h-10 px-6 text-sm font-semibold rounded-xl"
            onClick={() => mutation.mutate()}
            disabled={!canCreate || mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            {mutation.isPending ? "Creating..." : "Create Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}
