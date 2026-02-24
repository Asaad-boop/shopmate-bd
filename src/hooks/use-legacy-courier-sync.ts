import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { calculateNetPayable } from "@/lib/courier-calc";

/**
 * Map Pathao order status string to our courier_final_status enum.
 */
function mapPathaoStatus(status: string): string {
  const s = (status || "").toLowerCase();
  if (s.includes("delivered") && s.includes("partial")) return "PARTIAL_DELIVERED";
  if (s.includes("delivered")) return "DELIVERED";
  if (s.includes("return") || s.includes("returned")) return "RETURNED";
  if (s.includes("picked") || s.includes("transit") || s.includes("at_hub") || s.includes("in_return")) return "IN_TRANSIT";
  if (s.includes("cancelled")) return "RETURNED";
  return "UNKNOWN";
}

/**
 * Map Pathao status to ERP status
 */
function mapToErpStatus(courierFinal: string): string | null {
  switch (courierFinal) {
    case "DELIVERED": return "delivered";
    case "RETURNED": return "returned";
    case "PARTIAL_DELIVERED": return "partially_delivered";
    case "IN_TRANSIT": return "in_transit";
    default: return null;
  }
}

interface SyncResult {
  orderId: string;
  success: boolean;
  trackingId: string;
  courierFinalStatus?: string;
  error?: string;
}

export function useLegacyCourierSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const syncSingleOrder = async (orderId: string, trackingId: string): Promise<SyncResult> => {
    try {
      // Call pathao-proxy track_order
      const { data, error } = await supabase.functions.invoke("pathao-proxy", {
        body: { action: "track_order", consignment_id: trackingId },
      });

      if (error) throw new Error(error.message);
      if (!data?._ok) throw new Error(data?.message || "Pathao API error");

      const orderData = data?.data || data;
      const pathaoStatus = orderData?.order_status || orderData?.status || "";
      const courierFinal = mapPathaoStatus(pathaoStatus);
      const erpStatus = mapToErpStatus(courierFinal);

      // Extract charges from Pathao response
      const deliveryFee = parseFloat(orderData?.delivery_fee || orderData?.delivery_charge || 0);
      const codFee = parseFloat(orderData?.cod_fee || 0);
      const discount = parseFloat(orderData?.discount || 0);
      const promoDiscount = parseFloat(orderData?.promo_discount || 0);
      const additionalCharge = parseFloat(orderData?.additional_charge || 0);
      const compensationCost = parseFloat(orderData?.compensation_cost || 0);
      const customerTotal = parseFloat(orderData?.item_price || orderData?.amount_to_collect || 0);
      const returnCost = courierFinal === "RETURNED" ? parseFloat(orderData?.return_fee || deliveryFee || 0) : 0;

      const { totalCost, netPayable } = calculateNetPayable({
        collectable_amount: customerTotal,
        courier_delivery_fee: deliveryFee,
        courier_cod_fee: codFee,
        courier_discount: discount,
        courier_promo_discount: promoDiscount,
        courier_additional_charge: additionalCharge,
        courier_compensation_cost: compensationCost,
        is_return: courierFinal === "RETURNED",
      });

      // Build update payload
      const updatePayload: Record<string, any> = {
        courier_final_status: courierFinal,
        courier_delivery_fee: deliveryFee,
        courier_cod_fee: codFee,
        courier_discount: discount,
        courier_promo_discount: promoDiscount,
        courier_additional_charge: additionalCharge,
        courier_compensation_cost: compensationCost,
        courier_total_cost: totalCost,
        courier_net_payable: netPayable,
        courier_return_cost: returnCost,
        legacy_courier_name: "Pathao",
      };

      // Update ERP status if we got a definitive status
      if (erpStatus) {
        updatePayload.status = erpStatus;
      }

      // Set delivered/returned dates
      if (courierFinal === "DELIVERED" && orderData?.updated_at) {
        updatePayload.legacy_delivered_date = orderData.updated_at;
        updatePayload.delivered_at = orderData.updated_at;
      }
      if (courierFinal === "RETURNED" && orderData?.updated_at) {
        updatePayload.legacy_returned_date = orderData.updated_at;
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", orderId);

      if (updateError) throw new Error(updateError.message);

      return { orderId, success: true, trackingId, courierFinalStatus: courierFinal };
    } catch (err: any) {
      return { orderId, success: false, trackingId, error: err.message };
    }
  };

  const syncOrders = async (orders: Array<{ id: string; trackingId: string }>) => {
    setSyncing(true);
    setProgress({ done: 0, total: orders.length });

    const results: SyncResult[] = [];

    // Process in batches of 3 to avoid rate limiting
    const batchSize = 3;
    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((o) => syncSingleOrder(o.id, o.trackingId))
      );
      results.push(...batchResults);
      setProgress({ done: Math.min(i + batchSize, orders.length), total: orders.length });
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    toast({
      title: `Courier sync complete`,
      description: `✅ ${successCount} synced${failCount > 0 ? ` | ❌ ${failCount} failed` : ""}`,
    });

    // Refresh queries
    queryClient.invalidateQueries({ queryKey: ["legacy-orders"] });
    queryClient.invalidateQueries({ queryKey: ["legacy-stats"] });
    queryClient.invalidateQueries({ queryKey: ["legacy-order-detail"] });

    setSyncing(false);
    setProgress({ done: 0, total: 0 });

    return results;
  };

  return { syncOrders, syncSingleOrder: async (orderId: string, trackingId: string) => {
    setSyncing(true);
    const result = await syncSingleOrder(orderId, trackingId);
    if (result.success) {
      toast({ title: "Synced", description: `Status: ${result.courierFinalStatus}` });
      queryClient.invalidateQueries({ queryKey: ["legacy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["legacy-stats"] });
      queryClient.invalidateQueries({ queryKey: ["legacy-order-detail", orderId] });
    } else {
      toast({ title: "Sync failed", description: result.error, variant: "destructive" });
    }
    setSyncing(false);
    return result;
  }, syncing, progress };
}
