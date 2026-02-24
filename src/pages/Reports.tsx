import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GLProfitLossTab } from "@/components/reports/GLProfitLossTab";
import { BalanceSnapshotTab } from "@/components/reports/BalanceSnapshotTab";
import { CashflowTab } from "@/components/reports/CashflowTab";
import { SKUProfitabilityTab } from "@/components/reports/SKUProfitabilityTab";
import { CourierPerformanceTab } from "@/components/reports/CourierPerformanceTab";
import { InventoryValuationTab } from "@/components/reports/InventoryValuationTab";
import { SupplierPayableTab } from "@/components/reports/SupplierPayableTab";
import { ExpenseAnalyticsTab } from "@/components/reports/ExpenseAnalyticsTab";
import { ExecutiveDashboardTab } from "@/components/reports/ExecutiveDashboardTab";
import {
  BarChart3, FileText, DollarSign, Package, Truck, Boxes,
  Users, PieChart, LayoutDashboard, Scale,
} from "lucide-react";

const heading: React.CSSProperties = { fontFamily: "'Playfair Display', serif" };

const TABS = [
  { value: "executive", label: "Executive", icon: LayoutDashboard },
  { value: "pnl", label: "P&L", icon: FileText },
  { value: "balance", label: "Balance", icon: Scale },
  { value: "cashflow", label: "Cashflow", icon: DollarSign },
  { value: "sku", label: "SKU Profit", icon: Package },
  { value: "courier", label: "Courier", icon: Truck },
  { value: "inventory", label: "Inventory", icon: Boxes },
  { value: "supplier", label: "Supplier", icon: Users },
  { value: "expense", label: "Expense", icon: PieChart },
];

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "executive";

  const setTab = (t: string) => setSearchParams({ tab: t });

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto animate-fade-in">
      <header>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={heading}>Reports</h1>
            <p className="text-sm text-muted-foreground">Enterprise financial & operational analytics</p>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card border border-border/50 flex-wrap h-auto gap-0.5 p-1">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs gap-1.5 data-[state=active]:shadow-sm">
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="executive" className="mt-4"><ExecutiveDashboardTab /></TabsContent>
        <TabsContent value="pnl" className="mt-4"><GLProfitLossTab /></TabsContent>
        <TabsContent value="balance" className="mt-4"><BalanceSnapshotTab /></TabsContent>
        <TabsContent value="cashflow" className="mt-4"><CashflowTab /></TabsContent>
        <TabsContent value="sku" className="mt-4"><SKUProfitabilityTab /></TabsContent>
        <TabsContent value="courier" className="mt-4"><CourierPerformanceTab /></TabsContent>
        <TabsContent value="inventory" className="mt-4"><InventoryValuationTab /></TabsContent>
        <TabsContent value="supplier" className="mt-4"><SupplierPayableTab /></TabsContent>
        <TabsContent value="expense" className="mt-4"><ExpenseAnalyticsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
