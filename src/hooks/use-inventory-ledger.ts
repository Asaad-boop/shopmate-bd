import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface StockOnHand {
  product_id: string;
  sku: string | null;
  total_physical: number;
  available: number;
  reserved: number;
  in_transit: number;
  damaged: number;
  avg_unit_cost: number;
  last_movement: string | null;
}

/** Fetch all SKU stock levels from v_stock_onhand (ledger-derived) */
export function useStockOnHand() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["stock-on-hand"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_stock_onhand")
        .select("*");
      if (error) throw error;
      // Index by product_id
      const map: Record<string, StockOnHand> = {};
      for (const row of data || []) {
        if (row.product_id) {
          map[row.product_id] = {
            product_id: row.product_id,
            sku: row.sku,
            total_physical: row.total_physical || 0,
            available: row.available || 0,
            reserved: row.reserved || 0,
            in_transit: row.in_transit || 0,
            damaged: row.damaged || 0,
            avg_unit_cost: row.avg_unit_cost || 0,
            last_movement: row.last_movement,
          };
        }
      }
      return map;
    },
    staleTime: 30_000,
  });

  // Realtime: invalidate on ledger changes
  useEffect(() => {
    const channel = supabase
      .channel("inventory-ledger-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_ledger" }, () => {
        qc.invalidateQueries({ queryKey: ["stock-on-hand"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return query;
}

export interface LedgerEntry {
  id: string;
  txn_date: string;
  txn_type: string;
  qty_in: number;
  qty_out: number;
  unit_cost: number | null;
  running_avg_cost: number | null;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_at: string;
  running_balance?: number;
}

/** Fetch full ledger for a single product with running balance */
export function useProductLedger(productId?: string) {
  return useQuery({
    queryKey: ["product-ledger", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_ledger")
        .select("id, txn_date, txn_type, qty_in, qty_out, unit_cost, running_avg_cost, reference_type, reference_id, note, created_at")
        .eq("product_id", productId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Calculate running balance
      let balance = 0;
      const entries: LedgerEntry[] = (data || []).map((row) => {
        balance += (row.qty_in || 0) - (row.qty_out || 0);
        return { ...row, running_balance: balance } as LedgerEntry;
      });
      return entries;
    },
  });
}
