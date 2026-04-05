import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, startOfDay, endOfDay, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/types";
import type { Database } from "@/integrations/supabase/types";

type QcCache = Database["public"]["Tables"]["customer_qc_cache"]["Row"];

interface OrderStat { customer_id: string | null; status: string | null; }
export interface CRMCustomer {
  id: string;
  full_name: string;
  phone: string;
  phone2?: string | null;
  email?: string | null;
  address?: string | null;
  district?: string | null;
  thana?: string | null;
  notes?: string | null;
  total_orders: number;
  total_spent: number;
  last_order_date?: string | null;
  created_at?: string | null;
  manual_segment?: string | null;
  tags?: string[] | null;
  computed_segment: string;
  is_repeat: boolean;
  success_rate?: number | null;
  is_blocked?: boolean;
  blocked_at?: string | null;
  blocked_reason?: string | null;
  risk_flags?: string[] | null;
  delivered_count?: number;
  return_count?: number;
  cancel_count?: number;
  return_rate?: number;
}

export interface Followup {
  id: string;
  customer_phone: string;
  note?: string | null;
  due_at: string;
  is_done: boolean;
  done_at?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  customer_name?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string;
  stage: string;
  note?: string | null;
  is_converted: boolean;
  converted_at?: string | null;
  created_at?: string | null;
}

export function computeSegment(c: CRMCustomer): string {
  if (c.manual_segment) return c.manual_segment;
  const spent = c.total_spent || 0;
  if (spent >= 10000) return "diamond";
  if (spent >= 5000) return "gold";
  if (spent >= 2000) return "silver";
  const lastOrder = c.last_order_date;
  const created = c.created_at;
  if (created) {
    const daysCreated = differenceInDays(new Date(), new Date(created));
    if (daysCreated <= 30 && (!lastOrder || differenceInDays(new Date(), new Date(lastOrder)) <= 30)) return "new";
  }
  if (lastOrder) {
    const days = differenceInDays(new Date(), new Date(lastOrder));
    if (days > 90) return "lost";
    if (days > 60) return "inactive";
  }
  return "active";
}

async function fetchAllCustomers(search?: string): Promise<CRMCustomer[]> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from("customers").select("*");
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    query = query.order("total_spent", { ascending: false, nullsFirst: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error) throw error;
    allRows = [...allRows, ...(data || [])];
    hasMore = (data || []).length === PAGE_SIZE;
    page++;
  }

  // Fetch QC cache (also paginated)
  let allQc: Pick<QcCache, "phone" | "success_rate">[] = [];
  page = 0;
  hasMore = true;
  while (hasMore) {
    const { data } = await supabase.from("customer_qc_cache").select("phone, success_rate")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    allQc = [...allQc, ...(data || [])];
    hasMore = (data || []).length === PAGE_SIZE;
    page++;
  }
  const qcMap = new Map(allQc.map((q) => [q.phone, q.success_rate]));

  // Fetch order stats per customer (delivered, returned, cancelled counts)
  let allOrderStats: OrderStat[] = [];
  page = 0;
  hasMore = true;
  while (hasMore) {
    const { data } = await supabase.from("orders")
      .select("customer_id, status")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    allOrderStats = [...allOrderStats, ...(data || [])];
    hasMore = (data || []).length === PAGE_SIZE;
    page++;
  }

  const statsMap = new Map<string, { delivered: number; returned: number; cancelled: number }>();
  allOrderStats.forEach((o) => {
    if (!o.customer_id) return;
    if (!statsMap.has(o.customer_id)) statsMap.set(o.customer_id, { delivered: 0, returned: 0, cancelled: 0 });
    const s = statsMap.get(o.customer_id)!;
    if (o.status === "delivered" || o.status === "completed") s.delivered++;
    else if (o.status === "returned") s.returned++;
    else if (o.status === "cancelled") s.cancelled++;
  });

  return allRows.map((c) => {
    const os = statsMap.get(c.id) || { delivered: 0, returned: 0, cancelled: 0 };
    const totalOrders = c.total_orders || 0;
    const returnRate = totalOrders > 0 ? Math.round((os.returned / totalOrders) * 100) : 0;
    // Auto risk flags
    const riskFlags: string[] = [...(c.risk_flags || [])];
    if (returnRate >= 40 && !riskFlags.includes("high_return")) riskFlags.push("high_return");
    if (os.cancelled >= 3 && !riskFlags.includes("frequent_cancel")) riskFlags.push("frequent_cancel");

    return {
      ...c,
      total_orders: totalOrders,
      total_spent: c.total_spent || 0,
      computed_segment: computeSegment(c),
      is_repeat: totalOrders >= 3,
      success_rate: qcMap.get(c.phone) ?? null,
      delivered_count: os.delivered,
      return_count: os.returned,
      cancel_count: os.cancelled,
      return_rate: returnRate,
      risk_flags: riskFlags.length > 0 ? riskFlags : (c.risk_flags || []),
    };
  });
}

export function useCustomers(search: string, segmentFilter: string) {
  return useQuery({
    queryKey: ["crm-customers", search, segmentFilter],
    queryFn: async () => {
      const customers = await fetchAllCustomers(search || undefined);

      if (segmentFilter && segmentFilter !== "all") {
        if (segmentFilter === "repeat") {
          return customers.filter((c) => c.is_repeat);
        }
        if (segmentFilter === "blocked") {
          return customers.filter((c) => c.is_blocked);
        }
        if (segmentFilter === "risky") {
          return customers.filter((c) => (c.risk_flags || []).length > 0);
        }
        return customers.filter((c) => c.computed_segment === segmentFilter);
      }
      return customers;
    },
  });
}

export function useFollowups(filter: string) {
  return useQuery({
    queryKey: ["crm-followups", filter],
    queryFn: async () => {
      let query = (supabase as any).from("customer_followups").select("*").order("due_at", { ascending: true });

      if (filter === "done") {
        query = query.eq("is_done", true);
      } else if (filter !== "all") {
        query = query.eq("is_done", false);
      }

      const { data, error } = await query;
      if (error) throw error;

      const phones = Array.from(new Set((data || []).map((f) => String(f.customer_phone)))) as string[];
      let nameMap = new Map<string, string>();
      if (phones.length > 0) {
        const { data: customers } = await supabase.from("customers").select("phone, full_name").in("phone", phones);
        nameMap = new Map((customers || []).map((c) => [c.phone, c.full_name]));
      }

      let followups: Followup[] = (data || []).map((f) => ({
        ...f,
        customer_name: nameMap.get(f.customer_phone) || f.customer_phone,
      }));

      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const weekEnd = endOfDay(addDays(now, 7));

      if (filter === "overdue") {
        followups = followups.filter((f) => new Date(f.due_at) < todayStart && !f.is_done);
      } else if (filter === "today") {
        followups = followups.filter((f) => {
          const d = new Date(f.due_at);
          return d >= todayStart && d <= todayEnd && !f.is_done;
        });
      } else if (filter === "week") {
        followups = followups.filter((f) => {
          const d = new Date(f.due_at);
          return d >= todayStart && d <= weekEnd && !f.is_done;
        });
      }

      return followups;
    },
  });
}

export function useLeads() {
  return useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("leads")
        .select("*")
        .eq("is_converted", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Lead[];
    },
  });
}

export function useCustomerOrders(customerId: string | null) {
  return useQuery({
    queryKey: ["crm-customer-orders", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total_amount, order_date, customer_id")
        .eq("customer_id", customerId!)
        .order("order_date", { ascending: false })
        .limit(20);
      if (error) throw error;

      const orderIds = (data || []).map((o) => o.id);
      let itemMap = new Map<string, any[]>();
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from("order_items")
          .select("order_id, product_name_fallback, quantity")
          .in("order_id", orderIds);
        (items || []).forEach((i) => {
          if (!itemMap.has(i.order_id!)) itemMap.set(i.order_id!, []);
          itemMap.get(i.order_id!)!.push(i);
        });
      }

      return (data || []).map((o) => ({
        ...o,
        items: itemMap.get(o.id) || [],
      }));
    },
  });
}

export function useCRMMutations() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const updateTags = useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      const { error } = await supabase.from("customers").update({ tags } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-customers"] });
      toast({ title: "✅ Tag saved" });
    },
  });

  const updateNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from("customers").update({ notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-customers"] });
    },
  });

  const updateManualSegment = useMutation({
    mutationFn: async ({ id, manual_segment }: { id: string; manual_segment: string | null }) => {
      const { error } = await supabase.from("customers").update({ manual_segment } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-customers"] });
      toast({ title: "✅ Segment updated" });
    },
  });

  const addFollowup = useMutation({
    mutationFn: async (followup: { customer_phone: string; note: string; due_at: string }) => {
      const { error } = await (supabase as any).from("customer_followups").insert(followup);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-followups"] });
      toast({ title: "✅ Follow-up scheduled!" });
    },
  });

  const markFollowupDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("customer_followups")
        .update({ is_done: true, done_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-followups"] });
      toast({ title: "✅ Marked as done" });
    },
  });

  const addLead = useMutation({
    mutationFn: async (lead: { name: string; phone: string; source: string; stage: string; note?: string }) => {
      const { error } = await (supabase as any).from("leads").insert(lead);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      toast({ title: "✅ Lead added!" });
    },
  });

  const convertLead = useMutation({
    mutationFn: async (lead: Lead) => {
      const { error: custError } = await supabase.from("customers").insert({
        full_name: lead.name,
        phone: lead.phone,
        source: lead.source,
      });
      if (custError) throw custError;
      const { error } = await (supabase as any)
        .from("leads")
        .update({ is_converted: true, converted_at: new Date().toISOString() })
        .eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["crm-customers"] });
      toast({ title: "✅ Lead converted to customer!" });
    },
  });

  const addCustomer = useMutation({
    mutationFn: async (customer: { full_name: string; phone: string; email?: string; address?: string; district?: string }) => {
      const { error } = await supabase.from("customers").insert(customer);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-customers"] });
      toast({ title: "✅ Customer added!" });
    },
  });

  const blockCustomer = useMutation({
    mutationFn: async ({ id, is_blocked, blocked_reason }: { id: string; is_blocked: boolean; blocked_reason?: string }) => {
      const update: Partial<Database["public"]["Tables"]["customers"]["Update"]> = {
        is_blocked,
        blocked_at: is_blocked ? new Date().toISOString() : null,
        blocked_reason: is_blocked ? (blocked_reason || null) : null,
      };
      const { error } = await supabase.from("customers").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["crm-customers"] });
      toast({ title: vars.is_blocked ? "🚫 Customer blocked" : "✅ Customer unblocked" });
    },
  });

  const mergeCustomers = useMutation({
    mutationFn: async ({ keepId, mergeId }: { keepId: string; mergeId: string }) => {
      // Move orders from mergeId to keepId
      await supabase.from("orders").update({ customer_id: keepId } as any).eq("customer_id", mergeId);
      // Delete the duplicate
      const { error } = await supabase.from("customers").delete().eq("id", mergeId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-customers"] });
      qc.invalidateQueries({ queryKey: ["crm-customer-orders"] });
      toast({ title: "✅ Customers merged!" });
    },
  });

  const updateRiskFlags = useMutation({
    mutationFn: async ({ id, risk_flags }: { id: string; risk_flags: string[] }) => {
      const { error } = await supabase.from("customers").update({ risk_flags } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-customers"] });
    },
  });

  return { updateTags, updateNotes, updateManualSegment, addFollowup, markFollowupDone, addLead, convertLead, addCustomer, blockCustomer, mergeCustomers, updateRiskFlags };
}
