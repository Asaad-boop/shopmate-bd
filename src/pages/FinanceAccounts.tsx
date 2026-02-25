import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Banknote, Building2, Smartphone, Wallet, ArrowUpRight, ArrowDownLeft,
  ArrowLeftRight, Settings2, BookOpen, RefreshCw, ArrowLeft, TrendingUp, TrendingDown,
} from "lucide-react";

/* ── types ───────────────────────────────────────── */
interface AccountBalance {
  id: string; code: string; name: string; account_type: string;
  balance: number; today_change: number; week_inflow: number; week_outflow: number;
}
interface TxnLine {
  id: string; entry_date: string; description: string; reference_type: string;
  reference_id: string; is_auto: boolean; debit: number; credit: number;
  line_description: string; created_at: string;
}

type ModalType = "deposit" | "withdraw" | "transfer" | "adjust" | null;

const ACCOUNT_ICONS: Record<string, any> = {
  "1100": Banknote, "1101": Building2, "1102": Smartphone, "1103": Wallet,
};
const ACCOUNT_ACCENT: Record<string, string> = {
  "1100": "bg-success/10 text-success border-success/20",
  "1101": "bg-info/10 text-info border-info/20",
  "1102": "bg-[hsl(330,70%,92%)] text-[hsl(330,70%,40%)] border-[hsl(330,70%,80%)]",
  "1103": "bg-warning/10 text-warning border-warning/20",
};

/* ── hooks ───────────────────────────────────────── */
function useAccountBalances() {
  return useQuery<AccountBalance[]>({
    queryKey: ["finance-account-balances"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_account_balances");
      if (error) throw error;
      return (data as unknown as AccountBalance[]) || [];
    },
    refetchInterval: 60_000,
  });
}

function useAccountTransactions(accountId: string | null) {
  return useQuery<TxnLine[]>({
    queryKey: ["finance-account-txns", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase.rpc("finance_account_transactions", {
        p_account_id: accountId, p_limit: 20,
      });
      if (error) throw error;
      return (data as unknown as TxnLine[]) || [];
    },
    enabled: !!accountId,
  });
}

/* ── page ────────────────────────────────────────── */
export default function FinanceAccountsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: accounts, isLoading } = useAccountBalances();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: txns, isLoading: txnLoading } = useAccountTransactions(selectedId);
  const [modal, setModal] = useState<ModalType>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [fromAcct, setFromAcct] = useState("");
  const [toAcct, setToAcct] = useState("");
  const [targetBalance, setTargetBalance] = useState("");

  const selectedAccount = accounts?.find((a) => a.id === selectedId);

  const resetForm = () => { setAmount(""); setNote(""); setFromAcct(""); setToAcct(""); setTargetBalance(""); };
  const openModal = (type: ModalType, acctId?: string) => {
    resetForm();
    if (acctId) setSelectedId(acctId);
    if (type === "transfer" && acctId) setFromAcct(acctId);
    setModal(type);
  };
  const closeModal = () => { setModal(null); resetForm(); };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["finance-account-balances"] });
    if (selectedId) qc.invalidateQueries({ queryKey: ["finance-account-txns", selectedId] });
  };

  /* ── mutations ─────────────────────────────────── */
  const depositMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("finance_deposit", {
        p_account_id: selectedId!, p_amount: parseFloat(amount), p_note: note,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deposit posted"); closeModal(); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const withdrawMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("finance_withdraw", {
        p_account_id: selectedId!, p_amount: parseFloat(amount), p_note: note,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Withdrawal posted"); closeModal(); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const transferMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("finance_transfer", {
        p_from_account_id: fromAcct, p_to_account_id: toAcct,
        p_amount: parseFloat(amount), p_note: note,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Transfer posted"); closeModal(); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const adjustMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("finance_adjust_opening", {
        p_account_id: selectedId!, p_new_balance: parseFloat(targetBalance), p_note: note,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Opening balance adjusted"); closeModal(); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const isSubmitting = depositMut.isPending || withdrawMut.isPending || transferMut.isPending || adjustMut.isPending;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-20">
        <div className="flex items-center justify-between px-6 h-14 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => nav("/finance")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Account Balances & Transfers</h1>
              <p className="text-[11px] text-muted-foreground -mt-0.5">All balances computed from posted journal entries</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => openModal("transfer")}>
              <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={refresh}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Account cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-[200px] rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {accounts?.map((acct) => {
              const Icon = ACCOUNT_ICONS[acct.code] || Wallet;
              const accent = ACCOUNT_ACCENT[acct.code] || "bg-muted text-muted-foreground";
              const isSelected = selectedId === acct.id;
              return (
                <div
                  key={acct.id}
                  onClick={() => setSelectedId(isSelected ? null : acct.id)}
                  className={cn(
                    "bg-card border rounded-xl p-5 cursor-pointer transition-all hover:shadow-md",
                    isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/30"
                  )}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn("p-2 rounded-lg", accent)}><Icon className="w-5 h-5" /></div>
                    <Badge variant="secondary" className="text-[10px]">{acct.code}</Badge>
                  </div>
                  {/* Name + Balance */}
                  <p className="text-sm font-medium text-muted-foreground">{acct.name}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{formatBDT(acct.balance)}</p>
                  {/* Today change */}
                  <div className="flex items-center gap-1 mt-2">
                    {acct.today_change >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-success" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-destructive" />
                    )}
                    <span className={cn("text-xs font-medium", acct.today_change >= 0 ? "text-success" : "text-destructive")}>
                      {acct.today_change >= 0 ? "+" : ""}{formatBDT(acct.today_change)} today
                    </span>
                  </div>
                  {/* 7-day */}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span>7d in: <strong className="text-success">{formatBDT(acct.week_inflow)}</strong></span>
                    <span>out: <strong className="text-destructive">{formatBDT(acct.week_outflow)}</strong></span>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={(e) => { e.stopPropagation(); openModal("deposit", acct.id); }}>
                      <ArrowDownLeft className="w-3 h-3 mr-1 text-success" /> Deposit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={(e) => { e.stopPropagation(); openModal("withdraw", acct.id); }}>
                      <ArrowUpRight className="w-3 h-3 mr-1 text-destructive" /> Withdraw
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={(e) => { e.stopPropagation(); openModal("adjust", acct.id); }}>
                      <Settings2 className="w-3 h-3 mr-1" /> Adjust
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 ml-auto" onClick={(e) => { e.stopPropagation(); nav(`/accounting?account_id=${acct.id}`); }}>
                      <BookOpen className="w-3 h-3 mr-1" /> Ledger
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Transactions panel */}
        {selectedId && (
          <section className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                Recent Transactions — {selectedAccount?.name}
              </h2>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => nav(`/accounting?account_id=${selectedId}`)}>
                View Full Ledger →
              </Button>
            </div>
            {txnLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !txns?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No posted transactions yet</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs text-right">Debit</TableHead>
                      <TableHead className="text-xs text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txns.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(t.entry_date)}</TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate">{t.line_description || t.description}</TableCell>
                        <TableCell>
                          <Badge variant={t.is_auto ? "secondary" : "outline"} className="text-[10px]">
                            {t.reference_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">{t.debit > 0 ? formatBDT(t.debit) : "—"}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{t.credit > 0 ? formatBDT(t.credit) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Deposit Modal ──────────────────────── */}
      <Dialog open={modal === "deposit"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deposit (Capital / Owner Funding)</DialogTitle>
            <DialogDescription>Creates a journal: Dr {selectedAccount?.name}, Cr Owner Equity</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount (৳)</Label><Input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
            <div><Label>Note / Reason *</Label><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Owner capital injection" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={() => depositMut.mutate()} disabled={!amount || !note || isSubmitting}>Post Deposit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Withdraw Modal ─────────────────────── */}
      <Dialog open={modal === "withdraw"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw (Owner Drawing)</DialogTitle>
            <DialogDescription>Creates a journal: Dr Owner Drawing, Cr {selectedAccount?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount (৳)</Label><Input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
            <div><Label>Note / Reason *</Label><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Owner withdrawal" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button variant="destructive" onClick={() => withdrawMut.mutate()} disabled={!amount || !note || isSubmitting}>Post Withdrawal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Transfer Modal ─────────────────────── */}
      <Dialog open={modal === "transfer"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Between Accounts</DialogTitle>
            <DialogDescription>Creates a balanced journal entry moving funds between accounts</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>From Account</Label>
              <Select value={fromAcct} onValueChange={setFromAcct}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>{accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({formatBDT(a.balance)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>To Account</Label>
              <Select value={toAcct} onValueChange={setToAcct}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>{accounts?.filter(a => a.id !== fromAcct).map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({formatBDT(a.balance)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Amount (৳)</Label><Input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
            <div><Label>Note / Reason *</Label><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Moving funds for bKash payout" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={() => transferMut.mutate()} disabled={!fromAcct || !toAcct || !amount || !note || isSubmitting}>Post Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Adjust Opening Balance Modal ────────── */}
      <Dialog open={modal === "adjust"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Opening Balance (Admin Only)</DialogTitle>
            <DialogDescription>
              Current: {formatBDT(selectedAccount?.balance ?? 0)} — Creates an adjustment journal against Owner Equity
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>New Target Balance (৳)</Label><Input type="number" value={targetBalance} onChange={e => setTargetBalance(e.target.value)} placeholder="0" /></div>
            <div><Label>Reason *</Label><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Opening balance correction for Jan 2026" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button variant="destructive" onClick={() => adjustMut.mutate()} disabled={!targetBalance || !note || isSubmitting}>Post Adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
