import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Exception {
  id: string;
  code: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  source_module: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  detected_at: string;
  detected_by: string;
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ExceptionRule {
  id: string;
  code: string;
  name: string;
  module: string;
  schedule: string;
  is_active: boolean;
  config_json: Record<string, any>;
  last_run_at: string | null;
  last_run_result: string | null;
  created_at: string;
}

export interface ExceptionEvent {
  id: string;
  exception_id: string;
  event_type: string;
  message: string | null;
  actor: string | null;
  created_at: string;
}

// ─── Queries ───

export function useExceptions(filters?: { status?: string; severity?: string; module?: string }) {
  return useQuery({
    queryKey: ["exceptions", filters],
    queryFn: async () => {
      let q = supabase.from("exceptions").select("*").order("detected_at", { ascending: false }).limit(500);
      if (filters?.status && filters.status !== "all") q = q.eq("status", filters.status);
      if (filters?.severity && filters.severity !== "all") q = q.eq("severity", filters.severity);
      if (filters?.module && filters.module !== "all") q = q.eq("source_module", filters.module);
      const { data, error } = await q;
      if (error) throw error;
      return data as Exception[];
    },
  });
}

export function useExceptionRules() {
  return useQuery({
    queryKey: ["exception-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exception_rules").select("*").order("module");
      if (error) throw error;
      return data as ExceptionRule[];
    },
  });
}

export function useExceptionEvents(exceptionId?: string) {
  return useQuery({
    queryKey: ["exception-events", exceptionId],
    enabled: !!exceptionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exception_events")
        .select("*")
        .eq("exception_id", exceptionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ExceptionEvent[];
    },
  });
}

export function useAllEvents(filters?: { module?: string }) {
  return useQuery({
    queryKey: ["all-exception-events", filters],
    queryFn: async () => {
      // Get events with exception info via join
      const { data, error } = await supabase
        .from("exception_events")
        .select("*, exceptions!inner(code, title, source_module, severity)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as (ExceptionEvent & { exceptions: Pick<Exception, "code" | "title" | "source_module" | "severity"> })[];
    },
  });
}

export function useExceptionStats() {
  return useQuery({
    queryKey: ["exception-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exceptions").select("status, severity, source_module");
      if (error) throw error;
      const all = data as Pick<Exception, "status" | "severity" | "source_module">[];
      const open = all.filter((e) => e.status === "open" || e.status === "in_progress");
      return {
        total_open: open.length,
        critical: open.filter((e) => e.severity === "critical").length,
        high: open.filter((e) => e.severity === "high").length,
        by_module: Object.entries(
          open.reduce((acc, e) => { acc[e.source_module] = (acc[e.source_module] || 0) + 1; return acc; }, {} as Record<string, number>)
        ).sort((a, b) => b[1] - a[1]),
        resolved_count: all.filter((e) => e.status === "resolved").length,
      };
    },
  });
}

// ─── Mutations ───

export function useUpdateException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates, eventMessage }: { id: string; updates: Partial<Exception>; eventMessage?: string }) => {
      const { error } = await supabase.from("exceptions").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      if (eventMessage) {
        const eventType = updates.status === "resolved" ? "resolved" : updates.status === "ignored" ? "ignored" : updates.assigned_to ? "assigned" : "status_changed";
        await supabase.from("exception_events").insert({ exception_id: id, event_type: eventType, message: eventMessage, actor: "user" });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exceptions"] });
      qc.invalidateQueries({ queryKey: ["exception-stats"] });
      qc.invalidateQueries({ queryKey: ["exception-events"] });
      qc.invalidateQueries({ queryKey: ["all-exception-events"] });
      toast({ title: "Exception updated" });
    },
  });
}

export function useToggleRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("exception_rules").update({ is_active, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exception-rules"] });
      toast({ title: "Rule updated" });
    },
  });
}

// ─── Run Checks Engine ───

export function useRunChecks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const results: string[] = [];

      // Helper: upsert exception (avoid duplicates by code+entity)
      async function upsertException(exc: {
        code: string; title: string; description: string; severity: string;
        source_module: string; source_entity_type: string; source_entity_id: string;
        metadata?: Record<string, any>;
      }) {
        // Check if open exception already exists
        const { data: existing } = await supabase
          .from("exceptions")
          .select("id")
          .eq("code", exc.code)
          .eq("source_entity_id", exc.source_entity_id)
          .in("status", ["open", "in_progress"])
          .limit(1);
        if (existing && existing.length > 0) return; // already exists
        const { error } = await supabase.from("exceptions").insert({
          ...exc, metadata: exc.metadata || {},
        });
        if (!error) {
          // Create event
          await supabase.from("exception_events").insert({
            exception_id: (await supabase.from("exceptions").select("id").eq("code", exc.code).eq("source_entity_id", exc.source_entity_id).order("created_at", { ascending: false }).limit(1)).data?.[0]?.id,
            event_type: "created",
            message: `Auto-detected: ${exc.title}`,
            actor: "system",
          });
        }
      }

      // Get active rules
      const { data: rules } = await supabase.from("exception_rules").select("*").eq("is_active", true);
      if (!rules) return results;

      const activeRuleCodes = new Set(rules.map((r: any) => r.code));

      // C1: Inventory - NEGATIVE_STOCK
      if (activeRuleCodes.has("NEGATIVE_STOCK")) {
        const { data: stocks } = await supabase.from("v_stock_on_hand").select("product_id, sku, on_hand");
        if (stocks) {
          for (const s of stocks as any[]) {
            if ((s.on_hand || 0) < 0) {
              await upsertException({
                code: "NEGATIVE_STOCK", title: `Negative stock: ${s.sku}`,
                description: `SKU ${s.sku} has on-hand qty of ${s.on_hand}`,
                severity: "critical", source_module: "inventory",
                source_entity_type: "product", source_entity_id: s.product_id,
                metadata: { sku: s.sku, on_hand: s.on_hand },
              });
            }
          }
          results.push(`NEGATIVE_STOCK: checked ${stocks.length} SKUs`);
        }
      }

      // C4: ACCOUNT_MAPPING_MISSING
      if (activeRuleCodes.has("ACCOUNT_MAPPING_MISSING")) {
        const requiredKeys = ["inventory", "cogs", "product_sales", "shipping_income", "courier_receivable", "cash", "bank", "supplier_payable"];
        const { data: mappings } = await supabase.from("account_mappings").select("mapping_key, account_id");
        if (mappings) {
          for (const key of requiredKeys) {
            const m = (mappings as any[]).find((m) => m.mapping_key === key);
            if (!m || !m.account_id) {
              await upsertException({
                code: "ACCOUNT_MAPPING_MISSING", title: `Missing account mapping: ${key}`,
                description: `Required account mapping '${key}' is not configured or has no account assigned.`,
                severity: "high", source_module: "accounting",
                source_entity_type: "account_mapping", source_entity_id: key,
              });
            }
          }
          results.push(`ACCOUNT_MAPPING_MISSING: checked ${requiredKeys.length} keys`);
        }
      }

      // C4: UNBALANCED_JOURNAL
      if (activeRuleCodes.has("UNBALANCED_JOURNAL")) {
        const { data: journals } = await supabase
          .from("journal_entries")
          .select("id, description, entry_date")
          .eq("status", "posted")
          .limit(500);
        if (journals) {
          for (const j of journals as any[]) {
            const { data: lines } = await supabase
              .from("journal_lines")
              .select("debit, credit")
              .eq("journal_id", j.id);
            if (lines) {
              const totalDebit = (lines as any[]).reduce((s, l) => s + (l.debit || 0), 0);
              const totalCredit = (lines as any[]).reduce((s, l) => s + (l.credit || 0), 0);
              if (Math.abs(totalDebit - totalCredit) > 0.01) {
                await upsertException({
                  code: "UNBALANCED_JOURNAL", title: `Unbalanced journal: ${j.id.slice(0, 8)}`,
                  description: `Posted journal has debit=${totalDebit} credit=${totalCredit}`,
                  severity: "critical", source_module: "accounting",
                  source_entity_type: "journal", source_entity_id: j.id,
                  metadata: { debit: totalDebit, credit: totalCredit, diff: totalDebit - totalCredit },
                });
              }
            }
          }
          results.push(`UNBALANCED_JOURNAL: checked ${journals.length} journals`);
        }
      }

      // C2: COURIER_COST_MISSING
      if (activeRuleCodes.has("COURIER_COST_MISSING")) {
        const { data: shipments } = await supabase
          .from("courier_shipments")
          .select("id, order_id, tracking_id, booking_status, courier_total_cost")
          .in("booking_status", ["in_transit", "delivered"]);
        if (shipments) {
          for (const s of shipments as any[]) {
            if (!s.courier_total_cost || s.courier_total_cost <= 0) {
              await upsertException({
                code: "COURIER_COST_MISSING", title: `Courier cost missing: ${s.tracking_id || s.order_id}`,
                description: `Shipment ${s.id.slice(0, 8)} is ${s.booking_status} but has no courier cost`,
                severity: "high", source_module: "courier",
                source_entity_type: "shipment", source_entity_id: s.id,
              });
            }
          }
          results.push(`COURIER_COST_MISSING: checked ${shipments.length} shipments`);
        }
      }

      // C5: GRN_NOT_POSTED
      if (activeRuleCodes.has("GRN_NOT_POSTED")) {
        const { data: grns } = await supabase
          .from("goods_receipts")
          .select("id, grn_number, receipt_date, status")
          .eq("status", "draft");
        if (grns) {
          const threshold = 7;
          const now = new Date();
          for (const g of grns as any[]) {
            const daysSince = Math.floor((now.getTime() - new Date(g.receipt_date).getTime()) / 86400000);
            if (daysSince > threshold) {
              await upsertException({
                code: "GRN_NOT_POSTED", title: `GRN not posted: ${g.grn_number}`,
                description: `GRN ${g.grn_number} has been draft for ${daysSince} days`,
                severity: "medium", source_module: "purchasing",
                source_entity_type: "grn", source_entity_id: g.id,
                metadata: { days_since: daysSince },
              });
            }
          }
          results.push(`GRN_NOT_POSTED: checked ${grns.length} GRNs`);
        }
      }

      // C5: LANDED_COST_NOT_ALLOCATED
      if (activeRuleCodes.has("LANDED_COST_NOT_ALLOCATED")) {
        const { data: lc } = await supabase
          .from("landed_costs")
          .select("id, import_shipment_id, amount, status")
          .eq("status", "posted");
        if (lc) {
          for (const c of lc as any[]) {
            const { data: allocs } = await supabase
              .from("landed_cost_allocations")
              .select("id")
              .eq("import_shipment_id", c.import_shipment_id)
              .eq("status", "posted")
              .limit(1);
            if (!allocs || allocs.length === 0) {
              await upsertException({
                code: "LANDED_COST_NOT_ALLOCATED", title: `Landed cost not allocated`,
                description: `Landed cost ${c.id.slice(0, 8)} for shipment ${c.import_shipment_id} is posted but not allocated to SKUs`,
                severity: "high", source_module: "purchasing",
                source_entity_type: "landed_cost", source_entity_id: c.id,
              });
            }
          }
          results.push(`LANDED_COST_NOT_ALLOCATED: checked ${lc.length} costs`);
        }
      }

      // Auto-resolve: check if previously open exceptions are now fixed
      const { data: openExceptions } = await supabase
        .from("exceptions")
        .select("id, code, source_entity_id")
        .in("status", ["open", "in_progress"])
        .eq("code", "NEGATIVE_STOCK");
      if (openExceptions) {
        for (const ex of openExceptions as any[]) {
          const { data: stock } = await supabase
            .from("v_stock_on_hand")
            .select("on_hand")
            .eq("product_id", ex.source_entity_id)
            .limit(1);
          if (stock && stock.length > 0 && (stock[0] as any).on_hand >= 0) {
            await supabase.from("exceptions").update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: "system", resolution_notes: "Auto-resolved: stock is now >= 0", updated_at: new Date().toISOString() }).eq("id", ex.id);
            await supabase.from("exception_events").insert({ exception_id: ex.id, event_type: "resolved", message: "Auto-resolved by system check", actor: "system" });
          }
        }
      }

      // Update last_run_at for all active rules
      for (const rule of rules as any[]) {
        await supabase.from("exception_rules").update({ last_run_at: new Date().toISOString(), last_run_result: "completed", updated_at: new Date().toISOString() }).eq("id", rule.id);
      }

      return results;
    },
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: ["exceptions"] });
      qc.invalidateQueries({ queryKey: ["exception-stats"] });
      qc.invalidateQueries({ queryKey: ["exception-rules"] });
      qc.invalidateQueries({ queryKey: ["all-exception-events"] });
      toast({ title: "Checks completed", description: `Ran ${results?.length || 0} checks` });
    },
    onError: (e: any) => toast({ title: "Check failed", description: e.message, variant: "destructive" }),
  });
}
