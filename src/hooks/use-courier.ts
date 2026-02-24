import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ── Couriers ──
export function useCouriers() {
  return useQuery({
    queryKey: ["couriers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("couriers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddCourier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("couriers").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["couriers"] });
      toast({ title: "Courier added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useToggleCourier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("couriers").update({ is_active, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["couriers"] });
    },
  });
}

// ── Courier Shipments ──
export function useCourierShipments(filters: {
  status?: string;
  courierId?: string;
  page: number;
  pageSize: number;
}) {
  return useQuery({
    queryKey: ["courier-shipments", filters],
    queryFn: async () => {
      let query = supabase
        .from("courier_shipments")
        .select("*, couriers(name)", { count: "exact" });
      if (filters.status && filters.status !== "all")
        query = query.eq("booking_status", filters.status);
      if (filters.courierId && filters.courierId !== "all")
        query = query.eq("courier_id", filters.courierId);
      const from = filters.page * filters.pageSize;
      query = query.order("created_at", { ascending: false }).range(from, from + filters.pageSize - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });
}

export function useUpdateShipmentCosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      courier_delivery_fee: number;
      courier_cod_fee: number;
      courier_discount: number;
      customer_total_amount: number;
      source?: string;
    }) => {
      const total_cost = payload.courier_delivery_fee + payload.courier_cod_fee - payload.courier_discount;
      const net_payable = payload.customer_total_amount - total_cost;

      const { error } = await supabase
        .from("courier_shipments")
        .update({
          courier_delivery_fee: payload.courier_delivery_fee,
          courier_cod_fee: payload.courier_cod_fee,
          courier_discount: payload.courier_discount,
          courier_total_cost: total_cost,
          courier_net_payable: net_payable,
          last_cost_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.id);
      if (error) throw error;

      // Audit cost event
      await supabase.from("courier_cost_events").insert({
        shipment_id: payload.id,
        event_type: "in_transit_cost_set",
        delivery_fee: payload.courier_delivery_fee,
        cod_fee: payload.courier_cod_fee,
        discount: payload.courier_discount,
        total_cost,
        source: payload.source || "manual",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courier-shipments"] });
      toast({ title: "Costs updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ── Courier Statements ──
export function useCourierStatements() {
  return useQuery({
    queryKey: ["courier-statements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courier_statements")
        .select("*, couriers(name)")
        .order("imported_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useStatementLines(statementId: string | null) {
  return useQuery({
    queryKey: ["courier-statement-lines", statementId],
    enabled: !!statementId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courier_statement_lines")
        .select("*")
        .eq("statement_id", statementId!)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useImportStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      courier_id: string;
      statement_date_from: string;
      statement_date_to: string;
      statement_ref: string;
      lines: any[];
    }) => {
      // Create statement header
      const { data: stmt, error: stmtErr } = await supabase
        .from("courier_statements")
        .insert({
          courier_id: payload.courier_id,
          statement_date_from: payload.statement_date_from,
          statement_date_to: payload.statement_date_to,
          statement_ref: payload.statement_ref,
        })
        .select("id")
        .single();
      if (stmtErr) throw stmtErr;

      // Insert lines
      const linesToInsert = payload.lines.map((l) => ({
        statement_id: stmt.id,
        tracking_id: l.tracking_id || null,
        order_id: l.order_id || null,
        delivery_status: l.delivery_status || null,
        customer_total_amount: l.customer_total_amount || null,
        delivery_fee: l.delivery_fee || null,
        cod_fee: l.cod_fee || null,
        discount: l.discount || null,
        total_cost: l.total_cost || null,
        net_payable: l.net_payable || null,
        return_cost: l.return_cost || null,
        payout_amount: l.payout_amount || null,
        raw_json: l,
      }));
      const { error: lineErr } = await supabase.from("courier_statement_lines").insert(linesToInsert);
      if (lineErr) throw lineErr;

      // Auto-match by tracking_id
      let matched = 0, unmatched = 0, mismatched = 0;
      for (const line of linesToInsert) {
        if (!line.tracking_id) { unmatched++; continue; }
        const { data: shipment } = await supabase
          .from("courier_shipments")
          .select("id, courier_total_cost, customer_total_amount")
          .eq("tracking_id", line.tracking_id)
          .maybeSingle();

        if (!shipment) {
          await supabase.from("courier_statement_lines")
            .update({ match_status: "unmatched" })
            .eq("statement_id", stmt.id)
            .eq("tracking_id", line.tracking_id);
          // Create exception
          await supabase.from("reconciliation_exceptions").insert({
            type: "unknown_tracking",
            courier_id: payload.courier_id,
            severity: "medium",
            message: `Unknown tracking: ${line.tracking_id}`,
            status: "open",
          });
          unmatched++;
          continue;
        }

        // Check for mismatches
        const costDiff = Math.abs((line.total_cost || 0) - (shipment.courier_total_cost || 0));
        if (costDiff > 0.01) {
          await supabase.from("courier_statement_lines")
            .update({
              match_status: "mismatch",
              mismatch_reason: `Cost diff: system=${shipment.courier_total_cost}, statement=${line.total_cost}`,
            })
            .eq("statement_id", stmt.id)
            .eq("tracking_id", line.tracking_id);
          await supabase.from("reconciliation_exceptions").insert({
            type: "cost_mismatch",
            courier_id: payload.courier_id,
            shipment_id: shipment.id,
            severity: costDiff > 50 ? "high" : "medium",
            message: `Cost mismatch for ${line.tracking_id}: system ৳${shipment.courier_total_cost}, statement ৳${line.total_cost}`,
            status: "open",
          });
          mismatched++;
        } else {
          await supabase.from("courier_statement_lines")
            .update({ match_status: "matched" })
            .eq("statement_id", stmt.id)
            .eq("tracking_id", line.tracking_id);
          matched++;
        }

        // Update shipment costs from statement if missing
        if (!shipment.courier_total_cost && line.total_cost) {
          await supabase.from("courier_shipments").update({
            courier_delivery_fee: line.delivery_fee || 0,
            courier_cod_fee: line.cod_fee || 0,
            courier_discount: line.discount || 0,
            courier_total_cost: line.total_cost || 0,
            courier_net_payable: (line.customer_total_amount || shipment.customer_total_amount || 0) - (line.total_cost || 0),
            last_cost_updated_at: new Date().toISOString(),
          }).eq("id", shipment.id);

          await supabase.from("courier_cost_events").insert({
            shipment_id: shipment.id,
            event_type: "in_transit_cost_set",
            delivery_fee: line.delivery_fee || 0,
            cod_fee: line.cod_fee || 0,
            discount: line.discount || 0,
            total_cost: line.total_cost || 0,
            source: "statement_import",
          });
        }
      }

      // Update statement status
      const finalStatus = unmatched === 0 && mismatched === 0 ? "matched"
        : matched === 0 ? "imported" : "partially_matched";
      await supabase.from("courier_statements").update({ status: finalStatus }).eq("id", stmt.id);

      return { matched, unmatched, mismatched, statementId: stmt.id };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["courier-statements"] });
      qc.invalidateQueries({ queryKey: ["courier-shipments"] });
      qc.invalidateQueries({ queryKey: ["reconciliation-exceptions"] });
      toast({
        title: "Statement imported",
        description: `Matched: ${result.matched}, Unmatched: ${result.unmatched}, Mismatch: ${result.mismatched}`,
      });
    },
    onError: (e: any) => toast({ title: "Import error", description: e.message, variant: "destructive" }),
  });
}

// ── Reconciliation Exceptions ──
export function useReconciliationExceptions(filters?: { type?: string; severity?: string; status?: string; courierId?: string }) {
  return useQuery({
    queryKey: ["reconciliation-exceptions", filters],
    queryFn: async () => {
      let query = supabase.from("reconciliation_exceptions").select("*, couriers(name)").order("created_at", { ascending: false });
      if (filters?.type && filters.type !== "all") query = query.eq("type", filters.type);
      if (filters?.severity && filters.severity !== "all") query = query.eq("severity", filters.severity);
      if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);
      if (filters?.courierId && filters.courierId !== "all") query = query.eq("courier_id", filters.courierId);
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useResolveException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase.from("reconciliation_exceptions").update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolve_note: note,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconciliation-exceptions"] });
      toast({ title: "Exception resolved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ── Settlements ──
export function useCourierSettlements() {
  return useQuery({
    queryKey: ["courier-settlements-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courier_settlements_v2")
        .select("*, couriers(name)")
        .order("settlement_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useOutstandingShipments(courierId?: string) {
  return useQuery({
    queryKey: ["outstanding-shipments", courierId],
    enabled: !!courierId,
    queryFn: async () => {
      // Get delivered shipments with remaining receivable
      const { data: shipments, error } = await supabase
        .from("courier_shipments")
        .select("*")
        .eq("courier_id", courierId!)
        .eq("booking_status", "delivered")
        .gt("courier_net_payable", 0)
        .order("delivered_at", { ascending: true });
      if (error) throw error;

      // Get already allocated amounts
      const shipmentIds = (shipments || []).map((s) => s.id);
      if (shipmentIds.length === 0) return [];

      const { data: allocs } = await supabase
        .from("courier_settlement_allocations")
        .select("shipment_id, allocated_amount")
        .in("shipment_id", shipmentIds);

      const allocMap: Record<string, number> = {};
      (allocs || []).forEach((a) => {
        allocMap[a.shipment_id] = (allocMap[a.shipment_id] || 0) + Number(a.allocated_amount);
      });

      return (shipments || []).map((s) => ({
        ...s,
        already_allocated: allocMap[s.id] || 0,
        remaining: Number(s.courier_net_payable) - (allocMap[s.id] || 0),
      })).filter((s) => s.remaining > 0.01);
    },
  });
}

export function useCreateSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      courier_id: string;
      settlement_date: string;
      settlement_ref: string;
      received_account: string;
      amount_received: number;
      notes: string;
      allocations: { shipment_id: string; allocated_amount: number }[];
    }) => {
      // Post GL entry: Dr Bank/Cash, Cr Courier Receivable
      const { data: jeData, error: jeErr } = await supabase
        .from("journal_entries")
        .insert({
          entry_date: payload.settlement_date,
          description: `Courier settlement: ${payload.settlement_ref || 'N/A'}`,
          reference_type: "courier",
          status: "posted",
          is_auto: true,
        })
        .select("id")
        .single();

      let journalId: string | null = null;
      if (!jeErr && jeData) {
        journalId = jeData.id;
        // Get account mappings
        const { data: mappings } = await supabase
          .from("account_mappings")
          .select("mapping_key, account_id")
          .in("mapping_key", [payload.received_account, "courier_receivable"]);

        const acctMap: Record<string, string> = {};
        (mappings || []).forEach((m) => { if (m.account_id) acctMap[m.mapping_key] = m.account_id; });

        if (acctMap[payload.received_account] && acctMap["courier_receivable"]) {
          await supabase.from("journal_lines").insert([
            { journal_id: journalId, account_id: acctMap[payload.received_account], debit: payload.amount_received, credit: 0, description: "Settlement received" },
            { journal_id: journalId, account_id: acctMap["courier_receivable"], debit: 0, credit: payload.amount_received, description: "Courier receivable cleared" },
          ]);
        }
      }

      // Create settlement
      const { data: settlement, error: settErr } = await supabase
        .from("courier_settlements_v2")
        .insert({
          courier_id: payload.courier_id,
          settlement_date: payload.settlement_date,
          settlement_ref: payload.settlement_ref,
          received_account: payload.received_account,
          amount_received: payload.amount_received,
          notes: payload.notes,
          journal_id: journalId,
        })
        .select("id")
        .single();
      if (settErr) throw settErr;

      // Create allocations
      if (payload.allocations.length > 0) {
        const allocRows = payload.allocations.map((a) => ({
          settlement_id: settlement.id,
          shipment_id: a.shipment_id,
          allocated_amount: a.allocated_amount,
        }));
        await supabase.from("courier_settlement_allocations").insert(allocRows);
      }

      return settlement.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courier-settlements-v2"] });
      qc.invalidateQueries({ queryKey: ["outstanding-shipments"] });
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: "Settlement created & posted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ── Aging ──
export function useCourierAging() {
  return useQuery({
    queryKey: ["courier-aging"],
    queryFn: async () => {
      const { data: shipments, error } = await supabase
        .from("courier_shipments")
        .select("id, courier_id, courier_net_payable, delivered_at, couriers(name)")
        .eq("booking_status", "delivered")
        .gt("courier_net_payable", 0);
      if (error) throw error;

      // Get allocations
      const ids = (shipments || []).map((s) => s.id);
      const { data: allocs } = await supabase
        .from("courier_settlement_allocations")
        .select("shipment_id, allocated_amount")
        .in("shipment_id", ids.length > 0 ? ids : ["__none__"]);

      const allocMap: Record<string, number> = {};
      (allocs || []).forEach((a) => {
        allocMap[a.shipment_id] = (allocMap[a.shipment_id] || 0) + Number(a.allocated_amount);
      });

      const now = new Date();
      const buckets: Record<string, { courier: string; "0-7": number; "8-15": number; "16-30": number; "31-60": number; "60+": number; total: number }> = {};

      (shipments || []).forEach((s: any) => {
        const remaining = Number(s.courier_net_payable) - (allocMap[s.id] || 0);
        if (remaining <= 0.01) return;
        const days = Math.floor((now.getTime() - new Date(s.delivered_at || s.created_at).getTime()) / 86400000);
        const courierName = s.couriers?.name || "Unknown";
        if (!buckets[courierName]) buckets[courierName] = { courier: courierName, "0-7": 0, "8-15": 0, "16-30": 0, "31-60": 0, "60+": 0, total: 0 };
        const b = buckets[courierName];
        b.total += remaining;
        if (days <= 7) b["0-7"] += remaining;
        else if (days <= 15) b["8-15"] += remaining;
        else if (days <= 30) b["16-30"] += remaining;
        else if (days <= 60) b["31-60"] += remaining;
        else b["60+"] += remaining;
      });

      return Object.values(buckets);
    },
  });
}

// ── Courier Reports ──
export function useCourierReportStats() {
  return useQuery({
    queryKey: ["courier-report-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courier_shipments")
        .select("courier_id, booking_status, courier_total_cost, courier_cod_fee, courier_net_payable, courier_return_cost, couriers(name)");
      if (error) throw error;

      const stats: Record<string, {
        courier: string;
        delivered: number;
        returned: number;
        total_cost: number;
        total_cod_fee: number;
        total_net_payable: number;
        total_return_cost: number;
      }> = {};

      (data || []).forEach((s: any) => {
        const name = s.couriers?.name || "Unknown";
        if (!stats[name]) stats[name] = { courier: name, delivered: 0, returned: 0, total_cost: 0, total_cod_fee: 0, total_net_payable: 0, total_return_cost: 0 };
        const st = stats[name];
        if (s.booking_status === "delivered" || s.booking_status === "partial_delivered") {
          st.delivered++;
          st.total_net_payable += Number(s.courier_net_payable || 0);
        }
        if (s.booking_status === "returned") {
          st.returned++;
          st.total_return_cost += Number(s.courier_return_cost || 0);
        }
        st.total_cost += Number(s.courier_total_cost || 0);
        st.total_cod_fee += Number(s.courier_cod_fee || 0);
      });

      return Object.values(stats);
    },
  });
}
