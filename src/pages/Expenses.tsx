import { useSearchParams } from "react-router-dom";
import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExpenseCategoriesTab } from "@/components/expenses/ExpenseCategoriesTab";
import { ExpenseEntryTab } from "@/components/expenses/ExpenseEntryTab";
import { AllocationRulesTab } from "@/components/expenses/AllocationRulesTab";
import { AllocationsTab } from "@/components/expenses/AllocationsTab";
import { ExpenseReportsTab } from "@/components/expenses/ExpenseReportsTab";

const heading = { fontFamily: "'Playfair Display', serif" };

const TABS = [
  { id: "categories", label: "Categories" },
  { id: "expenses", label: "Expenses" },
  { id: "rules", label: "Allocation Rules" },
  { id: "allocations", label: "Allocations" },
  { id: "reports", label: "Reports" },
];

export default function ExpensesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "categories";

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="sticky top-0 z-30 bg-[hsl(222,47%,11%)]">
        <div className="flex items-center justify-between px-6 h-[54px]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-white text-lg font-bold" style={heading}>Expenses</h1>
          </div>
        </div>
        <div className="flex items-center gap-0 px-6 border-t border-white/10 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSearchParams({ tab: tab.id })}
              className={cn(
                "px-4 py-2.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap",
                activeTab === tab.id
                  ? "border-rose-400 text-rose-400"
                  : "border-transparent text-white/60 hover:text-white/90"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {activeTab === "categories" && <ExpenseCategoriesTab />}
        {activeTab === "expenses" && <ExpenseEntryTab />}
        {activeTab === "rules" && <AllocationRulesTab />}
        {activeTab === "allocations" && <AllocationsTab />}
        {activeTab === "reports" && <ExpenseReportsTab />}
      </div>
    </div>
  );
}
