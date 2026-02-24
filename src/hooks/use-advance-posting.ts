import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Post advance payment as GL journal:
 *   Dr selected payment account = advance_amount
 *   Cr Customer Advance Liability = advance_amount
 */
export function usePostAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      advanceAmount,
      advanceMethod,
    }: {
      orderId: string;
      advanceAmount: number;
      advanceMethod: string;
    }) => {
      // 1. Get account mappings
      const methodKey = `advance_${advanceMethod.toLowerCase()}`;
      const { data: mappings, error: mapErr } = await supabase
        .from("account_mappings")
        .select("mapping_key, account_id")
        .in("mapping_key", [methodKey, "customer_advance_liability"]);
      if (mapErr) throw mapErr;

      const payAcct = mappings?.find((m) => m.mapping_key === methodKey)?.account_id;
      const liabAcct = mappings?.find((m) => m.mapping_key === "customer_advance_liability")?.account_id;

      if (!payAcct) throw new Error(`Account mapping "${methodKey}" not configured. Go to Accounting → Account Mappings.`);
      if (!liabAcct) throw new Error(`Account mapping "customer_advance_liability" not configured. Go to Accounting → Account Mappings.`);

      // 2. Create journal
      const { data: je, error: jeErr } = await supabase
        .from("journal_entries")
        .insert({
          entry_date: new Date().toISOString().slice(0, 10),
          description: `Advance payment: ${advanceMethod} for order ${orderId.slice(0, 8)}`,
          reference_type: "advance",
          reference_id: orderId,
          status: "posted",
          is_auto: true,
        })
        .select("id")
        .single();
      if (jeErr) throw jeErr;

      // 3. Insert journal lines
      const { error: lineErr } = await supabase.from("journal_lines").insert([
        { journal_id: je.id, account_id: payAcct, debit: advanceAmount, credit: 0, description: `${advanceMethod} advance received` },
        { journal_id: je.id, account_id: liabAcct, debit: 0, credit: advanceAmount, description: "Customer advance liability" },
      ]);
      if (lineErr) throw lineErr;

      // 4. Update order
      const { error: updErr } = await supabase
        .from("orders")
        .update({
          advance_amount: advanceAmount,
          advance_method: advanceMethod,
          advance_posted: true,
          advance_journal_id: je.id,
        })
        .eq("id", orderId);
      if (updErr) throw updErr;

      // 5. Audit log
      await supabase.from("audit_logs").insert({
        entity_type: "order",
        entity_id: orderId,
        action: "advance_posted",
        after_json: { advanceAmount, advanceMethod, journal_id: je.id },
      });

      return je.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legacy-orders"] });
      qc.invalidateQueries({ queryKey: ["legacy-order-detail"] });
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: "Advance posted to GL" });
    },
    onError: (e: any) => toast({ title: "Error posting advance", description: e.message, variant: "destructive" }),
  });
}

/**
 * Reverse an existing advance journal and optionally repost with new values
 */
export function useReverseAndRepostAdvance() {
  const qc = useQueryClient();
  const postAdvance = usePostAdvance();

  return useMutation({
    mutationFn: async ({
      orderId,
      currentJournalId,
      reason,
      newAmount,
      newMethod,
    }: {
      orderId: string;
      currentJournalId: string;
      reason: string;
      newAmount?: number;
      newMethod?: string;
    }) => {
      // 1. Reverse existing journal
      const { data: reversalId, error: revErr } = await supabase.rpc("reverse_journal_entry", {
        p_journal_id: currentJournalId,
        p_reason: `Advance reversal: ${reason}`,
      });
      if (revErr) throw revErr;

      // 2. Clear advance on order
      const { error: clrErr } = await supabase
        .from("orders")
        .update({ advance_posted: false, advance_journal_id: null })
        .eq("id", orderId);
      if (clrErr) throw clrErr;

      // 3. Audit
      await supabase.from("audit_logs").insert({
        entity_type: "order",
        entity_id: orderId,
        action: "advance_reversed",
        after_json: { reversalId, reason },
      });

      // 4. Repost if new values provided
      if (newAmount && newAmount > 0 && newMethod) {
        await postAdvance.mutateAsync({ orderId, advanceAmount: newAmount, advanceMethod: newMethod });
      }

      return reversalId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legacy-orders"] });
      qc.invalidateQueries({ queryKey: ["legacy-order-detail"] });
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: "Advance reversed & reposted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

/**
 * Bulk post advances for multiple orders
 */
export function useBulkPostAdvance() {
  const qc = useQueryClient();
  const postAdvance = usePostAdvance();

  return useMutation({
    mutationFn: async (orders: Array<{ id: string; advance_amount: number; advance_method: string }>) => {
      const results: Array<{ id: string; success: boolean; error?: string }> = [];
      for (const o of orders) {
        try {
          await postAdvance.mutateAsync({ orderId: o.id, advanceAmount: o.advance_amount, advanceMethod: o.advance_method });
          results.push({ id: o.id, success: true });
        } catch (e: any) {
          results.push({ id: o.id, success: false, error: e.message });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const ok = results.filter((r) => r.success).length;
      const fail = results.filter((r) => !r.success).length;
      qc.invalidateQueries({ queryKey: ["legacy-orders"] });
      toast({ title: `Bulk advance: ${ok} posted${fail ? `, ${fail} failed` : ""}` });
    },
  });
}
