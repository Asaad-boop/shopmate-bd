import { useSearchParams } from "react-router-dom";
import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { CouriersTab } from "@/components/courier/CouriersTab";
import { CourierChargesTab } from "@/components/courier/CourierChargesTab";
import { CourierStatementsTab } from "@/components/courier/CourierStatementsTab";
import { ReconciliationTab } from "@/components/courier/ReconciliationTab";
import { SettlementsAgingTab } from "@/components/courier/SettlementsAgingTab";
import { CourierReportsTab } from "@/components/courier/CourierReportsTab";

const heading = { fontFamily: "'Playfair Display', serif" };

const TABS = [
  { id: "couriers", label: "Couriers" },
  { id: "charges", label: "Courier Charges" },
  { id: "statements", label: "Statements" },
  { id: "reconciliation", label: "Reconciliation" },
  { id: "settlements", label: "Settlements & Aging" },
  { id: "reports", label: "Reports" },
];

export default function CourierCODPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "couriers";

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="sticky top-0 z-30 bg-[hsl(222,47%,11%)]">
        <div className="flex items-center justify-between px-6 h-[54px]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-white text-lg font-bold" style={heading}>Courier & COD</h1>
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
                  ? "border-orange-400 text-orange-400"
                  : "border-transparent text-white/60 hover:text-white/90"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {activeTab === "couriers" && <CouriersTab />}
        {activeTab === "charges" && <CourierChargesTab />}
        {activeTab === "statements" && <CourierStatementsTab />}
        {activeTab === "reconciliation" && <ReconciliationTab />}
        {activeTab === "settlements" && <SettlementsAgingTab />}
        {activeTab === "reports" && <CourierReportsTab />}
      </div>
    </div>
  );
}
