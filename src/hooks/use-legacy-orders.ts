import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Configurable bulk selection limit */
export const MAX_BULK_LIMIT = 500;
/** Batch size for paginated fetching */
const FETCH_PAGE_SIZE = 1000;

export interface LegacyOrderFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  batchId: string;
  courierName: string;
  legacyStatus: string;
  courierFinalStatus: string;
  settlementStatus: string;
}

/**
 * Recursively fetch all rows matching filters (bypasses Supabase 1000-row default).
 */
async function fetchAllLegacyOrders(filters: LegacyOrderFilters) {
  let allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let q = supabase
      .from("orders")
      .select("*, customers(full_name, phone, address, district, thana), order_items(id, product_id, quantity, unit_price, products(name, sku))")
      .eq("order_source", "LEGACY")
      .order("order_date", { ascending: false })
      .range(from, from + FETCH_PAGE_SIZE - 1);

    if (filters.dateFrom) q = q.gte("order_date", filters.dateFrom);
    if (filters.dateTo) q = q.lte("order_date", filters.dateTo + "T23:59:59");
    if (filters.batchId) q = q.eq("legacy_import_batch_id", filters.batchId);
    if (filters.legacyStatus && filters.legacyStatus !== "all") q = q.eq("legacy_status", filters.legacyStatus);
    if (filters.courierFinalStatus && filters.courierFinalStatus !== "all") q = q.eq("courier_final_status", filters.courierFinalStatus);
    if (filters.courierName && filters.courierName !== "all") q = q.eq("legacy_courier_name", filters.courierName);
    if (filters.settlementStatus === "posted") q = q.eq("settlement_posted", true);
    if (filters.settlementStatus === "not_posted") q = q.eq("settlement_posted", false);

    const { data, error } = await q;
    if (error) throw error;

    const rows = data || [];
    allRows = allRows.concat(rows);
    from += FETCH_PAGE_SIZE;
    hasMore = rows.length === FETCH_PAGE_SIZE;
  }

  // Client-side search
  if (filters.search) {
    const s = filters.search.toLowerCase();
    allRows = allRows.filter((o: any) =>
      o.order_number?.toLowerCase().includes(s) ||
      o.legacy_order_id?.toLowerCase().includes(s) ||
      o.legacy_invoice_no?.toLowerCase().includes(s) ||
      o.legacy_tracking_id?.toLowerCase().includes(s) ||
      (o.customers as any)?.full_name?.toLowerCase().includes(s) ||
      (o.customers as any)?.phone?.includes(s)
    );
  }

  return allRows;
}

export function useLegacyOrders(filters: LegacyOrderFilters) {
  return useQuery({
    queryKey: ["legacy-orders", filters],
    queryFn: () => fetchAllLegacyOrders(filters),
  });
}

export function useLegacyStats() {
  return useQuery({
    queryKey: ["legacy-stats"],
    queryFn: async () => {
      // Paginated fetch for stats too
      let allOrders: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("orders")
          .select("status, courier_final_status, settlement_posted, total_amount")
          .eq("order_source", "LEGACY")
          .range(from, from + FETCH_PAGE_SIZE - 1);
        if (error) throw error;
        const rows = data || [];
        allOrders = allOrders.concat(rows);
        from += FETCH_PAGE_SIZE;
        hasMore = rows.length === FETCH_PAGE_SIZE;
      }

      const orders = allOrders;
      const total = orders.length;
      const delivered = orders.filter((o: any) => o.status === "delivered" || o.courier_final_status === "DELIVERED").length;
      const returned = orders.filter((o: any) => o.status === "returned" || o.courier_final_status === "RETURNED").length;
      const settlementPending = orders
        .filter((o: any) => !o.settlement_posted && (o.status === "delivered" || o.courier_final_status === "DELIVERED"))
        .reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
      const exceptions = orders.filter((o: any) =>
        o.status === "delivered" && (!o.courier_final_status || o.courier_final_status === "UNKNOWN")
      ).length;

      return { total, delivered, returned, settlementPending, exceptions };
    },
  });
}

export function useLegacyBatchList() {
  return useQuery({
    queryKey: ["legacy-batches-list"],
    queryFn: async () => {
      const { data } = await (supabase.from("legacy_import_batches") as any)
        .select("id, file_name, created_at, total_rows, imported_count")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });
}
