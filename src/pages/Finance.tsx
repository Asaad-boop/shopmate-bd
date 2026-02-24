import { useState, useEffect, useCallback } from "react";
import { usePeriod, useFinanceStats } from "@/hooks/use-finance";
import { HeroCards } from "@/components/finance/HeroCards";
import { OverviewTab } from "@/components/finance/OverviewTab";
import { TransactionsTab } from "@/components/finance/TransactionsTab";
import { PLStatementTab } from "@/components/finance/PLStatementTab";
import { AccountsTab } from "@/components/finance/AccountsTab";
import { PayableTab } from "@/components/finance/PayableTab";
import { ReceivableTab } from "@/components/finance/ReceivableTab";
import { AddTransactionModal } from "@/components/finance/AddTransactionModal";
import { ChartOfAccountsTab } from "@/components/accounting/ChartOfAccountsTab";
import { JournalEntriesTab } from "@/components/accounting/JournalEntriesTab";
import { TrialBalanceTab } from "@/components/accounting/TrialBalanceTab";
import { GeneralLedgerTab } from "@/components/accounting/GeneralLedgerTab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, FileText, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const heading = { fontFamily: "'Playfair Display', serif" };
const mono = { fontFamily: "'DM Mono', monospace" };

const TABS = [
  { id: "overview", label: "📊 Overview" },
  { id: "transactions", label: "📋 Transactions" },
  { id: "pnl", label: "📈 P&L Statement" },
  { id: "accounts", label: "🏦 Accounts" },
  { id: "payable", label: "💸 Payable" },
  { id: "receivable", label: "💰 Receivable" },
  { id: "coa", label: "📒 Chart of Accounts" },
  { id: "journals", label: "📓 Journal Entries" },
  { id: "trial_balance", label: "⚖️ Trial Balance" },
  { id: "general_ledger", label: "📖 General Ledger" },
];

const PERIOD_OPTIONS = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
];

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const { period, setPeriod, dateRange, prevRange } = usePeriod();
  const { data: stats, isLoading: statsLoading } = useFinanceStats(dateRange, prevRange);

  // Keyboard shortcut: Ctrl+T = new transaction
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "t") { e.preventDefault(); setModalOpen(true); }
    if (e.key === "Escape") setModalOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen" style={{ background: "#f4f5f9", fontFamily: "'DM Sans', sans-serif" }}>
      {/* HEADER — Dark Navy */}
      <div className="sticky top-0 z-30" style={{ background: "#0f172a" }}>
        <div className="flex items-center justify-between px-6 h-[54px]">
          {/* Left */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-white text-lg font-bold" style={heading}>Finance</h1>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
              <SelectTrigger className="w-[150px] h-8 bg-white/10 border-white/20 text-white text-xs hover:bg-white/15">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Right */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 border border-white/20 text-xs h-8">
              📊 Reports
            </Button>
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 border border-white/20 text-xs h-8">
              📤 Export PDF
            </Button>
            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-8" onClick={() => setModalOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Transaction
            </Button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-0 px-6 border-t border-white/10 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-xs font-medium transition-all border-b-2",
                activeTab === tab.id
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-white/60 hover:text-white/90"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Hero Cards — always visible */}
        <HeroCards stats={stats} isLoading={statsLoading} />

        {/* Tab Content */}
        {activeTab === "overview" && <OverviewTab dateRange={dateRange} onSwitchTab={setActiveTab} />}
        {activeTab === "transactions" && <TransactionsTab />}
        {activeTab === "pnl" && <PLStatementTab dateRange={dateRange} prevRange={prevRange} />}
        {activeTab === "accounts" && <AccountsTab />}
        {activeTab === "payable" && <PayableTab />}
        {activeTab === "receivable" && <ReceivableTab />}
        {activeTab === "coa" && <ChartOfAccountsTab />}
        {activeTab === "journals" && <JournalEntriesTab />}
        {activeTab === "trial_balance" && <TrialBalanceTab />}
        {activeTab === "general_ledger" && <GeneralLedgerTab />}
      </div>

      {/* Add Transaction Modal */}
      <AddTransactionModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
