import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Banknote, Building2, Smartphone, Wallet, ArrowUpRight, ArrowDownLeft,
  ArrowLeftRight, Settings2, RefreshCw, ArrowLeft, TrendingUp, TrendingDown,
  Download, Search, Clock, X, Plus,
} from "lucide-react";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

/* ── types ───────────────────────────────────────── */
interface AccountBalance {
  id: string; code: string; name: string; account_type: string;
  balance: number; today_inflow: number; today_outflow: number; today_change: number;
  week_inflow: number; week_outflow: number; week_net: number;
  last_txn_at: string | null;
}
interface TxnLine {
  id: string; entry_date: string; description: string; reference_type: string;
  reference_id: string; is_auto: boolean; debit: number; credit: number;
  line_description: string; created_at: string; running_balance: number;
}

type ModalType = "deposit" | "withdraw" | "transfer" | "adjust" | null;

const ACCOUNT_ICONS: Record<string, any> = {
  "1100": Banknote, "1101": Building2, "1102": Smartphone, "1103": Wallet,
};
const ACCOUNT_ACCENT: Record<string, string> = {
  "1100": "bg-success/10 text-success border-success/20",
  "1101": "bg-info/10 text-info border-info/20",
  "1102": "bg-accent/30 text-accent-foreground border-accent/50",
  "1103": "bg-warning/10 text-warning border-warning/20",
};

const REF_TYPES = [
  { value: "", label: "All Types" },
  { value: "order", label: "Order" },
  { value: "courier", label: "Settlement" },
  { value: "expense", label: "Expense" },
  { value: "purchase", label: "Purchase" },
  { value: "import", label: "Import" },
  { value: "transfer", label: "Transfer" },
  { value: "deposit", label: "Deposit" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "adjustment", label: "Adjustment" },
  { value: "manual", label: "Manual" },
];

const DEPOSIT_CATEGORIES = [
  { value: "capital", label: "Owner Capital" },
  { value: "correction", label: "Correction" },
  { value: "other", label: "Other" },
];

const WITHDRAW_CATEGORIES = [
  { value: "drawing", label: "Owner Drawing" },
  { value: "expense", label: "Expense" },
  { value: "other", label: "Other" },
];

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

function useAccountTransactions(
  accountId: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  refType: string | null,
  search: string | null,
) {
  return useQuery<TxnLine[]>({
    queryKey: ["finance-account-txns", accountId, dateFrom, dateTo, refType, search],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase.rpc("finance_account_transactions", {
        p_account_id: accountId,
        p_limit: 50,
        p_date_from: dateFrom || undefined,
        p_date_to: dateTo || undefined,
        p_reference_type: refType || undefined,
        p_search: search || undefined,
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

  // Drawer state
  const [drawerAcctId, setDrawerAcctId] = useState<string | null>(null);
  const [txnDateFrom, setTxnDateFrom] = useState<string>("");
  const [txnDateTo, setTxnDateTo] = useState<string>("");
  const [txnRefType, setTxnRefType] = useState<string>("");
  const [txnSearch, setTxnSearch] = useState<string>("");

  const { data: txns, isLoading: txnLoading } = useAccountTransactions(
    drawerAcctId,
    txnDateFrom || null,
    txnDateTo || null,
    txnRefType || null,
    txnSearch || null,
  );

  const drawerAccount = accounts?.find((a) => a.id === drawerAcctId);

  // Modal state
  const [modal, setModal] = useState<ModalType>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("capital");
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fromAcct, setFromAcct] = useState("");
  const [toAcct, setToAcct] = useState("");
  const [targetBalance, setTargetBalance] = useState("");
  const [modalAcctId, setModalAcctId] = useState<string | null>(null);

  // Add Account modal state
  const [addOpen, setAddOpen] = useState(false);
  const [newAcctType, setNewAcctType] = useState("");
  const [newAcctName, setNewAcctName] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newAcctNumber, setNewAcctNumber] = useState("");
  const [newAcctNature, setNewAcctNature] = useState("business");
  const [newOpeningBal, setNewOpeningBal] = useState("0.00");
  const [newOpeningDate, setNewOpeningDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newIsActive, setNewIsActive] = useState(true);
  const [newNotes, setNewNotes] = useState("");

  const modalAccount = accounts?.find((a) => a.id === modalAcctId);

  const resetForm = () => {
    setAmount(""); setNote(""); setCategory("capital");
    setEntryDate(format(new Date(), "yyyy-MM-dd"));
    setFromAcct(""); setToAcct(""); setTargetBalance("");
  };

  const openModal = (type: ModalType, acctId?: string) => {
    resetForm();
    if (acctId) setModalAcctId(acctId);
    if (type === "transfer" && acctId) setFromAcct(acctId);
    setModal(type);
  };
  const closeModal = () => { setModal(null); setModalAcctId(null); resetForm(); };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["finance-account-balances"] });
    if (drawerAcctId) qc.invalidateQueries({ queryKey: ["finance-account-txns"] });
  };

  /* ── mutations ─────────────────────────────────── */
  const depositMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("finance_deposit", {
        p_account_id: modalAcctId!, p_amount: parseFloat(amount),
        p_note: `[${category}] ${note}`, p_entry_date: entryDate,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deposit posted"); closeModal(); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const withdrawMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("finance_withdraw", {
        p_account_id: modalAcctId!, p_amount: parseFloat(amount),
        p_note: `[${category}] ${note}`, p_entry_date: entryDate,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Withdrawal posted"); closeModal(); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const transferMut = useMutation({
    mutationFn: async () => {
      if (fromAcct === toAcct) throw new Error("Cannot transfer to same account");
      const { error } = await supabase.rpc("finance_transfer", {
        p_from_account_id: fromAcct, p_to_account_id: toAcct,
        p_amount: parseFloat(amount), p_note: note, p_entry_date: entryDate,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Transfer posted"); closeModal(); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const adjustMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("finance_adjust_opening", {
        p_account_id: modalAcctId!, p_new_balance: parseFloat(targetBalance),
        p_note: note, p_entry_date: entryDate,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Opening balance adjusted"); closeModal(); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const createAcctMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("finance_create_account", {
        p_name: newAcctName.trim(),
        p_account_type: newAcctType,
        p_account_number: newAcctNumber.trim(),
        p_owner_name: newOwnerName.trim() || null,
        p_account_nature: newAcctNature,
        p_opening_balance: parseFloat(newOpeningBal) || 0,
        p_opening_date: newOpeningDate,
        p_notes: newNotes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account created successfully");
      setAddOpen(false);
      setNewAcctType(""); setNewAcctName(""); setNewOwnerName("");
      setNewAcctNumber(""); setNewAcctNature("business");
      setNewOpeningBal("0.00"); setNewOpeningDate(format(new Date(), "yyyy-MM-dd"));
      setNewIsActive(true); setNewNotes("");
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isSubmitting = depositMut.isPending || withdrawMut.isPending || transferMut.isPending || adjustMut.isPending || createAcctMut.isPending;

  // Total balance
  const totalBalance = (accounts || []).reduce((s, a) => s + a.balance, 0);

  // CSV export
  const handleExportCSV = () => {
    if (!txns?.length || !drawerAccount) return;
    const rows: string[][] = [
      [`Ledger: ${drawerAccount.name} (${drawerAccount.code})`],
      [`Filters: ${txnDateFrom || "start"} → ${txnDateTo || "now"} | Type: ${txnRefType || "All"} | Search: ${txnSearch || "-"}`],
      [],
      ["Date", "Description", "Ref Type", "Debit", "Credit", "Running Balance"],
      ...txns.map((t) => [
        t.entry_date, t.line_description || t.description, t.reference_type,
        String(t.debit), String(t.credit), String(t.running_balance),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ledger_${drawerAccount.code}_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
              <h1 className="text-lg font-bold text-foreground" style={heading}>Cash Control Center</h1>
              <p className="text-[11px] text-muted-foreground -mt-0.5">All balances from posted journals · Total: <strong>{formatBDT(totalBalance)}</strong></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => openModal("deposit")}>
              <ArrowDownLeft className="w-3.5 h-3.5" /> Deposit
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => openModal("withdraw")}>
              <ArrowUpRight className="w-3.5 h-3.5" /> Withdraw
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => openModal("transfer")}>
              <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer
            </Button>
            <Button size="sm" className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAddOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Add Account
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refresh}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Account cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[220px] rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {accounts?.map((acct) => {
              const Icon = ACCOUNT_ICONS[acct.code] || Wallet;
              const accent = ACCOUNT_ACCENT[acct.code] || "bg-muted text-muted-foreground";
              return (
                <div
                  key={acct.id}
                  onClick={() => setDrawerAcctId(acct.id)}
                  className={cn(
                    "bg-card border rounded-xl p-5 cursor-pointer transition-all hover:shadow-md",
                    "border-border hover:border-primary/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn("p-2 rounded-lg", accent)}><Icon className="w-5 h-5" /></div>
                    <Badge variant="secondary" className="text-[10px]">{acct.code}</Badge>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{acct.name}</p>
                  <p className="text-2xl font-bold text-foreground mt-1" style={mono}>{formatBDT(acct.balance)}</p>

                  {/* Today */}
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
                  <div className="text-[11px] text-muted-foreground mt-0.5 ml-4">
                    In: {formatBDT(acct.today_inflow)} · Out: {formatBDT(acct.today_outflow)}
                  </div>

                  {/* 7-day */}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span>7d net: <strong className={acct.week_net >= 0 ? "text-success" : "text-destructive"}>{formatBDT(acct.week_net)}</strong></span>
                  </div>

                  {/* Last txn */}
                  {acct.last_txn_at && (
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Last: {formatDateTime(acct.last_txn_at)}
                    </div>
                  )}

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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Account Detail Drawer ────────────────── */}
      <Sheet open={!!drawerAcctId} onOpenChange={(open) => !open && setDrawerAcctId(null)}>
        <SheetContent className="sm:max-w-2xl w-full p-0">
          <SheetHeader className="px-6 pt-5 pb-3 border-b border-border">
            <SheetTitle className="flex items-center gap-3" style={heading}>
              {drawerAccount && (
                <>
                  <div className={cn("p-2 rounded-lg", ACCOUNT_ACCENT[drawerAccount.code] || "bg-muted")}>
                    {(() => { const Icon = ACCOUNT_ICONS[drawerAccount.code] || Wallet; return <Icon className="w-5 h-5" />; })()}
                  </div>
                  <div>
                    <p className="text-base">{drawerAccount.name}</p>
                    <p className="text-sm text-muted-foreground font-normal" style={mono}>
                      Balance: <strong>{formatBDT(drawerAccount.balance)}</strong>
                    </p>
                  </div>
                </>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="px-6 py-3 border-b border-border bg-muted/30">
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <Label className="text-[10px]">From</Label>
                <Input type="date" value={txnDateFrom} onChange={(e) => setTxnDateFrom(e.target.value)} className="w-[130px] h-7 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">To</Label>
                <Input type="date" value={txnDateTo} onChange={(e) => setTxnDateTo(e.target.value)} className="w-[130px] h-7 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Type</Label>
                <Select value={txnRefType} onValueChange={setTxnRefType}>
                  <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    {REF_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1.5 w-3 h-3 text-muted-foreground" />
                <Input placeholder="Search..." value={txnSearch} onChange={(e) => setTxnSearch(e.target.value)} className="pl-7 w-[140px] h-7 text-xs" />
              </div>
              <Button variant="outline" size="sm" className="h-7 text-[10px] ml-auto" onClick={handleExportCSV} disabled={!txns?.length}>
                <Download className="w-3 h-3 mr-1" /> CSV
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-200px)]">
            {txnLoading ? (
              <div className="p-6 space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !txns?.length ? (
              <p className="text-sm text-muted-foreground text-center py-12">No transactions found</p>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="text-[10px] w-[80px]">Date</TableHead>
                    <TableHead className="text-[10px]">Description</TableHead>
                    <TableHead className="text-[10px] w-[70px]">Type</TableHead>
                    <TableHead className="text-[10px] text-right w-[85px]">Debit</TableHead>
                    <TableHead className="text-[10px] text-right w-[85px]">Credit</TableHead>
                    <TableHead className="text-[10px] text-right w-[100px]">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/30">
                      <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap py-2">{formatDate(t.entry_date)}</TableCell>
                      <TableCell className="text-[11px] max-w-[200px] truncate py-2">{t.line_description || t.description}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant={t.is_auto ? "secondary" : "outline"} className="text-[9px] px-1">
                          {t.reference_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] text-right py-2 text-success font-mono">{t.debit > 0 ? formatBDT(t.debit) : "—"}</TableCell>
                      <TableCell className="text-[11px] text-right py-2 text-destructive font-mono">{t.credit > 0 ? formatBDT(t.credit) : "—"}</TableCell>
                      <TableCell className="text-[11px] text-right py-2 font-bold font-mono">{formatBDT(t.running_balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* ── Deposit Modal ──────────────────────── */}
      <Dialog open={modal === "deposit"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={heading}>Deposit (Capital / Adjustment)</DialogTitle>
            <DialogDescription>Dr {modalAccount?.name || "account"}, Cr Owner Equity</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!modalAcctId && (
              <div>
                <Label className="text-xs">Account</Label>
                <Select value={modalAcctId || ""} onValueChange={(v) => setModalAcctId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>{accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({formatBDT(a.balance)})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label className="text-xs">Amount (৳)</Label><Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEPOSIT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Date</Label><Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
            <div><Label className="text-xs">Reason *</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Owner capital injection" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={() => depositMut.mutate()} disabled={!amount || !note || !modalAcctId || isSubmitting}>Post Deposit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Withdraw Modal ─────────────────────── */}
      <Dialog open={modal === "withdraw"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={heading}>Withdraw (Owner Drawing)</DialogTitle>
            <DialogDescription>Dr Owner Drawing, Cr {modalAccount?.name || "account"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!modalAcctId && (
              <div>
                <Label className="text-xs">Account</Label>
                <Select value={modalAcctId || ""} onValueChange={(v) => setModalAcctId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>{accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({formatBDT(a.balance)})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label className="text-xs">Amount (৳)</Label><Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{WITHDRAW_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Date</Label><Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
            <div><Label className="text-xs">Reason *</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Owner withdrawal" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button variant="destructive" onClick={() => withdrawMut.mutate()} disabled={!amount || !note || !modalAcctId || isSubmitting}>Post Withdrawal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Transfer Modal ─────────────────────── */}
      <Dialog open={modal === "transfer"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={heading}>Transfer Between Accounts</DialogTitle>
            <DialogDescription>Atomic balanced journal: Dr destination, Cr source</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">From Account</Label>
              <Select value={fromAcct} onValueChange={setFromAcct}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>{accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({formatBDT(a.balance)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">To Account</Label>
              <Select value={toAcct} onValueChange={setToAcct}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>{accounts?.filter((a) => a.id !== fromAcct).map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({formatBDT(a.balance)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Amount (৳)</Label><Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></div>
            <div><Label className="text-xs">Date</Label><Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
            <div><Label className="text-xs">Note / Reason *</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Moving funds for bKash payout" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={() => transferMut.mutate()} disabled={!fromAcct || !toAcct || !amount || !note || fromAcct === toAcct || isSubmitting}>Post Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Adjust Opening Balance Modal ────────── */}
      <Dialog open={modal === "adjust"} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={heading}>Adjust Opening Balance (Admin)</DialogTitle>
            <DialogDescription>
              Current: {formatBDT(modalAccount?.balance ?? 0)} — Creates adjustment journal vs Owner Equity
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">New Target Balance (৳)</Label><Input type="number" value={targetBalance} onChange={(e) => setTargetBalance(e.target.value)} placeholder="0" /></div>
            <div><Label className="text-xs">Date</Label><Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
            <div><Label className="text-xs">Reason *</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Opening balance correction" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button variant="destructive" onClick={() => adjustMut.mutate()} disabled={!targetBalance || !note || isSubmitting}>Post Adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Account Modal ──────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle style={heading}>Add New Account</DialogTitle>
            <DialogDescription>Create a new cash, bank, or mobile wallet account</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-4 py-1">
              <div>
                <Label className="text-xs">Account Type *</Label>
                <Select value={newAcctType} onValueChange={setNewAcctType}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {[
                      { value: "cash", label: "Cash" },
                      { value: "bank", label: "Bank" },
                      { value: "bkash", label: "bKash" },
                      { value: "nagad", label: "Nagad" },
                      { value: "other_wallet", label: "Other Wallet" },
                    ].map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Account Name *</Label>
                <Input value={newAcctName} onChange={(e) => setNewAcctName(e.target.value)} placeholder="bKash - 01865230553" />
              </div>
              <div>
                <Label className="text-xs">Owner Name</Label>
                <Input value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} placeholder="Ahmed Saad" />
              </div>
              <div>
                <Label className="text-xs">Account Number / Mobile *</Label>
                <Input value={newAcctNumber} onChange={(e) => setNewAcctNumber(e.target.value)} placeholder="01865230553" />
              </div>
              <div>
                <Label className="text-xs mb-2 block">Account Nature</Label>
                <RadioGroup value={newAcctNature} onValueChange={setNewAcctNature} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="personal" id="nature-personal" />
                    <Label htmlFor="nature-personal" className="text-xs font-normal cursor-pointer">Personal</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="business" id="nature-business" />
                    <Label htmlFor="nature-business" className="text-xs font-normal cursor-pointer">Business</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Opening Balance (৳)</Label>
                  <Input type="number" min="0" step="0.01" value={newOpeningBal} onChange={(e) => setNewOpeningBal(e.target.value)} style={mono} />
                </div>
                <div>
                  <Label className="text-xs">Opening Date</Label>
                  <Input type="date" value={newOpeningDate} onChange={(e) => setNewOpeningDate(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Status</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{newIsActive ? "Active" : "Inactive"}</span>
                  <Switch checked={newIsActive} onCheckedChange={setNewIsActive} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Optional notes" rows={2} />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createAcctMut.mutate()}
              disabled={!newAcctType || !newAcctName.trim() || !newAcctNumber.trim() || parseFloat(newOpeningBal) < 0 || isSubmitting}
            >
              {createAcctMut.isPending ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
