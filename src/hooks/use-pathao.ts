import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function invoke(body: Record<string, unknown>) {
  return supabase.functions.invoke("pathao-proxy", { body });
}

export interface PathaoCity { city_id: number; city_name: string }
export interface PathaoZone { zone_id: number; zone_name: string }
export interface PathaoArea { area_id: number; area_name: string }
export interface PathaoStore { store_id: number; store_name: string; store_address: string }

export function usePathaoCities() {
  return useQuery({
    queryKey: ["pathao-cities"],
    queryFn: async () => {
      const { data, error } = await invoke({ action: "cities" });
      if (error) throw error;
      return (data?.data?.data || []) as PathaoCity[];
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h
  });
}

export function usePathaoZones(cityId: number | null) {
  return useQuery({
    queryKey: ["pathao-zones", cityId],
    queryFn: async () => {
      const { data, error } = await invoke({ action: "zones", city_id: cityId });
      if (error) throw error;
      return (data?.data?.data || []) as PathaoZone[];
    },
    enabled: !!cityId,
    staleTime: 60 * 60 * 1000,
  });
}

export function usePathaoAreas(zoneId: number | null) {
  return useQuery({
    queryKey: ["pathao-areas", zoneId],
    queryFn: async () => {
      const { data, error } = await invoke({ action: "areas", zone_id: zoneId });
      if (error) throw error;
      return (data?.data?.data || []) as PathaoArea[];
    },
    enabled: !!zoneId,
    staleTime: 60 * 60 * 1000,
  });
}

export function usePathaoStores() {
  return useQuery({
    queryKey: ["pathao-stores"],
    queryFn: async () => {
      const { data, error } = await invoke({ action: "stores" });
      if (error) throw error;
      return (data?.data?.data || []) as PathaoStore[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function usePathaoCreateOrder() {
  return useMutation({
    mutationFn: async (orderData: Record<string, unknown>) => {
      const { data, error } = await invoke({ action: "create_order", order: orderData });
      if (error) throw error;
      // Pathao bulk API returns _ok:true with an acceptance message — that's success
      if (data?._ok === false) {
        const msg = data?.message || data?.errors
          ? JSON.stringify(data.errors || data.message)
          : "Failed to create Pathao order";
        throw new Error(msg);
      }
      return data;
    },
  });
}

export function usePathaoPrice() {
  return useMutation({
    mutationFn: async (priceData: Record<string, unknown>) => {
      const { data, error } = await invoke({ action: "price_plan", price_data: priceData });
      if (error) throw error;
      return data;
    },
  });
}

export function usePathaoTrack(consignmentId: string | null) {
  return useQuery({
    queryKey: ["pathao-track", consignmentId],
    queryFn: async () => {
      const { data, error } = await invoke({ action: "track_order", consignment_id: consignmentId });
      if (error) throw error;
      return data;
    },
    enabled: !!consignmentId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // auto refresh every 5 mins
  });
}
