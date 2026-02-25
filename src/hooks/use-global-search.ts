import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";

export interface SearchOrderResult {
  id: string;
  invoice_id: string | null;
  status: string | null;
  total_amount: number | null;
  pathao_tracking_code: string | null;
  legacy_tracking_id: string | null;
  delivery_charge: number | null;
  order_date: string | null;
  order_number: string;
  shopify_order_id: string | null;
  courier_sync_status: string;
  customer_name: string | null;
  customer_phone: string | null;
  tracking_id: string | null;
  courier_name: string | null;
}

export interface SearchCustomerResult {
  id: string;
  full_name: string;
  phone: string;
  address: string | null;
  district: string | null;
  total_orders: number | null;
  total_spent: number | null;
  last_order_date: string | null;
  segment: string | null;
}

export interface SearchProductResult {
  id: string;
  sku: string | null;
  name: string;
  stock_quantity: number | null;
  selling_price: number | null;
  cost_price: number | null;
  status: string | null;
  image_url: string | null;
}

export interface GlobalSearchResults {
  orders: SearchOrderResult[];
  customers: SearchCustomerResult[];
  products: SearchProductResult[];
}

function detectQueryType(q: string): "invoice" | "phone" | "sku" | "tracking" | "general" {
  if (/^INV-\d{4}-/i.test(q)) return "invoice";
  if (/^0[1-9]\d{8,9}$/.test(q) || /^\+880/.test(q)) return "phone";
  if (/^(DA|DP|DT|CT|RE|SP|EL|LP|EC|RL)\d{6,}/i.test(q)) return "tracking";
  if (/^[A-Z]{2,5}-?\d{2,}/i.test(q) && q.length <= 20) return "sku";
  return "general";
}

export function useGlobalSearch(query: string) {
  const trimmed = query.trim();
  const queryType = trimmed ? detectQueryType(trimmed) : "general";

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["global-search", trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("global_search", {
        p_query: trimmed,
        p_limit: 20,
      });
      if (error) throw error;
      return data as unknown as GlobalSearchResults;
    },
    staleTime: 30_000,
  });

  // Sort results based on query type priority
  const sortedResults: GlobalSearchResults | null = data
    ? {
        orders: data.orders || [],
        customers: data.customers || [],
        products: data.products || [],
      }
    : null;

  return { results: sortedResults, isLoading, queryType, refetch };
}

const RECENT_SEARCHES_KEY = "erp_recent_searches";
const RECENT_ITEMS_KEY = "erp_recent_items";

export interface RecentItem {
  type: "order" | "customer" | "product";
  id: string;
  label: string;
  sub: string;
  openedAt: number;
}

export function useRecentSearches() {
  const [searches, setSearches] = useState<string[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      setSearches(JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]"));
      setRecentItems(JSON.parse(localStorage.getItem(RECENT_ITEMS_KEY) || "[]"));
    } catch { /* ignore */ }
  }, []);

  const addSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearches((prev) => {
      const next = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 8);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addRecentItem = useCallback((item: Omit<RecentItem, "openedAt">) => {
    setRecentItems((prev) => {
      const next = [
        { ...item, openedAt: Date.now() },
        ...prev.filter((i) => !(i.type === item.type && i.id === item.id)),
      ].slice(0, 10);
      localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearSearches = useCallback(() => {
    setSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  }, []);

  return { searches, recentItems, addSearch, addRecentItem, clearSearches };
}
