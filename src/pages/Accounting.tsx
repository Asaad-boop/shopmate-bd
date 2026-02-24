import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChartOfAccountsTab } from "@/components/accounting/ChartOfAccountsTab";
import { JournalEntriesTab } from "@/components/accounting/JournalEntriesTab";
import { TrialBalanceTab } from "@/components/accounting/TrialBalanceTab";
import { GeneralLedgerTab } from "@/components/accounting/GeneralLedgerTab";
import { PeriodCloseTab } from "@/components/accounting/PeriodCloseTab";
import { AccountMappingsTab } from "@/components/accounting/AccountMappingsTab";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const heading = { fontFamily: "'Playfair Display', serif" };

const TABS = [
  { id: "coa", label: "Chart of Accounts" },
  { id: "journals", label: "Journal Entries" },
  { id: "trial_balance", label: "Trial Balance" },
  { id: "general_ledger", label: "General Ledger" },
  { id: "period_close", label: "Period Close" },
  { id: "mappings", label: "Account Mappings" },
];

export default function AccountingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "coa";

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[hsl(222,47%,11%)]">
        <div className="flex items-center justify-between px-6 h-[54px]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-white text-lg font-bold" style={heading}>Accounting</h1>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex items-center gap-0 px-6 border-t border-white/10 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap",
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

      {/* Content */}
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {activeTab === "coa" && <ChartOfAccountsTab />}
        {activeTab === "journals" && <JournalEntriesTab />}
        {activeTab === "trial_balance" && <TrialBalanceTab />}
        {activeTab === "general_ledger" && <GeneralLedgerTab />}
        {activeTab === "period_close" && <PeriodCloseTab />}
        {activeTab === "mappings" && <AccountMappingsTab />}
      </div>
    </div>
  );
}
