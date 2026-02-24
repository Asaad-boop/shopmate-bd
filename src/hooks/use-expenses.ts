import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ── Expense Categories ──
export function useExpenseCategories() {
  return useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*, chart_of_accounts(code, name)")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; default_gl_account_id?: string | null; is_allocatable?: boolean }) => {
      const { error } = await supabase.from("expense_categories").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
      toast({ title: "Category created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; default_gl_account_id?: string | null; is_allocatable?: boolean }) => {
      const { error } = await supabase.from("expense_categories").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
      toast({ title: "Category updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ── Expenses ──
export function useExpensesV2(filters: { dateFrom?: string; dateTo?: string; categoryId?: string; status?: string; page: number; pageSize: number }) {
  return useQuery({
    queryKey: ["expenses-v2", filters],
    queryFn: async () => {
      let query = supabase.from("expenses_v2").select("*, expense_categories(name), chart_of_accounts(code, name)", { count: "exact" });
      if (filters.dateFrom) query = query.gte("expense_date", filters.dateFrom);
      if (filters.dateTo) query = query.lte("expense_date", filters.dateTo);
      if (filters.categoryId && filters.categoryId !== "all") query = query.eq("category_id", filters.categoryId);
      if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
      const from = filters.page * filters.pageSize;
      query = query.order("expense_date", { ascending: false }).range(from, from + filters.pageSize - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      expense_date: string;
      category_id: string;
      vendor_name?: string;
      description: string;
      amount: number;
      payment_method: string;
      paid_from_account_id?: string | null;
      reference_type?: string;
      reference_id?: string;
      status?: string;
    }) => {
      const { data, error } = await supabase.from("expenses_v2").insert({
        ...payload,
        status: payload.status || "draft",
      }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses-v2"] });
      toast({ title: "Expense created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function usePostExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: any) => {
      // Get category's GL account
      const { data: cat } = await supabase.from("expense_categories").select("default_gl_account_id").eq("id", expense.category_id).single();
      const expenseAccountId = cat?.default_gl_account_id;
      const payAccountId = expense.paid_from_account_id;

      if (!expenseAccountId) throw new Error("Category has no GL account mapped");
      if (!payAccountId) throw new Error("No payment account selected");

      // Create journal entry
      const { data: je, error: jeErr } = await supabase.from("journal_entries").insert({
        entry_date: expense.expense_date,
        description: `Expense: ${expense.description || expense.vendor_name || 'N/A'}`,
        reference_type: "expense",
        reference_id: expense.id,
        status: "posted",
        is_auto: true,
      }).select("id").single();
      if (jeErr) throw jeErr;

      // Dr Expense, Cr Cash/Bank
      const { error: lineErr } = await supabase.from("journal_lines").insert([
        { journal_id: je.id, account_id: expenseAccountId, debit: expense.amount, credit: 0, description: `${expense.description}` },
        { journal_id: je.id, account_id: payAccountId, debit: 0, credit: expense.amount, description: "Payment" },
      ]);
      if (lineErr) throw lineErr;

      // Update expense status
      const { error: upErr } = await supabase.from("expenses_v2").update({
        status: "posted", journal_id: je.id, updated_at: new Date().toISOString()
      }).eq("id", expense.id);
      if (upErr) throw upErr;

      // Audit log
      await supabase.from("audit_logs").insert({
        entity_type: "expense_v2",
        entity_id: expense.id,
        action: "post",
        after_json: { journal_id: je.id, amount: expense.amount },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses-v2"] });
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: "Expense posted to GL" });
    },
    onError: (e: any) => toast({ title: "Post error", description: e.message, variant: "destructive" }),
  });
}

export function useVoidExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: any) => {
      if (expense.journal_id) {
        // Reverse the journal
        const { error } = await supabase.rpc("reverse_journal_entry", {
          p_journal_id: expense.journal_id,
          p_reason: "Expense voided",
        });
        if (error) throw error;
      }
      const { error: upErr } = await supabase.from("expenses_v2").update({
        status: "void", updated_at: new Date().toISOString()
      }).eq("id", expense.id);
      if (upErr) throw upErr;

      await supabase.from("audit_logs").insert({
        entity_type: "expense_v2",
        entity_id: expense.id,
        action: "void",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses-v2"] });
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: "Expense voided" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ── Allocation Rules ──
export function useAllocationRules() {
  return useQuery({
    queryKey: ["allocation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("allocation_rules").select("*, expense_categories(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddAllocationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string; category_id: string; allocation_method: string;
      scope?: string; default_target?: string; config_json?: any;
    }) => {
      const { error } = await supabase.from("allocation_rules").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allocation-rules"] });
      toast({ title: "Rule created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useToggleAllocationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("allocation_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["allocation-rules"] }),
  });
}

// ── Allocations ──
export function useExpenseAllocations() {
  return useQuery({
    queryKey: ["expense-allocations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_allocations")
        .select("*, expense_categories(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAllocationLines(allocationId: string | null) {
  return useQuery({
    queryKey: ["expense-allocation-lines", allocationId],
    enabled: !!allocationId,
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_allocation_lines")
        .select("*").eq("allocation_id", allocationId!).order("allocated_amount", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      run_name: string;
      category_id: string;
      date_from: string;
      date_to: string;
      allocation_method: string;
      total_amount: number;
      lines: { target_type: string; target_id: string; allocated_amount: number; weight_value?: number }[];
      status?: string;
    }) => {
      // Validate sum
      const lineSum = payload.lines.reduce((s, l) => s + l.allocated_amount, 0);
      if (Math.abs(lineSum - payload.total_amount) > 0.01) {
        throw new Error(`Allocation sum (${lineSum.toFixed(2)}) ≠ total (${payload.total_amount.toFixed(2)})`);
      }

      const { data: alloc, error: allocErr } = await supabase.from("expense_allocations").insert({
        run_name: payload.run_name,
        category_id: payload.category_id,
        date_from: payload.date_from,
        date_to: payload.date_to,
        allocation_method: payload.allocation_method,
        total_amount: payload.total_amount,
        status: payload.status || "draft",
      }).select("id").single();
      if (allocErr) throw allocErr;

      const lineRows = payload.lines.map((l) => ({ ...l, allocation_id: alloc.id }));
      const { error: lineErr } = await supabase.from("expense_allocation_lines").insert(lineRows);
      if (lineErr) throw lineErr;

      await supabase.from("audit_logs").insert({
        entity_type: "expense_allocation",
        entity_id: alloc.id,
        action: payload.status === "posted" ? "create_and_post" : "create",
        after_json: { total: payload.total_amount, lines: payload.lines.length },
      });

      return alloc.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-allocations"] });
      toast({ title: "Allocation created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function usePostAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_allocations").update({ status: "posted" }).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ entity_type: "expense_allocation", entity_id: id, action: "post" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-allocations"] });
      toast({ title: "Allocation posted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useReverseAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_allocations").update({ status: "reversed" }).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ entity_type: "expense_allocation", entity_id: id, action: "reverse" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-allocations"] });
      toast({ title: "Allocation reversed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ── Delivered data for allocation weights ──
export function useDeliveredOrderStats(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["delivered-order-stats", dateFrom, dateTo],
    enabled: !!dateFrom && !!dateTo,
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, total_amount, order_items(product_id, quantity, unit_price, products(sku, name, cost_price))")
        .eq("status", "delivered")
        .gte("order_date", dateFrom)
        .lte("order_date", dateTo);
      if (error) throw error;

      // Aggregate by SKU
      const skuMap: Record<string, { sku: string; name: string; qty: number; revenue: number; cogs: number }> = {};
      let totalOrders = 0;

      (orders || []).forEach((o: any) => {
        totalOrders++;
        (o.order_items || []).forEach((item: any) => {
          const sku = item.products?.sku || item.product_id;
          const name = item.products?.name || sku;
          if (!skuMap[sku]) skuMap[sku] = { sku, name, qty: 0, revenue: 0, cogs: 0 };
          skuMap[sku].qty += item.quantity || 0;
          skuMap[sku].revenue += (item.unit_price || 0) * (item.quantity || 0);
          skuMap[sku].cogs += (item.products?.cost_price || 0) * (item.quantity || 0);
        });
      });

      return {
        totalOrders,
        skus: Object.values(skuMap),
        totalRevenue: Object.values(skuMap).reduce((s, v) => s + v.revenue, 0),
        totalCogs: Object.values(skuMap).reduce((s, v) => s + v.cogs, 0),
        totalQty: Object.values(skuMap).reduce((s, v) => s + v.qty, 0),
      };
    },
  });
}

// ── Expense Reports ──
export function useExpenseReportByCategory(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ["expense-report-category", dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase.from("expenses_v2").select("amount, category_id, expense_categories(name)").eq("status", "posted");
      if (dateFrom) query = query.gte("expense_date", dateFrom);
      if (dateTo) query = query.lte("expense_date", dateTo);
      const { data, error } = await query;
      if (error) throw error;

      const catMap: Record<string, { category: string; total: number; count: number }> = {};
      (data || []).forEach((e: any) => {
        const name = e.expense_categories?.name || "Unknown";
        if (!catMap[name]) catMap[name] = { category: name, total: 0, count: 0 };
        catMap[name].total += Number(e.amount || 0);
        catMap[name].count++;
      });
      return Object.values(catMap).sort((a, b) => b.total - a.total);
    },
  });
}

export function useAllocationSummary() {
  return useQuery({
    queryKey: ["allocation-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_allocation_lines")
        .select("target_type, target_id, allocated_amount, expense_allocations!inner(status)")
        .eq("expense_allocations.status", "posted");
      if (error) throw error;

      let totalAllocated = 0;
      const skuMap: Record<string, number> = {};
      (data || []).forEach((l: any) => {
        totalAllocated += Number(l.allocated_amount || 0);
        if (l.target_type === "sku") {
          skuMap[l.target_id] = (skuMap[l.target_id] || 0) + Number(l.allocated_amount || 0);
        }
      });

      const topSkus = Object.entries(skuMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([sku, amount]) => ({ sku, amount }));

      return { totalAllocated, topSkus };
    },
  });
}
