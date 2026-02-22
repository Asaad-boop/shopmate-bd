import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePurchaseOrder, usePOItems, usePOPayments, usePOAdditionalCosts, usePOTimeline, useSuppliers, useAgents } from "@/hooks/use-purchase-orders";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Save, Plus, X, Check, Copy,
  ArrowLeft, CreditCard, Package,
  CheckCircle2, Handshake, Rocket,
} from "lucide-react";
import { POPdfExport } from "@/components/purchase-orders/POPdfExport";
import { POProductSearch } from "@/components/purchase-orders/POProductSearch";
import { format, differenceInDays } from "date-fns";

const AGENT_TIMELINE = [
  { stage: 1, label: "Order Placed to Agent", icon: "📋" },
  { stage: 2, label: "Advance Paid", icon: "💳" },
  { stage: 3, label: "In Transit", icon: "🚢" },
  { stage: 4, label: "Arrived in BD", icon: "📍" },
  { stage: 5, label: "Due + Shipping Paid → Received", icon: "✅" },
];

const DIRECT_TIMELINE = [
  { stage: 1, label: "PO Created", icon: "📋" },
  { stage: 2, label: "Payment to Supplier", icon: "💳" },
  { stage: 3, label: "Goods Ready", icon: "📦" },
  { stage: 4, label: "Shipped from China", icon: "🚢" },
  { stage: 5, label: "Customs Clearance", icon: "🛃" },
  { stage: 6, label: "Arrived at Warehouse", icon: "🏭" },
  { stage: 7, label: "Added to Inventory", icon: "✅" },
];

const SHIPPING_METHODS = ["Air", "Sea", "Courier"];
const COST_LABELS = ["Custom Duty", "C&F Agent", "Port Handling", "Local Transport", "Other"];
const AGENT_PAYMENT_METHODS = ["bKash", "Nagad", "Bank", "Cash"];
const DIRECT_PAYMENT_METHODS = ["Alipay", "Bank", "USDT", "Cash"];

interface LocalItem {
  id?: string;
  product_id?: string | null;
  product_name?: string;
  image_url?: string;
  unit?: string;
  quantity: number;
  unit_price_cny?: number | null;
  unit_price_bdt?: number | null;
  variant_note?: string;
  received_quantity?: number;
  condition?: string;
}

interface LocalPayment {
  id?: string;
  payment_date: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_type: string;
  transaction_id?: string;
  note?: string;
}

interface LocalCost {
  id?: string;
  label: string;
  amount_bdt: number;
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === "new";

  const { data: poData, isLoading: poLoading } = usePurchaseOrder(isNew ? undefined : id);
  const { data: itemsData } = usePOItems(isNew ? undefined : id);
  const { data: paymentsData } = usePOPayments(isNew ? undefined : id);
  const { data: costsData } = usePOAdditionalCosts(isNew ? undefined : id);
  const { data: timelineData } = usePOTimeline(isNew ? undefined : id);
  const { data: suppliers } = useSuppliers();
  const { data: agents } = useAgents();

  // Core state
  const [importType, setImportType] = useState<"AGENT" | "DIRECT" | null>(null);
  const [poNumber, setPoNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState("draft");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [orderDate, setOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cnyRate, setCnyRate] = useState(15.5);
  const [shippingMethod, setShippingMethod] = useState("Sea");
  const [shippingAgent, setShippingAgent] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [portOfEntry, setPortOfEntry] = useState("Chittagong");
  const [expectedArrival, setExpectedArrival] = useState("");
  const [actualArrival, setActualArrival] = useState("");
  const [shippingCostCny, setShippingCostCny] = useState(0);
  const [shippingChargeBdt, setShippingChargeBdt] = useState(0);
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<LocalItem[]>([{ quantity: 1, unit: "pcs" }]);
  const [payments, setPayments] = useState<LocalPayment[]>([]);
  const [additionalCosts, setAdditionalCosts] = useState<LocalCost[]>([]);
  const [timeline, setTimeline] = useState<{ stage: number; completed_at: string | null; note: string }[]>([]);

  const [saving, setSaving] = useState(false);

  const activeTimeline = importType === "AGENT" ? AGENT_TIMELINE : DIRECT_TIMELINE;

  // Initialize timeline when import type changes
  useEffect(() => {
    if (importType && timeline.length === 0) {
      const stages = importType === "AGENT" ? AGENT_TIMELINE : DIRECT_TIMELINE;
      setTimeline(stages.map(s => ({ stage: s.stage, completed_at: null, note: "" })));
    }
  }, [importType]);

  // Load existing PO data
  useEffect(() => {
    if (isNew) {
      const now = new Date();
      setPoNumber(`PO-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`);
      return;
    }
    if (poData) {
      setImportType(((poData as any).import_type as "AGENT" | "DIRECT") || "DIRECT");
      setPoNumber(poData.po_number);
      setSupplierId(poData.supplier_id || "");
      setAgentId((poData as any).agent_id || "");
      setStatus(poData.status || "draft");
      setPaymentStatus(poData.payment_status || "pending");
      setOrderDate(poData.order_date);
      setCnyRate(Number(poData.exchange_rate_cny_bdt) || 15.5);
      setShippingMethod(poData.shipping_method || "Sea");
      setShippingAgent(poData.shipping_agent || "");
      setTrackingNumber(poData.tracking_number || "");
      setPortOfEntry(poData.port_of_entry || "Chittagong");
      setExpectedArrival(poData.expected_arrival_date || "");
      setActualArrival(poData.actual_arrival_date || "");
      setShippingCostCny(Number(poData.freight_cost_usd) || 0);
      setShippingChargeBdt(Number(poData.freight_cost_bdt) || 0);
      setNotes(poData.notes || "");
    }
  }, [poData, isNew]);

  useEffect(() => {
    if (itemsData && itemsData.length > 0) {
      setItems(itemsData.map(it => ({
        id: it.id, product_id: it.product_id,
        product_name: it.product_name || (it.products as any)?.name || "",
        image_url: it.image_url || "", unit: it.unit || "pcs",
        quantity: it.quantity, unit_price_cny: it.unit_price_cny,
        unit_price_bdt: it.unit_price_usd ? Number(it.unit_price_usd) : null,
        variant_note: it.variant_note || "",
        received_quantity: it.received_quantity || 0,
        condition: it.condition || "good",
      })));
    }
  }, [itemsData]);

  useEffect(() => {
    if (paymentsData) setPayments(paymentsData.map(p => ({
      id: p.id, payment_date: p.payment_date, amount: Number(p.amount),
      currency: p.currency, payment_method: p.payment_method || "bKash",
      payment_type: (p as any).payment_type || "OTHER",
      transaction_id: p.transaction_id || "", note: p.note || "",
    })));
  }, [paymentsData]);

  useEffect(() => {
    if (costsData) setAdditionalCosts(costsData.map(c => ({
      id: c.id, label: c.label, amount_bdt: Number(c.amount_bdt),
    })));
  }, [costsData]);

  useEffect(() => {
    if (timelineData && timelineData.length > 0 && importType) {
      const stages = importType === "AGENT" ? AGENT_TIMELINE : DIRECT_TIMELINE;
      setTimeline(stages.map(s => {
        const existing = timelineData.find(t => t.stage === s.stage);
        return { stage: s.stage, completed_at: existing?.completed_at || null, note: existing?.note || "" };
      }));
    }
  }, [timelineData, importType]);

  // Calculations
  const isAgent = importType === "AGENT";

  const productCostBdt = useMemo(() => {
    if (isAgent) {
      return items.reduce((s, it) => s + (it.quantity * (it.unit_price_bdt || 0)), 0);
    }
    return items.reduce((s, it) => s + (it.quantity * (it.unit_price_cny || 0)), 0) * cnyRate;
  }, [items, cnyRate, isAgent]);

  const productCostCny = useMemo(() => {
    if (isAgent) return 0;
    return items.reduce((s, it) => s + (it.quantity * (it.unit_price_cny || 0)), 0);
  }, [items, isAgent]);

  const shippingCostBdt = isAgent ? shippingChargeBdt : shippingCostCny * cnyRate;
  const additionalCostsBdt = additionalCosts.reduce((s, c) => s + c.amount_bdt, 0);
  const grandTotalBdt = productCostBdt + shippingCostBdt + additionalCostsBdt;
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  const costPerUnit = totalQty > 0 ? grandTotalBdt / totalQty : 0;

  const totalPaid = payments.reduce((s, p) => {
    if (p.currency === "CNY") return s + p.amount * cnyRate;
    return s + p.amount;
  }, 0);
  const remaining = grandTotalBdt - totalPaid;
  const paidPercent = grandTotalBdt > 0 ? Math.min(100, (totalPaid / grandTotalBdt) * 100) : 0;
  const daysUntilArrival = expectedArrival ? differenceInDays(new Date(expectedArrival), new Date()) : null;

  // Helpers
  const addItem = () => setItems(prev => [...prev, { quantity: 1, unit: "pcs" }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  const addPayment = (type = "OTHER") => setPayments(prev => [...prev, {
    payment_date: format(new Date(), "yyyy-MM-dd"), amount: 0,
    currency: "BDT", payment_method: isAgent ? "bKash" : "Alipay",
    payment_type: type,
  }]);
  const removePayment = (i: number) => setPayments(prev => prev.filter((_, idx) => idx !== i));
  const addCost = () => setAdditionalCosts(prev => [...prev, { label: "Custom Duty", amount_bdt: 0 }]);
  const removeCost = (i: number) => setAdditionalCosts(prev => prev.filter((_, idx) => idx !== i));
  const toggleStage = (stage: number) => {
    setTimeline(prev => prev.map(t =>
      t.stage === stage ? { ...t, completed_at: t.completed_at ? null : new Date().toISOString() } : t
    ));
  };

  // Compute advance paid for agent workflow
  const advancePaid = payments.filter(p => p.payment_type === "ADVANCE").reduce((s, p) => s + p.amount, 0);
  const duePaid = payments.filter(p => p.payment_type === "DUE").reduce((s, p) => s + p.amount, 0);
  const shippingPaid = payments.filter(p => p.payment_type === "SHIPPING").reduce((s, p) => s + p.amount, 0);
  const dueAmount = productCostBdt - advancePaid;

  // Save
  const handleSave = useCallback(async () => {
    if (!poNumber || !orderDate || !importType) {
      toast({ title: "PO Number, Order Date, and Import Type are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const poPayload: any = {
        po_number: poNumber,
        import_type: importType,
        supplier_id: supplierId || null,
        agent_id: agentId || null,
        status, payment_status: paymentStatus,
        order_date: orderDate,
        exchange_rate_cny_bdt: cnyRate,
        shipping_method: shippingMethod,
        shipping_agent: shippingAgent,
        tracking_number: trackingNumber,
        port_of_entry: portOfEntry,
        expected_arrival_date: expectedArrival || null,
        actual_arrival_date: actualArrival || null,
        freight_cost_usd: shippingCostCny,
        freight_cost_bdt: isAgent ? shippingChargeBdt : shippingCostBdt,
        total_product_cost_cny: productCostCny,
        total_product_cost_usd: productCostCny,
        additional_costs_bdt: additionalCostsBdt,
        grand_total_bdt: grandTotalBdt,
        total_landed_cost_bdt: grandTotalBdt,
        cost_per_unit_bdt: costPerUnit,
        advance_paid_bdt: totalPaid,
        remaining_payment_bdt: remaining > 0 ? remaining : 0,
        notes,
      };

      let poId = id;
      if (isNew) {
        const { data, error } = await supabase.from("purchase_orders").insert(poPayload).select("id").single();
        if (error) throw error;
        poId = data.id;
      } else {
        const { error } = await supabase.from("purchase_orders").update(poPayload).eq("id", id!);
        if (error) throw error;
      }

      // Save items
      if (!isNew) await supabase.from("purchase_order_items").delete().eq("purchase_order_id", poId!);
      if (items.length > 0 && items[0].quantity > 0) {
        const itemRows = items.map(it => ({
          purchase_order_id: poId!,
          product_id: it.product_id || null,
          product_name: it.product_name || null,
          image_url: it.image_url || null,
          unit: it.unit || "pcs",
          quantity: it.quantity,
          unit_price_cny: isAgent ? 0 : (it.unit_price_cny || 0),
          unit_price_usd: isAgent ? (it.unit_price_bdt || 0) : (it.unit_price_cny || 0),
          total_price_usd: isAgent ? (it.quantity * (it.unit_price_bdt || 0)) : (it.quantity * (it.unit_price_cny || 0)),
          variant_note: it.variant_note || null,
          received_quantity: it.received_quantity || 0,
          condition: it.condition || "good",
        }));
        await supabase.from("purchase_order_items").insert(itemRows);
      }

      // Save payments
      if (!isNew) await supabase.from("po_payments").delete().eq("po_id", poId!);
      if (payments.length > 0) {
        await supabase.from("po_payments").insert(payments.map(p => ({
          po_id: poId!, payment_date: p.payment_date, amount: p.amount,
          currency: p.currency, payment_method: p.payment_method,
          payment_type: p.payment_type,
          transaction_id: p.transaction_id || null, note: p.note || null,
        })));
      }

      // Save costs
      if (!isNew) await supabase.from("po_additional_costs").delete().eq("po_id", poId!);
      if (additionalCosts.length > 0) {
        await supabase.from("po_additional_costs").insert(additionalCosts.map(c => ({
          po_id: poId!, label: c.label, amount_bdt: c.amount_bdt,
        })));
      }

      // Save timeline
      if (!isNew) await supabase.from("po_timeline").delete().eq("po_id", poId!);
      const completedStages = timeline.filter(t => t.completed_at);
      if (completedStages.length > 0) {
        await supabase.from("po_timeline").insert(completedStages.map(t => ({
          po_id: poId!, stage: t.stage, completed_at: t.completed_at, note: t.note,
        })));
      }

      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order", poId] });
      queryClient.invalidateQueries({ queryKey: ["po-stats"] });

      toast({ title: isNew ? "Purchase Order created!" : "Purchase Order saved!" });
      clearDraft();
      if (isNew) navigate(`/purchase-orders/${poId}`, { replace: true });
    } catch (err: any) {
      toast({ title: "Error saving PO", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [poNumber, orderDate, importType, supplierId, agentId, status, paymentStatus, cnyRate, shippingMethod, shippingAgent, trackingNumber, portOfEntry, expectedArrival, actualArrival, shippingCostCny, shippingChargeBdt, notes, items, payments, additionalCosts, timeline, isNew, id, isAgent, productCostCny, productCostBdt, shippingCostBdt, additionalCostsBdt, grandTotalBdt, costPerUnit, totalPaid, remaining]);

  // Receive goods
  const handleReceiveGoods = async () => {
    if (!id) return;
    if (isAgent && remaining > 0) {
      toast({ title: "Please complete payment first", description: "Due and shipping must be paid before receiving goods.", variant: "destructive" });
      return;
    }
    try {
      for (const item of items) {
        if (!item.product_id || (item.received_quantity || 0) <= 0) continue;
        const { data: prod } = await supabase.from("products").select("stock_quantity").eq("id", item.product_id).single();
        if (prod) {
          await supabase.from("products").update({
            stock_quantity: (prod.stock_quantity || 0) + (item.received_quantity || 0),
          }).eq("id", item.product_id);
        }
        await supabase.from("inventory_movements").insert({
          product_id: item.product_id,
          movement_type: "purchase_in",
          quantity: item.received_quantity || 0,
          reference_type: "purchase_order",
          reference_id: id,
          notes: `PO: ${poNumber} (${isAgent ? "Via Agent" : "Direct Import"})`,
        });
      }
      setStatus("received");
      await supabase.from("purchase_orders").update({ status: "received", actual_arrival_date: format(new Date(), "yyyy-MM-dd") }).eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      toast({ title: "Goods received and inventory updated!" });
    } catch (err: any) {
      toast({ title: "Error receiving goods", description: err.message, variant: "destructive" });
    }
  };

  // Auto-save draft to localStorage every 30 seconds
  const DRAFT_KEY = `po-draft-${isNew ? "new" : id}`;

  useEffect(() => {
    if (!importType) return;
    const draft = {
      importType, poNumber, supplierId, agentId, status, paymentStatus,
      orderDate, cnyRate, shippingMethod, shippingAgent, trackingNumber,
      portOfEntry, expectedArrival, actualArrival, shippingCostCny,
      shippingChargeBdt, notes, items, payments, additionalCosts, timeline,
    };
    const interval = setInterval(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      toast({ title: "💾 Draft auto-saved", description: "Your changes have been saved locally." });
    }, 30000);
    return () => clearInterval(interval);
  }, [importType, poNumber, supplierId, agentId, status, paymentStatus, orderDate, cnyRate, shippingMethod, shippingAgent, trackingNumber, portOfEntry, expectedArrival, actualArrival, shippingCostCny, shippingChargeBdt, notes, items, payments, additionalCosts, timeline, DRAFT_KEY]);

  // Restore draft on mount for new POs
  useEffect(() => {
    if (!isNew) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const d = JSON.parse(saved);
      if (d.importType) setImportType(d.importType);
      if (d.poNumber) setPoNumber(d.poNumber);
      if (d.supplierId) setSupplierId(d.supplierId);
      if (d.agentId) setAgentId(d.agentId);
      if (d.orderDate) setOrderDate(d.orderDate);
      if (d.cnyRate) setCnyRate(d.cnyRate);
      if (d.shippingMethod) setShippingMethod(d.shippingMethod);
      if (d.shippingAgent) setShippingAgent(d.shippingAgent);
      if (d.trackingNumber) setTrackingNumber(d.trackingNumber);
      if (d.portOfEntry) setPortOfEntry(d.portOfEntry);
      if (d.expectedArrival) setExpectedArrival(d.expectedArrival);
      if (d.actualArrival) setActualArrival(d.actualArrival);
      if (d.shippingCostCny) setShippingCostCny(d.shippingCostCny);
      if (d.shippingChargeBdt) setShippingChargeBdt(d.shippingChargeBdt);
      if (d.notes) setNotes(d.notes);
      if (d.items?.length) setItems(d.items);
      if (d.payments?.length) setPayments(d.payments);
      if (d.additionalCosts?.length) setAdditionalCosts(d.additionalCosts);
      if (d.timeline?.length) setTimeline(d.timeline);
    } catch {}
  }, []);

  // Clear draft on successful save
  const clearDraft = () => localStorage.removeItem(DRAFT_KEY);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  if (!isNew && poLoading) {
    return (
      <div className="space-y-4 p-6">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
      </div>
    );
  }

  const selectedSupplier = suppliers?.find(s => s.id === supplierId);
  const selectedAgent = agents?.find(a => a.id === agentId);
  const paymentMethods = isAgent ? AGENT_PAYMENT_METHODS : DIRECT_PAYMENT_METHODS;

  // Step 1: Import type selection for new PO
  if (isNew && !importType) {
    return (
      <div className="animate-fade-in">
        <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border -mx-6 px-6 py-3 flex items-center" style={{ height: 52 }}>
          <Button variant="ghost" size="icon" className="h-8 w-8 mr-2" onClick={() => navigate("/purchase-orders")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">New Purchase Order</h1>
        </div>
        <div className="max-w-2xl mx-auto mt-16">
          <h2 className="text-center text-xl font-bold text-foreground mb-2">Choose Import Type</h2>
          <p className="text-center text-sm text-muted-foreground mb-8">How are you importing these products?</p>
          <div className="grid grid-cols-2 gap-5">
            <button
              onClick={() => setImportType("AGENT")}
              className="rounded-2xl border-2 border-border bg-card p-8 text-center hover:border-primary hover:shadow-xl transition-all group"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/10 transition-colors">
                <Handshake className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">🤝 Via Agent</h3>
              <p className="text-sm text-muted-foreground">Local agent handles sourcing + shipping. All prices in BDT.</p>
            </button>
            <button
              onClick={() => setImportType("DIRECT")}
              className="rounded-2xl border-2 border-border bg-card p-8 text-center hover:border-primary hover:shadow-xl transition-all group"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/10 transition-colors">
                <Rocket className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">🚀 Direct Import</h3>
              <p className="text-sm text-muted-foreground">Source directly from China supplier. CNY → BDT conversion.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border -mx-6 px-6 py-3 flex items-center justify-between" style={{ height: 52 }}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/purchase-orders")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">{poNumber}</h1>
          <Badge className={`text-[10px] font-semibold ${isAgent ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
            {isAgent ? "🤝 Via Agent" : "🚀 Direct"}
          </Badge>
          <Badge className={`text-[10px] font-semibold ${
            status === "received" ? "bg-success/10 text-success" :
            status === "shipped" || status === "in_transit" ? "bg-purple-100 text-purple-700" :
            "bg-muted text-muted-foreground"
          }`}>{status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <POPdfExport
            poNumber={poNumber} status={status} orderDate={orderDate}
            expectedArrival={expectedArrival} actualArrival={actualArrival}
            supplierName={isAgent ? (selectedAgent?.name || "") : (selectedSupplier?.name || "")}
            supplierWechat={selectedSupplier?.wechat_id || ""}
            supplierPhone={isAgent ? (selectedAgent?.phone || "") : (selectedSupplier?.phone || "")}
            supplierEmail={selectedSupplier?.email || ""}
            supplierAddress={selectedSupplier?.address || ""}
            cnyRate={cnyRate} shippingMethod={shippingMethod}
            shippingAgent={shippingAgent} trackingNumber={trackingNumber}
            portOfEntry={portOfEntry} items={items.map(it => ({
              ...it, unit_price_cny: isAgent ? null : it.unit_price_cny,
            }))}
            payments={payments} additionalCosts={additionalCosts}
            productCostCny={productCostCny} productCostBdt={productCostBdt}
            shippingCostCny={shippingCostCny} shippingCostBdt={shippingCostBdt}
            additionalCostsBdt={additionalCostsBdt} grandTotalBdt={grandTotalBdt}
            totalPaid={totalPaid} remaining={remaining}
            totalQty={totalQty} costPerUnit={costPerUnit}
          />
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex gap-6 mt-5">
        {/* Left Column */}
        <div className="flex-1 space-y-5 min-w-0">

          {/* Agent/Supplier Info */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">
              {isAgent ? "Agent" : "Supplier"}
            </h2>
            {isAgent ? (
              <>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select agent..." /></SelectTrigger>
                  <SelectContent>
                    {agents?.map(a => (
                      <SelectItem key={a.id} value={a.id}>🤝 {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAgent && (
                  <div className="mt-3 p-3 rounded-xl bg-muted/50 text-sm space-y-1">
                    <p><span className="text-muted-foreground">Phone:</span> {selectedAgent.phone || "—"}</p>
                    <p><span className="text-muted-foreground">WhatsApp:</span> {selectedAgent.whatsapp || "—"}</p>
                    <p><span className="text-muted-foreground">bKash:</span> {selectedAgent.bkash_number || "—"}</p>
                    <p><span className="text-muted-foreground">Rating:</span> {"⭐".repeat(selectedAgent.rating || 0)}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select supplier..." /></SelectTrigger>
                  <SelectContent>
                    {suppliers?.map(s => (
                      <SelectItem key={s.id} value={s.id}>🇨🇳 {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSupplier && (
                  <div className="mt-3 p-3 rounded-xl bg-muted/50 text-sm space-y-1">
                    <p><span className="text-muted-foreground">WeChat:</span> {selectedSupplier.wechat_id || "—"}</p>
                    <p><span className="text-muted-foreground">WhatsApp:</span> {selectedSupplier.whatsapp || "—"}</p>
                    <p><span className="text-muted-foreground">Rating:</span> {"⭐".repeat(selectedSupplier.rating || 0)}</p>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Exchange Rate (Direct only) */}
          {!isAgent && (
            <section className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🇨🇳</span>
                  <span className="text-sm font-bold">CNY → BDT Rate:</span>
                  <Input type="number" value={cnyRate} onChange={(e) => setCnyRate(Number(e.target.value))} className="w-24 h-8 text-center font-bold bg-card" step={0.1} />
                </div>
                <span className="text-xs text-muted-foreground">All prices auto-recalculate</span>
              </div>
            </section>
          )}

          {/* Products */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">Products Ordered</h2>

            {/* Product Search */}
            <div className="mb-4">
              <POProductSearch
                addedProductIds={items.map(it => it.product_id).filter(Boolean)}
                isAgent={!!isAgent}
                onSelect={(product) => {
                  setItems(prev => [...prev, {
                    product_id: product.id,
                    product_name: product.name,
                    image_url: product.image_url || "",
                    unit: "pcs",
                    quantity: 1,
                    unit_price_cny: product.china_price_cny || 0,
                    unit_price_bdt: product.landed_cost_bdt || product.selling_price || 0,
                    variant_note: "",
                    received_quantity: 0,
                    condition: "good",
                    _sku: product.sku,
                    _stock: product.stock_quantity || 0,
                  } as any]);
                }}
              />
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Product</TableHead>
                    {!isAgent && <TableHead className="w-20">Unit</TableHead>}
                    <TableHead className="w-20">Qty</TableHead>
                    {isAgent ? (
                      <TableHead className="w-28">Price (৳)</TableHead>
                    ) : (
                      <>
                        <TableHead className="w-28">Price (CNY)</TableHead>
                        <TableHead className="w-28">Price (BDT)</TableHead>
                        <TableHead className="w-28">Total CNY</TableHead>
                      </>
                    )}
                    <TableHead className="w-28">Total BDT</TableHead>
                    <TableHead className="w-32">Note</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, i) => {
                    const totalCny = item.quantity * (item.unit_price_cny || 0);
                    const totalBdt = isAgent
                      ? item.quantity * (item.unit_price_bdt || 0)
                      : totalCny * cnyRate;
                    const stock = (item as any)._stock ?? null;
                    const hasLowStock = stock !== null && item.quantity > stock;

                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.image_url ? (
                              <img src={item.image_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-border flex-shrink-0" />
                            ) : item.product_id ? (
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            ) : null}
                            <div className="min-w-0">
                              {item.product_id ? (
                                <div>
                                  <span className="text-sm font-medium truncate block">{item.product_name}</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    {(item as any)._sku && (
                                      <Badge variant="secondary" className="text-[9px] font-mono h-3.5 px-1">{(item as any)._sku}</Badge>
                                    )}
                                    {hasLowStock && (
                                      <Badge className="text-[9px] h-3.5 px-1 bg-warning/10 text-warning border-warning/30">Low Stock</Badge>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <Input placeholder="Product name" value={item.product_name || ""} onChange={(e) => updateItem(i, "product_name", e.target.value)} className="h-8 text-sm" />
                              )}
                            </div>
                          </div>
                        </TableCell>
                        {!isAgent && (
                          <TableCell>
                            <select value={item.unit || "pcs"} onChange={(e) => updateItem(i, "unit", e.target.value)} className="h-8 text-xs rounded-lg border border-input bg-background px-1.5 w-full">
                              <option value="pcs">pcs</option>
                              <option value="kg">kg</option>
                              <option value="set">set</option>
                              <option value="box">box</option>
                            </select>
                          </TableCell>
                        )}
                        <TableCell>
                          <Input type="number" value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} className="h-8 text-sm w-16" min={1} />
                        </TableCell>
                        {isAgent ? (
                          <TableCell>
                            <Input type="number" value={item.unit_price_bdt || ""} onChange={(e) => updateItem(i, "unit_price_bdt", Number(e.target.value))} className="h-8 text-sm" placeholder="৳" />
                          </TableCell>
                        ) : (
                          <>
                            <TableCell>
                              <Input type="number" value={item.unit_price_cny || ""} onChange={(e) => updateItem(i, "unit_price_cny", Number(e.target.value))} className="h-8 text-sm" placeholder="¥" />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-medium">
                              ৳{((item.unit_price_cny || 0) * cnyRate).toFixed(0)}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              ¥{totalCny.toLocaleString()}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-sm font-semibold">
                          ৳{totalBdt.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Input value={item.variant_note || ""} onChange={(e) => updateItem(i, "variant_note", e.target.value)} className="h-8 text-xs" placeholder="Color, size..." />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(i)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Button variant="ghost" size="sm" className="mt-2 gap-1.5" onClick={addItem}>
              <Plus className="w-3.5 h-3.5" /> Add Row Manually
            </Button>
            <div className="mt-3 p-3 rounded-xl bg-primary/5 flex justify-between text-sm font-semibold">
              <span>Total: {totalQty} units</span>
              {!isAgent && <span>¥{productCostCny.toLocaleString()}</span>}
              <span>৳{productCostBdt.toLocaleString()}</span>
            </div>
          </section>

          {/* Shipping (Direct only) */}
          {!isAgent && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold text-foreground mb-3">Shipping & Customs</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Shipping Method</label>
                  <div className="flex gap-1.5">
                    {SHIPPING_METHODS.map(m => (
                      <Button key={m} variant={shippingMethod === m ? "default" : "outline"} size="sm" className="h-8 text-xs flex-1" onClick={() => setShippingMethod(m)}>{m}</Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Shipping Agent</label>
                  <Input value={shippingAgent} onChange={(e) => setShippingAgent(e.target.value)} className="h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Tracking Number</label>
                  <div className="flex gap-1">
                    <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="h-9" />
                    {trackingNumber && (
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { navigator.clipboard.writeText(trackingNumber); toast({ title: "Copied!" }); }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Port of Entry</label>
                  <Select value={portOfEntry} onValueChange={setPortOfEntry}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Dhaka", "Chittagong", "Benapole"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Expected Arrival</label>
                  <Input type="date" value={expectedArrival} onChange={(e) => setExpectedArrival(e.target.value)} className="h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Actual Arrival</label>
                  <Input type="date" value={actualArrival} onChange={(e) => setActualArrival(e.target.value)} className="h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Shipping Cost (CNY)</label>
                  <Input type="number" value={shippingCostCny} onChange={(e) => setShippingCostCny(Number(e.target.value))} className="h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Shipping Cost (BDT)</label>
                  <Input value={`৳${shippingCostBdt.toLocaleString()}`} readOnly className="h-9 bg-muted/50" />
                </div>
              </div>
              <Separator className="my-4" />
              <h3 className="text-xs font-bold text-muted-foreground mb-2">Additional Costs</h3>
              {additionalCosts.map((cost, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Select value={cost.label} onValueChange={(v) => setAdditionalCosts(prev => prev.map((c, idx) => idx === i ? { ...c, label: v } : c))}>
                    <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COST_LABELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="৳ Amount" value={cost.amount_bdt || ""} onChange={(e) => setAdditionalCosts(prev => prev.map((c, idx) => idx === i ? { ...c, amount_bdt: Number(e.target.value) } : c))} className="h-8 w-32" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCost(i)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={addCost}>
                <Plus className="w-3.5 h-3.5" /> Add Cost Row
              </Button>
            </section>
          )}

          {/* Payment Tracking */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">Payment Tracking</h2>

            {isAgent ? (
              /* Agent payment: structured advance/due/shipping */
              <div className="space-y-4">
                {/* Advance */}
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-foreground">💳 Advance Payment (50%)</h3>
                    <span className="text-xs text-muted-foreground">Suggested: ৳{(productCostBdt * 0.5).toLocaleString()}</span>
                  </div>
                  {payments.filter(p => p.payment_type === "ADVANCE").length === 0 ? (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => addPayment("ADVANCE")}>
                      <Plus className="w-3.5 h-3.5" /> Add Advance Payment
                    </Button>
                  ) : null}
                  {payments.map((p, i) => p.payment_type === "ADVANCE" ? (
                    <div key={i} className="flex flex-wrap gap-2 mb-2 items-center">
                      <Input type="date" value={p.payment_date} onChange={(e) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, payment_date: e.target.value } : pp))} className="h-8 w-36" />
                      <Input type="number" placeholder="Amount" value={p.amount || ""} onChange={(e) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, amount: Number(e.target.value) } : pp))} className="h-8 w-28" />
                      <Select value={p.payment_method} onValueChange={(v) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, payment_method: v } : pp))}>
                        <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AGENT_PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Txn ID" value={p.transaction_id || ""} onChange={(e) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, transaction_id: e.target.value } : pp))} className="h-8 w-28" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePayment(i)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : null)}
                </div>

                {/* Shipping Charge */}
                <div className="rounded-xl border border-border p-4">
                  <h3 className="text-xs font-bold text-foreground mb-2">🚚 Shipping Charge</h3>
                  <div className="flex gap-2 items-center mb-2">
                    <Input type="number" placeholder="৳ Amount" value={shippingChargeBdt || ""} onChange={(e) => setShippingChargeBdt(Number(e.target.value))} className="h-8 w-32" />
                  </div>
                  {payments.filter(p => p.payment_type === "SHIPPING").length === 0 ? (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => addPayment("SHIPPING")}>
                      <Plus className="w-3.5 h-3.5" /> Pay Shipping
                    </Button>
                  ) : null}
                  {payments.map((p, i) => p.payment_type === "SHIPPING" ? (
                    <div key={i} className="flex flex-wrap gap-2 mb-2 items-center">
                      <Input type="date" value={p.payment_date} onChange={(e) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, payment_date: e.target.value } : pp))} className="h-8 w-36" />
                      <Input type="number" placeholder="Amount" value={p.amount || ""} onChange={(e) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, amount: Number(e.target.value) } : pp))} className="h-8 w-28" />
                      <Select value={p.payment_method} onValueChange={(v) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, payment_method: v } : pp))}>
                        <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AGENT_PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Txn ID" value={p.transaction_id || ""} onChange={(e) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, transaction_id: e.target.value } : pp))} className="h-8 w-28" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePayment(i)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : null)}
                </div>

                {/* Due Amount */}
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-foreground">💰 Due Amount</h3>
                    <span className={`text-xs font-bold ${dueAmount > 0 ? "text-destructive" : "text-success"}`}>
                      ৳{Math.max(0, dueAmount).toLocaleString()}
                    </span>
                  </div>
                  {advancePaid === 0 ? (
                    <p className="text-xs text-muted-foreground">Pay advance first before due payment</p>
                  ) : payments.filter(p => p.payment_type === "DUE").length === 0 ? (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => addPayment("DUE")} disabled={advancePaid === 0}>
                      <Plus className="w-3.5 h-3.5" /> Pay Due Amount
                    </Button>
                  ) : null}
                  {payments.map((p, i) => p.payment_type === "DUE" ? (
                    <div key={i} className="flex flex-wrap gap-2 mb-2 items-center">
                      <Input type="date" value={p.payment_date} onChange={(e) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, payment_date: e.target.value } : pp))} className="h-8 w-36" />
                      <Input type="number" placeholder="Amount" value={p.amount || ""} onChange={(e) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, amount: Number(e.target.value) } : pp))} className="h-8 w-28" />
                      <Select value={p.payment_method} onValueChange={(v) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, payment_method: v } : pp))}>
                        <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AGENT_PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Txn ID" value={p.transaction_id || ""} onChange={(e) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, transaction_id: e.target.value } : pp))} className="h-8 w-28" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePayment(i)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : null)}
                </div>
              </div>
            ) : (
              /* Direct: flexible payments */
              <>
                {payments.map((p, i) => (
                  <div key={i} className="flex flex-wrap gap-2 mb-2 items-center">
                    <Input type="date" value={p.payment_date} onChange={(e) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, payment_date: e.target.value } : pp))} className="h-8 w-36" />
                    <Input type="number" placeholder="Amount" value={p.amount || ""} onChange={(e) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, amount: Number(e.target.value) } : pp))} className="h-8 w-28" />
                    <Select value={p.currency} onValueChange={(v) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, currency: v } : pp))}>
                      <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CNY">CNY</SelectItem>
                        <SelectItem value="BDT">BDT</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={p.payment_method} onValueChange={(v) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, payment_method: v } : pp))}>
                      <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DIRECT_PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={p.payment_type} onValueChange={(v) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, payment_type: v } : pp))}>
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADVANCE">Advance</SelectItem>
                        <SelectItem value="REMAINING">Remaining</SelectItem>
                        <SelectItem value="SHIPPING">Shipping</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Txn ID" value={p.transaction_id || ""} onChange={(e) => setPayments(prev => prev.map((pp, idx) => idx === i ? { ...pp, transaction_id: e.target.value } : pp))} className="h-8 w-28" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePayment(i)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => addPayment()}>
                  <Plus className="w-3.5 h-3.5" /> Add Payment
                </Button>
              </>
            )}

            {/* Payment Summary */}
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 space-y-1">
              {isAgent && (
                <>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Product Cost</span><span className="font-semibold">৳{productCostBdt.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Advance Paid</span><span className="font-semibold text-success">৳{advancePaid.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Due Amount</span><span className={`font-semibold ${dueAmount > 0 ? "text-destructive" : "text-success"}`}>৳{Math.max(0, dueAmount).toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Shipping Charge</span><span className="font-semibold">৳{shippingChargeBdt.toLocaleString()}</span></div>
                  <Separator className="my-2" />
                </>
              )}
              <div className="flex justify-between text-sm"><span>Grand Total</span><span className="font-bold">৳{grandTotalBdt.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-success">Total Paid</span><span className="font-semibold text-success">৳{totalPaid.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm">
                <span className={remaining > 0 ? "text-destructive" : "text-success"}>Remaining</span>
                <span className={`font-bold ${remaining > 0 ? "text-destructive" : "text-success"}`}>৳{Math.max(0, remaining).toLocaleString()}</span>
              </div>
              <Progress value={paidPercent} className="mt-2 h-2" />
            </div>
          </section>

          {/* Timeline */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-4">Shipment Timeline</h2>
            <div className="relative pl-8 space-y-4">
              {activeTimeline.map((s, i) => {
                const t = timeline.find(tt => tt.stage === s.stage);
                const completed = !!t?.completed_at;
                const isActiveStage = !completed && (i === 0 || !!timeline.find(tt => tt.stage === s.stage - 1)?.completed_at);
                return (
                  <div key={s.stage} className="relative flex items-start gap-3">
                    <div className="absolute -left-8 top-0.5">
                      <button
                        onClick={() => toggleStage(s.stage)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 transition-all ${
                          completed ? "bg-success border-success text-white" :
                          isActiveStage ? "border-primary bg-primary/10 text-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]" :
                          "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        {completed ? <Check className="w-3 h-3" /> : s.stage}
                      </button>
                      {i < activeTimeline.length - 1 && (
                        <div className={`absolute left-[11px] top-6 w-0.5 h-8 ${completed ? "bg-success" : "bg-border"}`} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${completed ? "text-foreground" : "text-muted-foreground"}`}>
                        {s.icon} {s.label}
                      </p>
                      {completed && t?.completed_at && (
                        <p className="text-xs text-muted-foreground">{format(new Date(t.completed_at), "dd MMM yyyy, HH:mm")}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Receive Goods */}
          {(status === "shipped" || status === "in_transit" || status === "customs" || status === "arrived_bd") && (
            <section className="rounded-2xl border-2 border-success/30 bg-success/5 p-5">
              <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-success" /> Receive Goods
              </h2>
              {isAgent && remaining > 0 && (
                <div className="rounded-xl bg-warning/10 border border-warning/30 p-3 mb-3 text-sm text-warning flex items-center gap-2">
                  ⚠️ Please complete payment first (Due + Shipping) before receiving goods.
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Ordered</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Condition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{item.product_name || `Item ${i + 1}`}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        <Input type="number" value={item.received_quantity || ""} onChange={(e) => updateItem(i, "received_quantity", Number(e.target.value))} className="h-8 w-20" />
                      </TableCell>
                      <TableCell>
                        <Select value={item.condition || "good"} onValueChange={(v) => updateItem(i, "condition", v)}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="damaged">Damaged</SelectItem>
                            <SelectItem value="missing">Missing</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button
                className="mt-3 gap-1.5 bg-success hover:bg-success/90"
                onClick={handleReceiveGoods}
                disabled={isAgent && remaining > 0}
              >
                <CheckCircle2 className="w-4 h-4" /> Receive & Update Inventory
              </Button>
            </section>
          )}

          {/* Notes */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold text-foreground mb-3">Notes & Documents</h2>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes, packing list details..." rows={4} />
          </section>
        </div>

        {/* Right Sidebar */}
        <aside className="w-80 flex-shrink-0 hidden lg:block">
          <div className="sticky top-16 space-y-4">
            {/* Summary Card */}
            <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-primary-foreground p-5">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-medium opacity-80">Purchase Order</p>
                <Badge className={`text-[9px] font-semibold ${isAgent ? "bg-white/20 text-white" : "bg-white/20 text-white"}`}>
                  {isAgent ? "🤝 Agent" : "🚀 Direct"}
                </Badge>
              </div>
              <p className="text-lg font-bold">{poNumber}</p>
              <Badge className="mt-1 bg-white/20 text-white text-[10px]">{status}</Badge>

              <p className="mt-3 text-xs opacity-80">
                {isAgent ? `🤝 ${selectedAgent?.name || "—"}` : `🇨🇳 ${selectedSupplier?.name || "—"}`}
              </p>

              <Separator className="my-3 bg-white/20" />

              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="opacity-70">Products</span><span className="font-semibold">{items.length} items • {totalQty} qty</span></div>
                {!isAgent && <div className="flex justify-between"><span className="opacity-70">Rate</span><span className="font-semibold">1 CNY = ৳{cnyRate}</span></div>}
                <div className="flex justify-between"><span className="opacity-70">Product Cost</span><span className="font-semibold">৳{productCostBdt.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="opacity-70">Shipping</span><span className="font-semibold">৳{shippingCostBdt.toLocaleString()}</span></div>
                {!isAgent && <div className="flex justify-between"><span className="opacity-70">Additional</span><span className="font-semibold">৳{additionalCostsBdt.toLocaleString()}</span></div>}
              </div>

              <Separator className="my-3 bg-white/20" />

              <div className="flex justify-between items-end">
                <span className="text-xs opacity-70">Grand Total</span>
                <span className="text-2xl font-extrabold">৳{grandTotalBdt.toLocaleString()}</span>
              </div>

              <Separator className="my-3 bg-white/20" />

              <div className="flex justify-between text-xs">
                <span className="opacity-70">Paid</span>
                <span className="font-semibold">৳{totalPaid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="opacity-70">Remaining</span>
                <span className={`font-bold ${remaining > 0 ? "text-red-300" : ""}`}>৳{Math.max(0, remaining).toLocaleString()}</span>
              </div>
              <Progress value={paidPercent} className="mt-2 h-1.5 bg-white/20" />
            </div>

            {/* Arrival */}
            {expectedArrival && (
              <div className={`rounded-2xl border p-4 text-center ${
                daysUntilArrival !== null && daysUntilArrival < 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
              }`}>
                {daysUntilArrival !== null && daysUntilArrival >= 0 ? (
                  <>
                    <p className="text-3xl font-extrabold text-primary">{daysUntilArrival}</p>
                    <p className="text-xs text-muted-foreground">days until arrival</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-extrabold text-destructive">{Math.abs(daysUntilArrival || 0)}</p>
                    <p className="text-xs text-destructive">days overdue</p>
                  </>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs font-bold text-muted-foreground mb-2">Quick Actions</p>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-9" onClick={() => addPayment(isAgent ? "ADVANCE" : "OTHER")}>
                <CreditCard className="w-3.5 h-3.5" /> Add Payment
              </Button>
              {trackingNumber && (
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-9" onClick={() => { navigator.clipboard.writeText(trackingNumber); toast({ title: "Tracking copied!" }); }}>
                  <Copy className="w-3.5 h-3.5" /> Copy Tracking
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
