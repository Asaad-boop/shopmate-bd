import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  usePathaoCities,
  usePathaoZones,
  usePathaoAreas,
  usePathaoStores,
  usePathaoCreateOrder,
  usePathaoPrice,
} from "@/hooks/use-pathao";
import { Loader2, Calculator, Truck, Search } from "lucide-react";

interface PathaoBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  customer: any;
  items: any[];
}

export function PathaoBookingModal({
  open,
  onOpenChange,
  order,
  customer,
  items,
}: PathaoBookingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [storeId, setStoreId] = useState<string>("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [cityId, setCityId] = useState<number | null>(null);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [areaId, setAreaId] = useState<number | null>(null);
  const [deliveryType, setDeliveryType] = useState("48");
  const [itemQty, setItemQty] = useState(1);
  const [itemWeight, setItemWeight] = useState("0.5");
  const [amountToCollect, setAmountToCollect] = useState("0");
  const [specialInstruction, setSpecialInstruction] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);

  // Search states
  const [citySearch, setCitySearch] = useState("");
  const [zoneSearch, setZoneSearch] = useState("");
  const [areaSearch, setAreaSearch] = useState("");

  // Queries
  const { data: stores, isLoading: storesLoading } = usePathaoStores();
  const { data: cities, isLoading: citiesLoading } = usePathaoCities();
  const { data: zones, isLoading: zonesLoading } = usePathaoZones(cityId);
  const { data: areas, isLoading: areasLoading } = usePathaoAreas(zoneId);

  // Mutations
  const createOrder = usePathaoCreateOrder();
  const getPrice = usePathaoPrice();

  // Fetch saved Pathao defaults
  const { data: pathaoDefaults } = useQuery({
    queryKey: ["pathao-defaults"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["pathao_default_store", "pathao_delivery_type", "pathao_default_weight"]);
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.key] = s.value || ""; });
      return map;
    },
    staleTime: 60 * 1000,
  });

  // Pre-fill on open
  useEffect(() => {
    if (open && customer && order) {
      setRecipientName(customer.full_name || "");
      setRecipientPhone(customer.phone || "");
      setRecipientAddress(order.delivery_address || customer.address || "");
      const totalItems = items?.reduce((sum, i) => sum + i.quantity, 0) || 1;
      setItemQty(totalItems);
      const isCOD = order.payment_method?.toLowerCase() === "cod" || order.payment_status !== "paid";
      setAmountToCollect(isCOD ? String(order.total_amount || 0) : "0");
      const desc = items?.map((i) => (i.products as any)?.name).filter(Boolean).join(", ") || "";
      setItemDescription(desc);
      setCalculatedPrice(null);

      // Auto-calculate weight from product weight_kg
      const totalWeight = items?.reduce((sum, i) => {
        const productWeight = (i.products as any)?.weight_kg || 0;
        return sum + productWeight * i.quantity;
      }, 0) || 0;

      // Use calculated weight if available, otherwise fall back to saved default
      const savedWeight = pathaoDefaults?.pathao_default_weight || "0.5";
      setItemWeight(totalWeight > 0 ? String(Math.round(totalWeight * 10) / 10) : savedWeight);

      // Apply saved defaults for store and delivery type
      if (pathaoDefaults?.pathao_default_store) setStoreId(pathaoDefaults.pathao_default_store);
      if (pathaoDefaults?.pathao_delivery_type) setDeliveryType(pathaoDefaults.pathao_delivery_type);
    }
  }, [open, customer, order, items, pathaoDefaults]);

  // Reset zone/area when city changes
  useEffect(() => { setZoneId(null); setAreaId(null); }, [cityId]);
  useEffect(() => { setAreaId(null); }, [zoneId]);

  const filteredCities = cities?.filter((c) =>
    c.city_name.toLowerCase().includes(citySearch.toLowerCase())
  ) || [];
  const filteredZones = zones?.filter((z) =>
    z.zone_name.toLowerCase().includes(zoneSearch.toLowerCase())
  ) || [];
  const filteredAreas = areas?.filter((a) =>
    a.area_name.toLowerCase().includes(areaSearch.toLowerCase())
  ) || [];

  const handleCalculatePrice = () => {
    if (!storeId || !cityId || !zoneId) {
      toast({ title: "Please select store, city, and zone first", variant: "destructive" });
      return;
    }
    getPrice.mutate(
      {
        store_id: Number(storeId),
        item_type: 2, // parcel
        delivery_type: Number(deliveryType),
        item_weight: Number(itemWeight),
        recipient_city: cityId,
        recipient_zone: zoneId,
      },
      {
        onSuccess: (data) => {
          setCalculatedPrice(data?.data?.price || data?.price || null);
        },
        onError: (err) => {
          toast({ title: "Price calculation failed", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleSendToPathao = () => {
    if (!storeId || !recipientName || !recipientPhone || !recipientAddress || !cityId || !zoneId) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const orderPayload = {
      orders: [
        {
          store_id: Number(storeId),
          merchant_order_id: order.order_number,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          recipient_address: recipientAddress,
          recipient_city: cityId,
          recipient_zone: zoneId,
          ...(areaId && { recipient_area: areaId }),
          delivery_type: Number(deliveryType),
          item_type: 2,
          special_instruction: specialInstruction || "",
          item_quantity: itemQty,
          item_weight: Number(itemWeight),
          amount_to_collect: Number(amountToCollect),
          item_description: itemDescription || "",
        },
      ],
    };

    createOrder.mutate(orderPayload, {
      onSuccess: async (data) => {
        const consignment = data?.data?.[0] || data?.[0];
        const consignmentId = consignment?.consignment_id || "";
        const trackingCode = consignment?.tracking_code || "";

        if (consignmentId) {
          // Save to orders table
          await supabase
            .from("orders")
            .update({
              pathao_consignment_id: String(consignmentId),
              pathao_tracking_code: trackingCode,
              courier_status: "Pending",
              updated_at: new Date().toISOString(),
            })
            .eq("id", order.id);

          // Add activity note
          await supabase.from("web_order_notes").insert({
            order_id: order.id,
            note_type: "activity",
            content: `Order sent to Pathao. Consignment: ${consignmentId}`,
            created_by: "Staff",
          });

          queryClient.invalidateQueries({ queryKey: ["web-order", order.id] });
          queryClient.invalidateQueries({ queryKey: ["web-order-notes", order.id] });

          toast({
            title: "✅ Pathao এ order পাঠানো হয়েছে!",
            description: `Consignment: ${consignmentId}`,
          });
          onOpenChange(false);
        } else {
          toast({
            title: "Warning",
            description: "Order sent but no consignment ID received. Check Pathao dashboard.",
            variant: "destructive",
          });
        }
      },
      onError: (err) => {
        toast({ title: "Failed to send to Pathao", description: err.message, variant: "destructive" });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle>Send to Pathao</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Order: {order?.order_number}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4 overflow-y-auto" style={{ maxHeight: "calc(90vh - 180px)" }}>
          {/* Store Selection */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Pathao Store *</label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger className="rounded-lg h-9 text-sm">
                <SelectValue placeholder={storesLoading ? "Loading stores..." : "Select Store"} />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {stores?.map((s) => (
                  <SelectItem key={s.store_id} value={String(s.store_id)}>
                    {s.store_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Recipient Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Recipient Name *</label>
              <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="rounded-lg h-9 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Recipient Phone *</label>
              <Input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} className="rounded-lg h-9 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Recipient Address *</label>
            <Textarea value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} rows={2} className="rounded-lg text-sm resize-none" />
          </div>

          {/* Location Dropdowns */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">City *</label>
              <Select value={cityId ? String(cityId) : ""} onValueChange={(v) => setCityId(Number(v))}>
                <SelectTrigger className="rounded-lg h-9 text-sm">
                  <SelectValue placeholder={citiesLoading ? "Loading..." : "City"} />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50 max-h-60">
                  <div className="px-2 py-1.5 sticky top-0 bg-popover">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-input bg-background outline-none"
                        placeholder="Search city..."
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {filteredCities.map((c) => (
                    <SelectItem key={c.city_id} value={String(c.city_id)}>
                      {c.city_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Zone *</label>
              <Select value={zoneId ? String(zoneId) : ""} onValueChange={(v) => setZoneId(Number(v))} disabled={!cityId}>
                <SelectTrigger className="rounded-lg h-9 text-sm">
                  <SelectValue placeholder={zonesLoading ? "Loading..." : "Zone"} />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50 max-h-60">
                  <div className="px-2 py-1.5 sticky top-0 bg-popover">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-input bg-background outline-none"
                        placeholder="Search zone..."
                        value={zoneSearch}
                        onChange={(e) => setZoneSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {filteredZones.map((z) => (
                    <SelectItem key={z.zone_id} value={String(z.zone_id)}>
                      {z.zone_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Area</label>
              <Select value={areaId ? String(areaId) : ""} onValueChange={(v) => setAreaId(Number(v))} disabled={!zoneId}>
                <SelectTrigger className="rounded-lg h-9 text-sm">
                  <SelectValue placeholder={areasLoading ? "Loading..." : "Area"} />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50 max-h-60">
                  <div className="px-2 py-1.5 sticky top-0 bg-popover">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-input bg-background outline-none"
                        placeholder="Search area..."
                        value={areaSearch}
                        onChange={(e) => setAreaSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {filteredAreas.map((a) => (
                    <SelectItem key={a.area_id} value={String(a.area_id)}>
                      {a.area_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Delivery & Item Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Delivery Type</label>
              <Select value={deliveryType} onValueChange={setDeliveryType}>
                <SelectTrigger className="rounded-lg h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="48">Normal (48h)</SelectItem>
                  <SelectItem value="12">Express (12h)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Item Qty</label>
              <Input type="number" value={itemQty} onChange={(e) => setItemQty(Number(e.target.value))} className="rounded-lg h-9 text-sm" min={1} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Weight (kg)</label>
              <Input value={itemWeight} onChange={(e) => setItemWeight(e.target.value)} className="rounded-lg h-9 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">COD Amount</label>
              <Input value={amountToCollect} onChange={(e) => setAmountToCollect(e.target.value)} className="rounded-lg h-9 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Item Description</label>
            <Input value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} className="rounded-lg h-9 text-sm" />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Special Instruction</label>
            <Input value={specialInstruction} onChange={(e) => setSpecialInstruction(e.target.value)} placeholder="Optional" className="rounded-lg h-9 text-sm" />
          </div>

        </div>

        <div className="sticky bottom-0 z-10 bg-card px-6 py-4 border-t border-border flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleCalculatePrice}
            disabled={getPrice.isPending}
            className="rounded-lg h-9 text-xs gap-1.5"
          >
            {getPrice.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
            Calculate Price
          </Button>
          {calculatedPrice !== null && (
            <Badge variant="secondary" className="text-sm px-3 py-1 rounded-lg">
              Delivery: {formatBDT(calculatedPrice)}
            </Badge>
          )}
          <div className="flex-1" />
          <Button
            onClick={handleSendToPathao}
            disabled={createOrder.isPending}
            className="rounded-lg h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm gap-2"
          >
            {createOrder.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Truck className="w-4 h-4" />
            )}
            Send to Pathao
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
