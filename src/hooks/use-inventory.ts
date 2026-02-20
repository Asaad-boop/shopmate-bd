import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useInventoryProducts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["inventory-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name), suppliers(name)")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("inventory-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_movements" }, () => {
        queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useInventoryMovements(productId?: string) {
  return useQuery({
    queryKey: ["inventory-movements", productId],
    queryFn: async () => {
      let q = supabase
        .from("inventory_movements")
        .select("*, products(name, sku), staff:created_by(full_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (productId) q = q.eq("product_id", productId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}
