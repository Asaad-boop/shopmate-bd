import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Post settlement for a delivered legacy order:
 *   Dr Bank/Cash           = net_payable (what courier pays us)
 *   Dr Courier Expense     = courier_total_cost
 *   Cr Courier Receivable  = customer_total (collectable amount)
 */
export function usePostSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      customerTotal,
      courierTotalCost,
      netPayable,
      receivingAccount = "bank",
    }: {
      orderId: string;
      customerTotal: number;
      courierTotalCost: number;
      netPayable: number;
      receivingAccount?: string;
    }) => {
      // Check not already posted
      const { data: existing } = await supabase
        .from("orders")
        .select("settlement_posted")
        .eq("id", orderId)
        .single();
      if (existing?.settlement_posted) throw new Error("Settlement already posted");

      // Get account mappings
      const { data: mappings, error: mapErr } = await supabase
        .from("account_mappings")
        .select("mapping_key, account_id")
        .in("mapping_key", [receivingAccount, "courier_receivable", "courier_expense"]);
      if (mapErr) throw mapErr;

      const bankAcct = mappings?.find((m) => m.mapping_key === receivingAccount)?.account_id;
      const courierRecvAcct = mappings?.find((m) => m.mapping_key === "courier_receivable")?.account_id;
      const courierExpAcct = mappings?.find((m) => m.mapping_key === "courier_expense")?.account_id;

      if (!bankAcct) throw new Error(`Account mapping "${receivingAccount}" not configured`);
      if (!courierRecvAcct) throw new Error(`Account mapping "courier_receivable" not configured`);

      // Create journal
      const { data: je, error: jeErr } = await supabase
        .from("journal_entries")
        .insert({
          entry_date: new Date().toISOString().slice(0, 10),
          description: `COD Settlement: order ${orderId.slice(0, 8)}`,
          reference_type: "settlement",
          reference_id: orderId,
          status: "posted",
          is_auto: true,
        })
        .select("id")
        .single();
      if (jeErr) throw jeErr;

      // Journal lines
      const lines: any[] = [
        { journal_id: je.id, account_id: bankAcct, debit: netPayable, credit: 0, description: "Cash/Bank received from courier" },
        { journal_id: je.id, account_id: courierRecvAcct, debit: 0, credit: customerTotal, description: "Courier receivable cleared" },
      ];

      if (courierTotalCost > 0 && courierExpAcct) {
        lines.push({ journal_id: je.id, account_id: courierExpAcct, debit: courierTotalCost, credit: 0, description: "Courier expense" });
      }

      const { error: lineErr } = await supabase.from("journal_lines").insert(lines);
      if (lineErr) throw lineErr;

      // Mark order
      const { error: updErr } = await supabase
        .from("orders")
        .update({
          settlement_posted: true,
          settlement_posted_at: new Date().toISOString(),
          settlement_journal_id: je.id,
        })
        .eq("id", orderId);
      if (updErr) throw updErr;

      // Audit
      await supabase.from("audit_logs").insert({
        entity_type: "order",
        entity_id: orderId,
        action: "settlement_posted",
        after_json: { netPayable, courierTotalCost, customerTotal, journal_id: je.id },
      });

      return je.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legacy-orders"] });
      qc.invalidateQueries({ queryKey: ["legacy-stats"] });
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: "Settlement posted to GL ✅" });
    },
    onError: (e: any) => toast({ title: "Settlement error", description: e.message, variant: "destructive" }),
  });
}

export function useBulkPostSettlement() {
  const qc = useQueryClient();
  const postSettlement = usePostSettlement();

  return useMutation({
    mutationFn: async (orders: Array<{ id: string; customerTotal: number; courierTotalCost: number; netPayable: number }>) => {
      const results: Array<{ id: string; success: boolean; error?: string }> = [];
      for (const o of orders) {
        try {
          await postSettlement.mutateAsync({
            orderId: o.id,
            customerTotal: o.customerTotal,
            courierTotalCost: o.courierTotalCost,
            netPayable: o.netPayable,
          });
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
      qc.invalidateQueries({ queryKey: ["legacy-stats"] });
      toast({ title: `Settlement: ${ok} posted${fail ? `, ${fail} failed` : ""}` });
    },
  });
}
