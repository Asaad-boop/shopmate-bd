import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductStats {
  productId: string;
  salesPerDay: number;
  totalSold30d: number;
  lastSaleDate: string | null;
  lastRestockDate: string | null;
}

export function useInventoryStats() {
  return useQuery({
    queryKey: ["inventory-stats"],
    queryFn: async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Get sales from last 30 days per product
      const { data: salesData } = await supabase
        .from("order_items")
        .select("product_id, quantity, order_id, orders!inner(order_date, status)")
        .gte("orders.order_date", thirtyDaysAgo)
        .in("orders.status", ["pending", "packed", "shipped", "delivered"]);

      // Get last sale date per product (all time)
      const { data: allSales } = await supabase
        .from("order_items")
        .select("product_id, orders!inner(order_date, status)")
        .in("orders.status", ["pending", "packed", "shipped", "delivered"])
        .order("orders(order_date)", { ascending: false });

      // Get last restock per product
      const { data: restocks } = await supabase
        .from("inventory_movements")
        .select("product_id, created_at, quantity")
        .gt("quantity", 0)
        .order("created_at", { ascending: false });

      const statsMap: Record<string, ProductStats> = {};

      // Calculate 30-day sales
      if (salesData) {
        for (const item of salesData) {
          const pid = item.product_id;
          if (!pid) continue;
          if (!statsMap[pid]) {
            statsMap[pid] = { productId: pid, salesPerDay: 0, totalSold30d: 0, lastSaleDate: null, lastRestockDate: null };
          }
          statsMap[pid].totalSold30d += item.quantity;
        }
        for (const pid of Object.keys(statsMap)) {
          statsMap[pid].salesPerDay = Math.round((statsMap[pid].totalSold30d / 30) * 100) / 100;
        }
      }

      // Last sale date
      if (allSales) {
        const seen = new Set<string>();
        for (const item of allSales) {
          const pid = item.product_id;
          if (!pid || seen.has(pid)) continue;
          seen.add(pid);
          if (!statsMap[pid]) {
            statsMap[pid] = { productId: pid, salesPerDay: 0, totalSold30d: 0, lastSaleDate: null, lastRestockDate: null };
          }
          statsMap[pid].lastSaleDate = (item.orders as any)?.order_date || null;
        }
      }

      // Last restock date
      if (restocks) {
        const seen = new Set<string>();
        for (const item of restocks) {
          const pid = item.product_id;
          if (!pid || seen.has(pid)) continue;
          seen.add(pid);
          if (!statsMap[pid]) {
            statsMap[pid] = { productId: pid, salesPerDay: 0, totalSold30d: 0, lastSaleDate: null, lastRestockDate: null };
          }
          statsMap[pid].lastRestockDate = item.created_at;
        }
      }

      return statsMap;
    },
    staleTime: 60_000,
  });
}
