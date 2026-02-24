import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GRNTab } from "@/components/purchasing/GRNTab";
import { SupplierPaymentsTab } from "@/components/purchasing/SupplierPaymentsTab";
import { PayablesAgingTab } from "@/components/purchasing/PayablesAgingTab";
import { PurchasingReportsTab } from "@/components/purchasing/PurchasingReportsTab";
import { LandedCostsTab } from "@/components/purchasing/LandedCostsTab";

const tabKeys = ["grn", "payments", "payables", "landed-costs", "reports"] as const;

export default function PurchasingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const activeTab = params.get("tab") || "grn";

  const setTab = (tab: string) => navigate(`/purchasing?tab=${tab}`, { replace: true });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border -mx-6 px-6 py-3">
        <h1 className="text-lg font-bold text-foreground">📦 Purchasing</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="grn" className="rounded-lg text-xs">Goods Receive (GRN)</TabsTrigger>
          <TabsTrigger value="payments" className="rounded-lg text-xs">Supplier Payments</TabsTrigger>
          <TabsTrigger value="payables" className="rounded-lg text-xs">Payables & Aging</TabsTrigger>
          <TabsTrigger value="landed-costs" className="rounded-lg text-xs">Landed Costs</TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg text-xs">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="grn"><GRNTab /></TabsContent>
        <TabsContent value="payments"><SupplierPaymentsTab /></TabsContent>
        <TabsContent value="payables"><PayablesAgingTab /></TabsContent>
        <TabsContent value="landed-costs"><LandedCostsTab /></TabsContent>
        <TabsContent value="reports"><PurchasingReportsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
