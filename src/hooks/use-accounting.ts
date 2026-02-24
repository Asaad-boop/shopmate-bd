import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

// ── Chart of Accounts ──
export function useChartOfAccounts() {
  return useQuery({
    queryKey: ["chart-of-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .order("code");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (acct: {
      code: string; name: string; account_type: string;
      parent_id?: string | null; description?: string; normal_balance?: string;
    }) => {
      const { error } = await supabase.from("chart_of_accounts").insert(acct);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast({ title: "Account created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useToggleAccountActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("chart_of_accounts").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chart-of-accounts"] });
    },
  });
}

// ── Journal Entries ──
export function useJournalEntries(filters: { dateFrom?: string; dateTo?: string; status?: string; page: number; pageSize: number }) {
  return useQuery({
    queryKey: ["journal-entries", filters],
    queryFn: async () => {
      let query = supabase.from("journal_entries").select("*", { count: "exact" });
      if (filters.dateFrom) query = query.gte("entry_date", filters.dateFrom);
      if (filters.dateTo) query = query.lte("entry_date", filters.dateTo);
      if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
      const from = filters.page * filters.pageSize;
      const to = from + filters.pageSize - 1;
      query = query.order("entry_number", { ascending: false }).range(from, to);
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });
}

export function useJournalLines(journalId: string | null) {
  return useQuery({
    queryKey: ["journal-lines", journalId],
    enabled: !!journalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_lines")
        .select("*, chart_of_accounts(code, name)")
        .eq("journal_id", journalId!)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      entry_date: string; description: string;
      lines: { account_id: string; debit: number; credit: number; description?: string }[];
      post?: boolean;
    }) => {
      // Validate balance
      const totalDr = payload.lines.reduce((s, l) => s + l.debit, 0);
      const totalCr = payload.lines.reduce((s, l) => s + l.credit, 0);
      if (Math.abs(totalDr - totalCr) > 0.01) throw new Error(`Imbalanced: Dr ${totalDr} ≠ Cr ${totalCr}`);

      const { data: je, error: jeErr } = await supabase
        .from("journal_entries")
        .insert({ entry_date: payload.entry_date, description: payload.description, status: "draft" })
        .select("id")
        .single();
      if (jeErr) throw jeErr;

      const lines = payload.lines.map((l) => ({ ...l, journal_id: je.id }));
      const { error: lineErr } = await supabase.from("journal_lines").insert(lines);
      if (lineErr) throw lineErr;

      if (payload.post) {
        const { error: postErr } = await supabase
          .from("journal_entries")
          .update({ status: "posted" })
          .eq("id", je.id);
        if (postErr) throw postErr;
      }
      return je.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: "Journal entry created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function usePostJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journal_entries").update({ status: "posted" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: "Journal posted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useReverseJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc("reverse_journal_entry", {
        p_journal_id: id,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: "Journal reversed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ── Trial Balance ──
export function useTrialBalance(asOfDate?: string) {
  return useQuery({
    queryKey: ["trial-balance", asOfDate],
    queryFn: async () => {
      const dateFmt = asOfDate || format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("journal_lines")
        .select("account_id, debit, credit, journal_entries!inner(status, entry_date)")
        .eq("journal_entries.status", "posted")
        .lte("journal_entries.entry_date", dateFmt);
      if (error) throw error;

      const { data: accounts } = await supabase.from("chart_of_accounts").select("*").order("code");

      const balances: Record<string, { debit: number; credit: number }> = {};
      (data || []).forEach((line: any) => {
        if (!balances[line.account_id]) balances[line.account_id] = { debit: 0, credit: 0 };
        balances[line.account_id].debit += Number(line.debit || 0);
        balances[line.account_id].credit += Number(line.credit || 0);
      });

      return (accounts || [])
        .filter((a) => balances[a.id])
        .map((a) => ({
          ...a,
          total_debit: balances[a.id].debit,
          total_credit: balances[a.id].credit,
          balance: balances[a.id].debit - balances[a.id].credit,
        }));
    },
  });
}

// ── General Ledger ──
export function useGeneralLedger(accountId: string | null, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ["general-ledger", accountId, dateFrom, dateTo],
    enabled: !!accountId,
    queryFn: async () => {
      let query = supabase
        .from("journal_lines")
        .select("*, journal_entries!inner(entry_number, entry_date, description, status)")
        .eq("account_id", accountId!)
        .eq("journal_entries.status", "posted")
        .order("journal_entries(entry_date)", { ascending: true });

      if (dateFrom) query = query.gte("journal_entries.entry_date", dateFrom);
      if (dateTo) query = query.lte("journal_entries.entry_date", dateTo);

      const { data, error } = await query;
      if (error) throw error;

      let running = 0;
      return (data || []).map((line: any) => {
        running += Number(line.debit || 0) - Number(line.credit || 0);
        return { ...line, running_balance: running };
      });
    },
  });
}

// ── Period Locks ──
export function usePeriodLocks() {
  return useQuery({
    queryKey: ["period-locks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounting_period_locks").select("*").order("period_end", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useLockPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (period_end: string) => {
      const { error } = await supabase.from("accounting_period_locks").insert({ period_end });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period-locks"] });
      toast({ title: "Period locked" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}
